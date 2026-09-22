#!/bin/sh
# Fetches the Datadog Java tracer (~20MB) into this directory.
#
# The jar is gitignored rather than committed, so this is how a fresh clone
# gets one. run-sample-java-api.sh calls it automatically when the jar is
# missing.
set -eu

cd "$(dirname "$0")"

URL='https://dtdg.co/latest-java-tracer'
OUT='dd-java-agent.jar'
# Downloaded to a temp file and moved into place, so an interrupted or failed
# download cannot leave a truncated jar that the JVM would reject at startup.
TMP="$OUT.download"

cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT INT TERM

echo "Fetching the Datadog Java tracer from $URL …"

# dtdg.co redirects, so both commands have to follow redirects. curl first:
# macOS ships it, and does not ship wget.
if command -v curl > /dev/null 2>&1; then
  curl -fSL --retry 2 -o "$TMP" "$URL"
elif command -v wget > /dev/null 2>&1; then
  wget -q -O "$TMP" "$URL"
else
  echo "Need curl or wget to fetch $URL" >&2
  exit 1
fi

# A redirect to an error page would still exit 0 with -f in some cases, so
# check we actually got a jar before installing it.
if ! unzip -tqq "$TMP" > /dev/null 2>&1; then
  echo "Downloaded file is not a valid jar - leaving $OUT untouched." >&2
  exit 1
fi

mv "$TMP" "$OUT"
echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
