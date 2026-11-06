import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';

/// Build-time configuration, from `--dart-define-from-file=.env.local` (see
/// `.env.example`). The Flutter counterpart of sample-react's `VITE_*` vars.
///
/// If the Datadog values are incomplete the SDK is not initialized at all, so
/// the app still runs and every flag returns its default.

const _applicationId = String.fromEnvironment('DD_APPLICATION_ID');
const _clientToken = String.fromEnvironment('DD_CLIENT_TOKEN');
const _site = String.fromEnvironment('DD_SITE', defaultValue: 'us1');

/// The `env` tag for RUM, Logs, and Feature Flags alike - the flags plugin
/// takes it from the same DatadogConfiguration. `flutter` rather than sample-
/// react's `dev`, so this app's telemetry and flag environment stand apart.
const datadogEnv = String.fromEnvironment('DD_ENV', defaultValue: 'flutter');

/// Defaults to 1.0.0 to match sample-react and the dev Java script, so RUM,
/// Logs, and APM all tag the same release.
const datadogVersion = String.fromEnvironment(
  'DD_VERSION',
  defaultValue: '1.0.0',
);

/// Own service name, so mobile telemetry is not mixed in with the browser
/// app's under `sample-react`.
const datadogService = 'sample-flutter';

/// Origin of sample-java-api. 10.0.2.2 is how the Android emulator reaches the
/// host Mac's localhost.
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080',
);

/// Which required values are still missing, for the on-screen notice.
final List<String> missingConfig = [
  if (_applicationId.isEmpty) 'DD_APPLICATION_ID',
  if (_clientToken.isEmpty) 'DD_CLIENT_TOKEN',
];

final bool isConfigured = missingConfig.isEmpty;

String get datadogApplicationId => _applicationId;
String get datadogClientToken => _clientToken;

/// `DD_SITE` as the SDK's enum. An unrecognised value falls back to us1 rather
/// than failing the build, and is shown on the status notice.
final DatadogSite datadogSite = DatadogSite.values.firstWhere(
  (value) => value.name == _site,
  orElse: () => DatadogSite.us1,
);
