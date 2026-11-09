// Command sample-go-api is a Go port of sample-java-api: the same REST API for
// sample-react, with server-side feature flags evaluated in-process through
// OpenFeature and Datadog's provider.
package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	slogtrace "github.com/DataDog/dd-trace-go/contrib/log/slog/v2"
	httptrace "github.com/DataDog/dd-trace-go/contrib/net/http/v2"
	"github.com/DataDog/dd-trace-go/v2/ddtrace/tracer"

	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/aiscan"
	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/flags"
	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/userprofile"
	"github.com/lloydwilliams/feature-flags/sample-go-api/internal/web"
)

// config is read from the environment; each field's env var and default is
// noted beside it. These mirror the sample.* keys in sample-java-api's
// application.yml.
type config struct {
	Port string // PORT, default 8080 - sample-java-api's port, so clients need no change
	// SAMPLE_CORS_ALLOWED_ORIGINS, comma-separated. sample-react's Vite dev
	// server plus the default Vite port, so either works without a change.
	AllowedOrigins []string
	// SAMPLE_PROFILE_STRICT_DIRECTORY: true -> unknown emails return 404
	// instead of a derived demo profile.
	StrictDirectory bool
	// SAMPLE_FLAGS_READOUT_KEY: flag read per getUserProfile call and reported
	// in the DEBUG line. Nothing is gated on it yet.
	ReadoutFlagKey string
	// SAMPLE_FLAGS_AI_SCAN_KEY: flag that gates StartAIScan. Must exist as a
	// server-side flag, not only a RUM one, or it resolves FLAG_NOT_FOUND and
	// the scan stays gated off.
	AIScanFlagKey string
	// SAMPLE_FLAGS_INIT_TIMEOUT_SECONDS: bound on how long startup waits for
	// the first flag configuration.
	FlagInitTimeout time.Duration
	// SAMPLE_LOG_FILE: where the JSON log is written, beside the console
	// output. Empty disables the file.
	LogFile string
}

func loadConfig() config {
	return config{
		Port:            env("PORT", "8080"),
		AllowedOrigins:  strings.Split(env("SAMPLE_CORS_ALLOWED_ORIGINS", "http://localhost:5174,http://localhost:5173"), ","),
		StrictDirectory: env("SAMPLE_PROFILE_STRICT_DIRECTORY", "false") == "true",
		ReadoutFlagKey:  env("SAMPLE_FLAGS_READOUT_KEY", "show-new-feature"),
		AIScanFlagKey:   env("SAMPLE_FLAGS_AI_SCAN_KEY", "show-ai-scan"),
		FlagInitTimeout: time.Duration(envInt("SAMPLE_FLAGS_INIT_TIMEOUT_SECONDS", 5)) * time.Second,
		LogFile:         env("SAMPLE_LOG_FILE", "logs/sample-go-api.log"),
	}
}

func main() {
	cfg := loadConfig()

	closeLog := setupLogging(cfg.LogFile)
	defer closeLog()

	// Started before the flag provider: span enrichment and the remote_config
	// source (DD_FEATURE_FLAGS_CONFIGURATION_SOURCE=remote_config) both ride
	// on the tracer. Service, env and version come from DD_SERVICE, DD_ENV and
	// DD_VERSION, set in run-sample-go-api.sh.
	if err := tracer.Start(tracer.WithRuntimeMetrics()); err != nil {
		slog.Warn("Datadog tracer failed to start", "error", err)
	}
	defer tracer.Stop()

	shutdownFlags := flags.Register(cfg.FlagInitTimeout)
	defer shutdownFlags()

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           newHandler(cfg, flags.New()),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("sample-go-api listening", "addr", "http://localhost:"+cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Warn("graceful shutdown failed", "error", err)
	}
}

// newHandler wires the routes. The traced mux names each span after its route
// pattern, so APM groups requests by endpoint rather than by raw URL.
func newHandler(cfg config, ff *flags.Flags) http.Handler {
	profiles := userprofile.Handler{
		Service:        userprofile.Service{StrictDirectory: cfg.StrictDirectory},
		Flags:          ff,
		ReadoutFlagKey: cfg.ReadoutFlagKey,
	}
	scans := aiscan.Handler{Flags: ff, FlagKey: cfg.AIScanFlagKey}

	mux := httptrace.NewServeMux()
	mux.HandleFunc("GET /api/users/profile", profiles.GetUserProfile)
	mux.HandleFunc("POST /api/ai-scan/start", scans.StartAIScan)
	// Same path as Spring Boot Actuator's, so anything probing sample-java-api
	// works unchanged against this API.
	mux.HandleFunc("GET /actuator/health", func(w http.ResponseWriter, _ *http.Request) {
		web.WriteJSON(w, http.StatusOK, map[string]string{"status": "UP"})
	})

	return web.CORS(cfg.AllowedOrigins, mux)
}

// setupLogging sends logs to the console as text and to logFile as JSON, both
// at DEBUG so the per-request resolved line is written.
//
// JSON in the file because the Datadog Agent parses it without a grok rule,
// and each record arrives whole, so no multiline rule either. The slogtrace
// wrapper adds dd.trace_id and dd.span_id to records logged with a request
// context, which is what links a log line to its trace - and, because
// sample-react propagates its trace id, back to the RUM session.
func setupLogging(logFile string) (closeLog func()) {
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	handlers := []slog.Handler{slog.NewTextHandler(os.Stdout, opts)}
	closeLog = func() {}

	if logFile != "" {
		f, err := openLogFile(logFile)
		if err != nil {
			slog.Warn("log file unavailable; logging to the console only", "path", logFile, "error", err)
		} else {
			handlers = append(handlers, slog.NewJSONHandler(f, opts))
			closeLog = func() { _ = f.Close() }
		}
	}

	slog.SetDefault(slog.New(slogtrace.WrapHandler(slog.NewMultiHandler(handlers...))))
	return closeLog
}

func openLogFile(path string) (io.WriteCloser, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if n, err := strconv.Atoi(env(key, "")); err == nil {
		return n
	}
	return fallback
}
