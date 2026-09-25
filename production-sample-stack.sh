#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Job control, so each background server becomes its own process group leader.
# Cleanup can then signal the whole group: killing only the wrapper PID would
# leave mvn's JVM holding port 8080 and vite holding its port.
set -m

pids=()

cleanup() {
  # Clear the traps first, so a second Ctrl+C during cleanup cannot re-enter.
  trap - INT TERM EXIT
  echo
  echo "Stopping servers…"
  if [ ${#pids[@]} -gt 0 ]; then
    for pid in "${pids[@]}"; do
      kill -TERM "-$pid" 2>/dev/null || true
    done
  fi
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starting sample-java-api on http://localhost:8080 …"
./sample-java-api/prod-sample-java-api.sh &
pids+=("$!")

# Head start for Spring Boot, so the React app's first getUserProfile call does
# not race the API's startup.
sleep 2

echo "Starting sample-react on http://localhost:5174 …"
./sample-react/prod-sample-react.sh &
pids+=("$!")

echo
echo "Both servers are starting. Press Ctrl+C to stop them together."

# Exit as soon as either server dies, so a stack that is only half up comes down
# rather than looking healthy. Polled rather than `wait -n`, which stock macOS
# bash 3.2 does not have; the EXIT trap stops whichever server is still up.
while :; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "A server exited."
      exit 1
    fi
  done
  sleep 1
done
