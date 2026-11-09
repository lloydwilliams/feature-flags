# sample-go-api

A Go port of [sample-java-api](../sample-java-api/README.md). It has the same endpoints,
the same JSON, the same user directory and the same feature-flag behaviour, built on
`net/http`, `log/slog`, and Datadog's OpenFeature provider in `dd-trace-go`.

Either backend can serve `sample-react` or the Flutter app. Point the client at this one
and nothing else changes: the user ids are identical too, so a person keeps their RUM
identity whichever backend answers.

## Build and test

```bash
cd sample-go-api && go test ./... && go build -o bin/sample-go-api .
```

Needs Go 1.26 or later (`slog.NewMultiHandler`, and dd-trace-go's own minimum).

## Run

```bash
./sample-go-api/run-sample-go-api.sh
```

The script rebuilds the binary every time it starts. `go build` is incremental, so this
costs about a second, and the binary can never be stale. The script then sets the Datadog
environment the same way `run-sample-java-api.sh` does (same Agent ports, `.env.local`,
the `DD_API_KEY` warning) and execs the server.

It listens on **`http://localhost:8080`**, the same port as sample-java-api. That way
sample-react, the Flutter app and the call scripts reach it with no configuration change.
The cost is that only one of the two backends can run at a time. Override the port with
`PORT`. Health check: `http://localhost:8080/actuator/health`.

## Endpoints

These are identical to sample-java-api, whose README documents them in full:

| Endpoint | Notes |
| --- | --- |
| `GET /api/users/profile?email=&site=` | `site` is optional and only feeds flag targeting |
| `POST /api/ai-scan/start` `{"amount","email","site"}` | Gated by `show-ai-scan` for the caller's site |
| `GET /actuator/health` | `{"status":"UP"}`, on the same path Spring uses |

The status codes, the `{"status","error","message"}` error body, and the `error…` (500) and
`warn…` (422) demo hooks all match the Java service. The ready-made AI scan calls also work
against this API:

```bash
./sample-java-api/call-start-ai-scan-toronto.sh
./sample-java-api/call-start-ai-scan-houston.sh
```

## Server-side feature flags

Flags are evaluated in-process through OpenFeature, using Datadog's provider:

```go
provider, err := ddopenfeature.NewDatadogProvider(ddopenfeature.ProviderConfig{})
openfeature.SetProviderWithContextAndWait(ctxWithTimeout, provider)
client := openfeature.NewClient("sample-go-api")
```

The provider is registered once in [flags.go](internal/flags/flags.go), which also builds the
evaluation context. That context is the same one sample-java-api uses:

| Context | Value |
| --- | --- |
| targeting key | the email, lower-cased |
| `email` | the email, lower-cased |
| `site` | as sent, trimmed, **not** lower-cased. Omitted when absent, so a site rule misses instead of matching a blank value |

### How configuration arrives (the main difference from Java)

The Java provider runs inside `dd-java-agent` and gets its flag configuration through the
Agent. The Go provider defaults to **agentless** delivery: it polls Datadog over HTTPS
every 30s using `DD_API_KEY`. That means:

- **`DD_API_KEY` is the only requirement.** Flags work even when no Agent is running.
  Traces, metrics, and logs still go through the Agent.
- Flag configuration is fetched for `DD_ENV`. The run script defaults it to `flutter`, the
  environment flutter-app reports, so the app and its API resolve flags against the same
  rules. The Java service uses `dev`, so run `DD_ENV=dev ./sample-go-api/run-sample-go-api.sh`
  to match that instead. `flutter` must exist as an environment in Datadog Feature Flags,
  or every flag resolves to its default.
- To use the Agent instead, set `DD_FEATURE_FLAGS_CONFIGURATION_SOURCE=remote_config`.
  The tracer is already started before the provider, which is what that mode needs.
- `DD_FEATURE_FLAGS_ENABLED=false` swaps in a no-op provider (a kill switch).

### Without a key

The app starts normally. Startup waits for up to `SAMPLE_FLAGS_INIT_TIMEOUT_SECONDS` (5s),
then logs:

```
WARN Datadog feature flag provider not ready yet; flags return their code defaults until it is. Expected without DD_API_KEY.
```

After that, every evaluation returns its code default. The DEBUG lines show why:

```
StartAIScan flag evaluated flag=show-ai-scan flagValue=false reason=ERROR errorCode=PROVIDER_NOT_READY site=Toronto
```

`reason` means the same here as in Java. `STATIC`, `TARGETING_MATCH` or `SPLIT` means the
value came from real configuration. `ERROR` plus an `errorCode` (`PROVIDER_NOT_READY`,
`FLAG_NOT_FOUND`) means it fell back to the code default. The AI scan response carries
`reason` and `variant` too. `show-ai-scan` must exist as a server-side flag; otherwise it
resolves `FLAG_NOT_FOUND` and every site stays gated off.

### Span enrichment

The run script sets `DD_EXPERIMENTAL_FLAGGING_PROVIDER_SPAN_ENRICHMENT_ENABLED=true`, so
each evaluation is recorded on the request's root span. A trace then shows which variant
served it. Remove that line if the extra span tags are unwanted, since they can affect APM
billing.

### Evaluation metrics

The run script sets `DD_METRICS_OTEL_ENABLED=true`, which turns on Datadog's
[server-side flag evaluation metrics](https://docs.datadoghq.com/feature_flags/guide/server_flag_evaluation_metrics/).
The provider counts every evaluation as `feature_flag.evaluations` and exports it over OTLP
every 10 seconds. The tags are `feature_flag.key`, `feature_flag.result.variant`,
`feature_flag.result.reason`, and `feature_flag.result.allocation_key` (when present), plus
`error.type` on errors. Unlike Java, Go needs no extra dependency: the OTLP exporter ships in
dd-trace-go (2.8.0 or later).

The metrics go to the Agent's OTLP receiver at `http://localhost:4318` (OTLP/HTTP), not to the
trace or DogStatsD ports. That needs `otlp_config.receiver.protocols.http` enabled in
`datadog.yaml`. Override the destination with `OTEL_EXPORTER_OTLP_ENDPOINT`.

To check it, search Metrics Explorer for `feature_flag.evaluations`, or graph:

```
sum:feature_flag.evaluations{service:sample-go-api} by {feature_flag.key,feature_flag.result.variant}
```

By default only an hour of history is kept. To keep more, enable **Historical Metrics** for
the metric in the Metrics Catalog. Evaluations without a key count too, with
`reason:error` and `error.type:provider_not_ready`.

## Configuration

All configuration comes from environment variables, which stand in for `application.yml`:

| Variable | Default | Java equivalent |
| --- | --- | --- |
| `PORT` | `8080` | `server.port` |
| `SAMPLE_CORS_ALLOWED_ORIGINS` | `http://localhost:5174,http://localhost:5173` | `sample.cors.allowed-origins` |
| `SAMPLE_PROFILE_STRICT_DIRECTORY` | `false` | `sample.profile.strict-directory` |
| `SAMPLE_FLAGS_READOUT_KEY` | `show-new-feature` | `sample.flags.readout-key` |
| `SAMPLE_FLAGS_AI_SCAN_KEY` | `show-ai-scan` | `sample.flags.ai-scan-key` |
| `SAMPLE_FLAGS_INIT_TIMEOUT_SECONDS` | `5` | `sample.flags.init-timeout-seconds` |
| `SAMPLE_LOG_FILE` | `logs/sample-go-api.log` (empty disables it) | logback file appender |

## Logs and traces

Logs go to the console as text and to `logs/sample-go-api.log` as JSON, both at DEBUG. JSON
means the Agent needs no grok or multiline rule:

```yaml
logs:
  - type: file
    path: /absolute/path/to/sample-go-api/logs/sample-go-api.log
    service: sample-go-api
    source: go
```

Request lines carry `dd.trace_id` and `dd.span_id`, which dd-trace-go's slog wrapper adds.
The traced `ServeMux` names each span after its route (`GET /api/users/profile`), and it
picks up the trace context that sample-react propagates. That is how a log line links back
to the RUM session behind it.

The file is opened in append mode and never rotated, unlike the Java service's
logback-managed file. Truncate it or set up `newsyslog` if a long-running demo makes that
matter.

Go runtime metrics (`runtime.go.*`) are reported over DogStatsD on port 8135, the same as the
Java service's `jvm.*` metrics. Graph them filtered to `service:sample-go-api`.

## Layout

```
sample-go-api/
├── main.go                  # config, logging, tracer, flag provider, routes, shutdown
├── main_test.go             # endpoint tests against the no-op provider
├── run-sample-go-api.sh
└── internal/
    ├── flags/               # provider registration + evaluation context
    ├── userprofile/         # directory, derived profiles, getUserProfile handler
    ├── aiscan/              # StartAIScan handler and validation
    └── web/                 # JSON/error helpers, email check, CORS
```
