#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Rebuilt on every start: go build is incremental, so an unchanged tree costs a
# second, and the binary can never be stale the way a skipped rebuild can.
# Then exec'd rather than `go run`, so the server is this script's direct child
# and a Ctrl+C in a stack script reaches it.
BIN="bin/sample-go-api"
go build -o "$BIN" .

# SET NON-DEFAULT TRACE PORT FOR LLOYD ONLY - same Agent as sample-java-api.
export DD_TRACE_AGENT_PORT=8136

# Runtime metrics (runtime.go.*) travel over DogStatsD, not the trace port
# above, and the tracer defaults to 8125. This Agent reports statsd_port 8135 -
# check with
#   curl -s localhost:8136/info | python3 -m json.tool | grep statsd
# so without this the metrics are sent to a port nothing is reading.
export DD_DOGSTATSD_PORT=8135

# Unified service tagging. env matters for flags too: the provider fetches the
# flag configuration for this environment. flutter, the env flutter-app
# reports (see its .env.example), so the API and the app it serves resolve
# flags against the same Datadog environment.
export DD_SERVICE="${DD_SERVICE:-sample-go-api}"
export DD_ENV="${DD_ENV:-flutter}"
export DD_VERSION="${DD_VERSION:-1.0.0}"

# Already on via tracer.WithRuntimeMetrics() in main.go; set here too so it is
# visible with the rest of the setup.
export DD_RUNTIME_METRICS_ENABLED=true

# Records each flag evaluation as tags on the request's root span, so a trace
# shows which variant served it. Off by default; may affect APM billing.
export DD_EXPERIMENTAL_FLAGGING_PROVIDER_SPAN_ENRICHMENT_ENABLED=true

# Server-side flag evaluation metrics: the provider counts every evaluation as
# feature_flag.evaluations (tagged by flag key, variant, reason, allocation)
# and exports it over OTLP every 10s. Without this the counter is a no-op.
# Unlike Java, Go needs no extra dependency - the exporter is in dd-trace-go.
#
# OTLP is a separate path from the trace and DogStatsD ports above: it goes to
# the Agent's OTLP receiver (otlp_config.receiver in datadog.yaml), HTTP on
# 4318. Explicit so it matches sample-java-api and survives a DD_AGENT_HOST.
export DD_METRICS_OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
export OTEL_EXPORTER_OTLP_PROTOCOL="${OTEL_EXPORTER_OTLP_PROTOCOL:-http/protobuf}"

# Server-side feature flags need a Datadog API key, which is not committed.
# Export DD_API_KEY in your shell, or put it in sample-go-api/.env.local -
# gitignored by the root .gitignore's .env.local rule.
if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

if [ -z "${DD_API_KEY:-}" ]; then
  echo "warning: DD_API_KEY is not set, so the flag provider cannot fetch its" >&2
  echo "         configuration and every flag returns its code default." >&2
fi

echo "Starting sample-go-api on http://localhost:${PORT:-8080}"
exec "./$BIN"
