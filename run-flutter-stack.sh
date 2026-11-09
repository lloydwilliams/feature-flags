#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# sample-go-api plus the Flutter app on the Android emulator - the
# counterpart of run-sample-stack.sh for flutter-app. Extra arguments pass
# through to `flutter run`, e.g. `./run-flutter-stack.sh --release`.

# Must match the app's compiled-in API_BASE_URL (and .env.example's),
# http://10.0.2.2:8080. Passed to the API explicitly rather than relying on
# its default, so the two cannot drift apart.
API_PORT=8080
API_URL="http://localhost:$API_PORT"

# Job control, so the API becomes its own process group leader. Cleanup can
# then signal the whole group: killing only the wrapper PID would leave the
# server holding port 8080.
set -m

api_pid=""

cleanup() {
  # Clear the traps first, so a second Ctrl+C during cleanup cannot re-enter.
  trap - INT TERM EXIT
  if [ -n "$api_pid" ]; then
    echo
    echo "Stopping sample-go-api…"
    kill -TERM "-$api_pid" 2>/dev/null || true
    wait 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# Any HTTP status counts as up - a 400 for the missing query still means
# the API is serving. curl prints 000 when nothing answered.
api_is_up() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 \
    "$API_URL/api/users/profile")" != "000" ]
}

# Name of the process listening on the API port, or empty. The two backends
# answer identically by design, so the process is the only way to tell
# sample-java-api apart from this one.
port_owner() {
  lsof -nP -iTCP:"$API_PORT" -sTCP:LISTEN -Fc 2>/dev/null | sed -n 's/^c//p' | head -1
}

if api_is_up; then
  owner="$(port_owner)"
  if [ "$owner" != "sample-go-api" ]; then
    # Most likely sample-java-api from run-sample-stack.sh. Reusing it would
    # run the app against the wrong backend without any sign of it.
    echo "Port $API_PORT is already held by '${owner:-unknown}', not sample-go-api." >&2
    echo "Stop it first, then re-run this script." >&2
    exit 1
  fi
  # Reuse it rather than fail on the port, and leave it running on exit since
  # this script did not start it.
  echo "sample-go-api is already running on $API_URL - using it."
else
  echo "Starting sample-go-api on $API_URL …"
  PORT="$API_PORT" ./sample-go-api/run-sample-go-api.sh &
  api_pid="$!"

  # Wait for it to answer rather than a fixed head start: the emulator boot
  # below can be quick, and the app's first sign-in should not race the API.
  # The bound also covers the run script's go build, which on a fresh clone
  # downloads modules first.
  echo "Waiting for sample-go-api to answer…"
  for _ in $(seq 1 120); do
    if ! kill -0 "$api_pid" 2>/dev/null; then
      echo "sample-go-api exited before it was ready."
      exit 1
    fi
    api_is_up && break
    sleep 1
  done
  if ! api_is_up; then
    echo "sample-go-api did not answer within 120s."
    exit 1
  fi
  echo "sample-go-api is up."
fi

echo
echo "Starting flutter-app. Press q (or Ctrl+C) to quit; the API stops with it."

# In the foreground, so flutter run keeps the terminal for hot reload (r),
# restart (R) and quit (q). Its exit runs the EXIT trap, which stops the API.
./flutter-app/run-sample-flutter.sh "$@"
