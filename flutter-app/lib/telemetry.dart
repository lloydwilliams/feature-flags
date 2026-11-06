import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';

import 'config.dart';

/// Shared Datadog logger, the counterpart of `datadogLogs.logger` in
/// sample-react. Null when Datadog is not configured, so every call site uses
/// `?.` and the app runs the same either way.
DatadogLogger? logger;

/// RUM, or null when Datadog is not configured.
DatadogRum? get rum => DatadogSdk.instance.rum;

/// Creates [logger]. Called once, after [DatadogSdk.initialize].
void createLogger() {
  logger = DatadogSdk.instance.logs?.createLogger(
    DatadogLoggerConfiguration(
      service: datadogService,
      name: 'sample-flutter',
      // Mirrors sample-react's `forwardConsoleLogs: 'all'`: everything is sent,
      // debug included.
      remoteLogThreshold: LogLevel.debug,
    ),
  );
}
