#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Reports release 2.0.0 to match prod-sample-java-api.sh and
# prod-sample-react.sh. The env stays `flutter`, this app's env tag for RUM and
# Feature Flags.
exec ./run-sample-flutter.sh --dart-define=DD_VERSION=2.0.0 "$@"
