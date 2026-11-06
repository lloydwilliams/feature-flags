#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# sample-java-api plus the Flutter app on the Android emulator - the
# counterpart of run-sample-stack.sh for flutter-app. Extra arguments pass
# through to `flutter run`, e.g. `./run-flutter-stack.sh --release`.

API_URL="http://localhost:8080"

# Job control, so the API becomes its own process group leader. Cleanup can
# then signal the whole group: killing only the wrapper PID would leave mvn's
# JVM holding port 8080.
set -m

api_pid=""

cleanup() {
  # Clear the traps first, so a second Ctrl+C during cleanup cannot re-enter.
  trap - INT TERM EXIT
  if [ -n "$api_pid" ]; then
    echo
    echo "Stopping sample-java-api…"
    kill -TERM "-$api_pid" 2>/dev/null || true
    wait 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# Any HTTP status counts as up - a 400 for the missing query still means
# Spring is serving. curl prints 000 when nothing answered.
api_is_up() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 \
    "$API_URL/api/users/profile")" != "000" ]
}

if api_is_up; then
  # Reuse it rather than fail on the port, and leave it running on exit since
  # this script did not start it.
  echo "sample-java-api is already running on $API_URL - using it."
else
  echo "Starting sample-java-api on $API_URL …"
  ./sample-java-api/run-sample-java-api.sh &
  api_pid="$!"

  # Wait for it to answer rather than a fixed head start: the emulator boot
  # below can be quick, and the app's first sign-in should not race Spring.
  echo "Waiting for sample-java-api to answer…"
  for _ in $(seq 1 120); do
    if ! kill -0 "$api_pid" 2>/dev/null; then
      echo "sample-java-api exited before it was ready."
      exit 1
    fi
    api_is_up && break
    sleep 1
  done
  if ! api_is_up; then
    echo "sample-java-api did not answer within 120s."
    exit 1
  fi
  echo "sample-java-api is up."
fi

echo
echo "Starting flutter-app. Press q (or Ctrl+C) to quit; the API stops with it."

# In the foreground, so flutter run keeps the terminal for hot reload (r),
# restart (R) and quit (q). Its exit runs the EXIT trap, which stops the API.
./flutter-app/run-sample-flutter.sh "$@"
