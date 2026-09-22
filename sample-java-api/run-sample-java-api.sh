#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

JAR="target/sample-java-api.jar"

# Build the jar if it is missing, then run that rather than spring-boot:run:
# startup is a second or two instead of a Maven lifecycle, and the JVM is this
# script's direct child, so a Ctrl+C in run-sample-stack.sh reaches it.
#
# Rebuild after changing the code with:
#   mvn -f sample-java-api/pom.xml clean package
if [ ! -f "$JAR" ]; then
  echo "No $JAR yet - building it first…"
  mvn -q clean package
fi

# Same idea as the jar above: the tracer is gitignored, so fetch it once when
# it is missing. Without this the JVM aborts at startup with "Error opening zip
# file or JAR manifest missing".
AGENT="dd-java-agent.jar"
if [ ! -f "$AGENT" ]; then
  echo "No $AGENT yet - fetching it first…"
  ./get-dd-java-agent.sh
fi

# exec, so the JVM replaces this shell and receives signals directly.
echo "Starting sample-java-api on http://localhost:8080"
#exec java -jar "$JAR"

# SET NON-DEFAULT TRACE PORT FOR LLOYD ONLY
export DD_TRACE_AGENT_PORT=8136

# Runtime metrics (jvm.*) travel over DogStatsD, not the trace port above, and
# the tracer defaults to 8125. This Agent reports statsd_port 8135 - check with
#   curl -s localhost:8136/info | python3 -m json.tool | grep statsd
# so without this the jvm.* metrics are sent to a port nothing is reading.
export DD_DOGSTATSD_PORT=8135

# Lets the Agent push tracer configuration down from Datadog - the transport
# behind Dynamic Instrumentation, APM config changes, and ASM rule updates.
# Already the tracer default; set explicitly so the demo does not depend on
# that, and so it is visible in one place with the rest of the setup.
export DD_REMOTE_CONFIGURATION_ENABLED=true

# Both of these ride on remote configuration, and neither is on by default:
# the startup banner reports debugger_enabled false and appsec ENABLED_INACTIVE
# until they are set.
export DD_DYNAMIC_INSTRUMENTATION_ENABLED=true
export DD_APPSEC_ENABLED=true

# Server-side feature flags need a Datadog API key, which is not committed.
# Export DD_API_KEY in your shell, or put it in sample-java-api/.env.local -
# gitignored by the same rule that covers sample-react's.
if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

if [ -z "${DD_API_KEY:-}" ]; then
  echo "warning: DD_API_KEY is not set, so the flag provider cannot fetch its" >&2
  echo "         configuration and every flag returns its code default." >&2
fi

#export DD_PROFILING_DDPROF_ENABLED=true # this is the default in v1.7.0+
#export DD_PROFILING_DDPROF_CPU_ENABLED=true
#export DD_PROFILING_DDPROF_LIVEHEAP_ENABLED=true
## ONLY ON LINUX
# On macOS the tracer throws "libjavaProfiler.dylib not found on classpath" -
# non-fatal, but it fills the log with a stack trace on every start. Add this
# flag to the exec line below when running on Linux.
# -Ddd.profiling.enabled=true

# -Ddd.runtime.metrics.enabled is already the tracer default; set explicitly so
# the demo does not depend on that default staying true.
exec java -javaagent:./dd-java-agent.jar -Ddd.logs.injection=true -Ddd.runtime.metrics.enabled=true -Ddd.service=sample-app -Ddd.env=dev -Ddd.version=1.0.0 -jar "$JAR"
