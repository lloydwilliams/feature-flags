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

# exec, so the JVM replaces this shell and receives signals directly.
echo "Starting sample-java-api on http://localhost:8080"
exec java -jar "$JAR"
