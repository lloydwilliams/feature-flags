#!/usr/bin/env bash
# Stops both sample apps started by run-sample-stack.sh (or started individually).
#
# Deliberately not `set -e`: nothing running is a normal outcome, not a failure.
set -uo pipefail

cd "$(dirname "$0")"
ROOT="$PWD"

API_PORT=8080
REACT_PORT=5174

stopped=0

# SIGTERM first so Spring Boot and vite shut down cleanly, SIGKILL only for
# whatever ignores it.
stop_pids() {
  local label=$1
  shift
  local pids=("$@")

  echo "Stopping $label (pid ${pids[*]})…"
  kill -TERM "${pids[@]}" 2>/dev/null

  local waited=0
  while [ "$waited" -lt 10 ]; do
    local alive=()
    local pid
    for pid in "${pids[@]}"; do
      kill -0 "$pid" 2>/dev/null && alive+=("$pid")
    done
    if [ ${#alive[@]} -eq 0 ]; then
      stopped=$((stopped + 1))
      return 0
    fi
    sleep 0.5
    waited=$((waited + 1))
  done

  echo "  did not exit after 5s, sending SIGKILL"
  kill -KILL "${pids[@]}" 2>/dev/null
  stopped=$((stopped + 1))
}

# Collects matching pids, skipping this script so a pattern can never match the
# process doing the stopping.
stop_matching() {
  local label=$1 pattern=$2
  local pids=()
  local pid

  while read -r pid; do
    [ -n "$pid" ] && [ "$pid" != "$$" ] && pids+=("$pid")
  done < <(pgrep -f "$pattern" 2>/dev/null)

  [ ${#pids[@]} -eq 0 ] && return 0
  stop_pids "$label" "${pids[@]}"
}

# The supervisor goes first: left running, its poll loop would notice a server
# exit and report a crash that is really this script doing its job.
#
# Matched on the bare script name because it runs as `bash ./run-sample-stack.sh`,
# with no absolute path in its command line to scope on. Only one stack can hold
# these ports at a time, so this is unambiguous in practice.
stop_matching "run-sample-stack.sh" "run-sample-stack.sh"

# Both the jar (current) and spring-boot:run (how this used to start), since a
# long-running shell may still have the old one.
#
# Matched on the jar path alone, not "java -jar …": the tracer puts -javaagent
# and several -Ddd.* flags between the two, which a literal "java -jar" pattern
# would miss entirely.
stop_matching "sample-java-api (jar)" "target/sample-java-api.jar"
stop_matching "sample-java-api (mvn)" "spring-boot:run"

# vite's command line carries the full path, so this only ever matches the dev
# server for this checkout - a copy of the repo elsewhere is left alone.
stop_matching "sample-react (vite)" "$ROOT/sample-react/node_modules/.bin/vite"

if [ "$stopped" -eq 0 ]; then
  echo "Nothing to stop - neither app is running."
fi

# Anything still holding a port was started outside this directory (another
# checkout, or by hand). Report it rather than killing a process this script
# cannot attribute to the sample apps.
for port in "$API_PORT" "$REACT_PORT"; do
  holder=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$holder" ]; then
    echo
    echo "Note: port $port is still held by pid $holder:"
    ps -o pid,command -p "$holder" 2>/dev/null | tail -n +2 | sed 's/^/  /'
    echo "  Not stopped - it was not started from $ROOT."
  fi
done
