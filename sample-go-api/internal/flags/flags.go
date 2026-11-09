// Package flags registers Datadog's OpenFeature provider and evaluates
// server-side feature flags for one user.
package flags

import (
	"context"
	"log/slog"
	"strings"
	"time"

	ddopenfeature "github.com/DataDog/dd-trace-go/v2/openfeature"
	"github.com/open-feature/go-sdk/openfeature"
)

// ClientName is the name this client reports to Datadog; keeps its
// evaluations distinguishable per service.
const ClientName = "sample-go-api"

// Register creates Datadog's provider and installs it as the OpenFeature
// default, waiting up to initTimeout for the first flag configuration.
//
// Failure is deliberately not fatal. Without DD_API_KEY the provider cannot
// fetch its configuration: OpenFeature then returns the default passed at each
// call site and the app starts either way - the same fallback shape
// sample-java-api and sample-react use.
//
// The returned func shuts the provider down; call it on exit so queued
// exposure and evaluation events are flushed.
func Register(initTimeout time.Duration) (shutdown func()) {
	provider, err := ddopenfeature.NewDatadogProvider(ddopenfeature.ProviderConfig{})
	if err != nil {
		slog.Warn("Datadog feature flag provider unavailable; flags will return their code defaults",
			"error", err)
		return func() {}
	}

	// Waits for the first configuration, so the first request cannot race
	// initialization and silently read defaults. Bounded, so an unreachable
	// Datadog delays startup by seconds rather than hanging it. A timeout is
	// recoverable: delivery keeps running and a later configuration makes the
	// provider ready.
	ctx, cancel := context.WithTimeout(context.Background(), initTimeout)
	defer cancel()
	if err := openfeature.SetProviderWithContextAndWait(ctx, provider); err != nil {
		slog.Warn("Datadog feature flag provider not ready yet; flags return their code defaults until it is. "+
			"Expected without DD_API_KEY.",
			"error", err)
	} else {
		slog.Info("Datadog feature flag provider registered", "client", ClientName)
	}

	return openfeature.Shutdown
}

// Flags evaluates flags with the context sample-react sends to the browser
// provider: targeting key the email, plus flat email and site attributes.
// Those flat names are what Datadog targeting rules reference, so one rule
// written once applies on both sides of the call - show-new-feature targets on
// site, which is why the API has to be told which site the user picked.
type Flags struct {
	client *openfeature.Client
}

// New returns Flags backed by the default OpenFeature provider. Safe to call
// before Register: the client resolves the provider at evaluation time.
func New() *Flags {
	return &Flags{client: openfeature.NewClient(ClientName)}
}

// BooleanDetails evaluates a boolean flag, returning the details rather than
// the bare value: Reason distinguishes a flag that is off from one that does
// not exist or could not be resolved, which is the difference between
// "working" and "silently defaulting".
//
// The evaluation error is not returned: on error the details already carry the
// default value, Reason ERROR and an ErrorCode, which is everything a caller
// needs to log or report.
func (f *Flags) BooleanDetails(ctx context.Context, key string, defaultValue bool, email, site string) openfeature.BooleanEvaluationDetails {
	details, _ := f.client.BooleanValueDetails(ctx, key, defaultValue, contextFor(email, site))
	return details
}

// contextFor builds the evaluation context.
//
// site is omitted entirely when the caller did not supply one, rather than sent
// as an empty string: a rule matching on site should then miss, not match a
// blank value.
func contextFor(email, site string) openfeature.EvaluationContext {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))

	attributes := map[string]any{"email": normalizedEmail}
	if s := strings.TrimSpace(site); s != "" {
		// Not lower-cased: the UI sends display names like "Toronto", and
		// Datadog targeting compares exact strings, so folding case here would
		// stop rules written against the values in the drop-down from matching.
		attributes["site"] = s
	}

	return openfeature.NewEvaluationContext(normalizedEmail, attributes)
}
