import 'package:datadog_flags_flutter/datadog_flags_flutter.dart';
import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';

import 'app.dart';
import 'config.dart';
import 'flags.dart';
import 'telemetry.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (isConfigured) {
    final configuration =
        DatadogConfiguration(
            clientToken: datadogClientToken,
            env: datadogEnv,
            site: datadogSite,
            service: datadogService,
            version: datadogVersion,
            nativeCrashReportEnabled: true,
            // RUM resources for sample-java-api calls carry trace headers the
            // Java tracer continues. Only the API host is listed, so Datadog's
            // own intake calls are left alone. `datadog` is what the Java
            // tracer reads natively; `tracecontext` keeps an OpenTelemetry
            // backend working too.
            firstPartyHostsWithTracingHeaders: {
              Uri.parse(apiBaseUrl).host: {
                TracingHeaderType.datadog,
                TracingHeaderType.tracecontext,
              },
            },
            loggingConfiguration: DatadogLoggingConfiguration(),
            rumConfiguration: DatadogRumConfiguration(
              applicationId: datadogApplicationId,
              sessionSamplingRate: 100,
              detectLongTasks: true,
            ),
          )
          // Flags derive client token, site, env, service, version and RUM
          // application id from the configuration above, and add successful
          // evaluations to the active RUM view.
          ..addPlugin(
            const DatadogFlagsPluginConfiguration(
              flagsConfiguration: DatadogFlagsConfiguration(
                initializationTimeout: Duration(seconds: 2),
              ),
            ),
          );

    await DatadogSdk.instance.initialize(
      configuration,
      TrackingConsent.granted,
    );
    createLogger();
  }

  // Before the first frame, so the first build already has the anonymous
  // assignments (or has timed out to defaults) rather than flipping later.
  final flags = await FlagsController.create();

  runApp(SampleApp(flags: flags));
}
