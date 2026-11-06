#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Homebrew's android-commandlinetools cask installs the SDK here. Respect an
# existing ANDROID_HOME (Android Studio puts it under ~/Library/Android/sdk).
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

AVD_NAME="${AVD_NAME:-sample_flutter}"

# Boot the emulator if no Android device is attached yet.
if ! adb devices | grep -q -E 'device$'; then
  if ! emulator -list-avds | grep -qx "$AVD_NAME"; then
    echo "Creating emulator $AVD_NAME …"
    echo no | avdmanager create avd -n "$AVD_NAME" \
      -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_8
    # avdmanager defaults this to no, which ignores the Mac's keyboard.
    sed -i '' 's/^hw.keyboard=no$/hw.keyboard=yes/' \
      "$HOME/.android/avd/$AVD_NAME.avd/config.ini"
  fi
  echo "Starting emulator $AVD_NAME …"
  emulator -avd "$AVD_NAME" -no-snapshot-save >/dev/null 2>&1 &
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
  done
fi

# Datadog config is compiled in from .env.local; without it the app still runs
# and every flag returns its default.
defines=()
if [ -f .env.local ]; then
  defines=(--dart-define-from-file=.env.local)
else
  echo "No .env.local - Datadog disabled. Copy .env.example to enable it."
fi

flutter pub get
flutter run "${defines[@]+"${defines[@]}"}" "$@"
