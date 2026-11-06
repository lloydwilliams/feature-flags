# sample-flutter

The Android port of [sample-react](../sample-react): the same login → signed
in → new feature → AI scan flow, gated by the same three Datadog feature flags,
reporting to Datadog RUM and Logs and calling the same
[sample-java-api](../sample-java-api).

| Flag                | Gates                                              |
| ------------------- | -------------------------------------------------- |
| `show-datadog-logo` | Datadog logo above every screen                    |
| `show-new-feature`  | Forklift + **New Feature** button, and that screen |
| `show-ai-scan`      | **AI Scan Assist** button and screen               |

Every flag defaults to `false`. After sign-in the evaluation context matches
sample-react's exactly — `targetingKey` is the site, with `site`, `email` and
`userId` as attributes — so one set of targeting rules drives both apps.

## Prerequisites

```bash
brew install --cask flutter android-commandlinetools
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" \
  "emulator" "system-images;android-36;google_apis;arm64-v8a"
yes | sdkmanager --licenses
flutter config --android-sdk /opt/homebrew/share/android-commandlinetools
```

Android Studio works too; the run script respects an existing `ANDROID_HOME`.

## Configure

```bash
cp .env.example .env.local   # fill in DD_APPLICATION_ID and DD_CLIENT_TOKEN
```

Values are compiled in through `--dart-define-from-file`, so change them and
restart `flutter run` — hot reload does not pick them up. Without them the app
still runs with Datadog off and every flag at its default.

Use a RUM application of type **Flutter** in Datadog (or reuse sample-react's
application ID if you want both apps in one RUM app). Telemetry is tagged
`service:sample-flutter` and `env:flutter`. The flags SDK uses the same env, so
Datadog Feature Flags needs an environment named `flutter` with the three
flags enabled in it.

## Run

Start the API first (`../sample-java-api/run-sample-java-api.sh`), then:

```bash
./run-sample-flutter.sh
```

It creates and boots an emulator named `sample_flutter` if no device is
attached, then runs the app with `.env.local`. Extra arguments pass through to
`flutter run` (`--release`, `-d <device>`). `./prod-sample-flutter.sh` reports
`version:2.0.0` to match the other prod scripts.

The emulator is created with the hardware keyboard on, so typing on the Mac
goes into the app's fields (click a field first). For an emulator created
before that, set `hw.keyboard=yes` in
`~/.android/avd/sample_flutter.avd/config.ini` and restart it.

The emulator reaches the Mac's `localhost:8080` as `10.0.2.2:8080`, which is
the default `API_BASE_URL`. On a physical device, run
`adb reverse tcp:8080 tcp:8080` and set `API_BASE_URL=http://localhost:8080`.
Cleartext HTTP is allowed for those local hosts only
(`android/app/src/main/res/xml/network_security_config.xml`).

## How it differs from sample-react

- **Flags SDK.** Uses Datadog's `datadog_flags_flutter`, which has an
  OpenFeature-shaped API (`getBooleanDetails` → value, variant, reason, error
  code) but is not an OpenFeature provider; Datadog has not shipped one for
  Dart yet. `lib/flags.dart` plays the part of sample-react's `flags.ts`.
- **Flag refresh.** The SDK evaluates from a local cache and has no change
  stream. Flags are refetched on sign-in, sign-out and whenever the app
  returns to the foreground, which is when the kill-switch behaviour kicks in.
- **RUM views and actions.** Screens are started manually with the same view
  names (`Login`, `Signed In`, `New Feature`, `AI Scan Assist`). Taps are named
  with `RumUserActionAnnotation`, the counterpart of `data-dd-action-name`.
  The `new-feature-ai-scan` operation vital works the same way.
- **No session replay.** That needs the separate `datadog_session_replay`
  package; not added here.
- **Tracing.** API calls go through `DatadogClient`, with the API host in
  `firstPartyHostsWithTracingHeaders`, so taps link to the Java service's
  spans as they do in the browser.

## Test

```bash
flutter analyze
flutter test
```
