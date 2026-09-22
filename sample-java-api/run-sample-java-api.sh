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

#export DD_PROFILING_DDPROF_ENABLED=true # this is the default in v1.7.0+
#export DD_PROFILING_DDPROF_CPU_ENABLED=true
#export DD_PROFILING_DDPROF_LIVEHEAP_ENABLED=true
## ONLY ON LINUX
# On macOS the tracer throws "libjavaProfiler.dylib not found on classpath" -
# non-fatal, but it fills the log with a stack trace on every start. Add this
# flag to the exec line below when running on Linux.
# -Ddd.profiling.enabled=true

exec java -javaagent:./dd-java-agent.jar -Ddd.logs.injection=true -Ddd.service=sample-app -Ddd.env=dev -Ddd.version=1.0.0 -jar "$JAR"
