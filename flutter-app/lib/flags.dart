import 'package:datadog_flags_flutter/datadog_flags_flutter.dart';
import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'config.dart';

/// Datadog Feature Flags wiring, via `datadog_flags_flutter`.
///
/// Unlike sample-react this is not an OpenFeature provider: Datadog's Dart SDK
/// offers an OpenFeature-shaped API of its own (`getBooleanDetails`, `variant`,
/// `reason`, error codes) but is not built on the OpenFeature Dart SDK yet. The
/// flag keys, targeting attributes, and defaults are identical, so the same
/// flags in Datadog drive both apps.

/// Every flag this app reads. Keep in step with the reads in `App`.
const flagKeys = ['show-datadog-logo', 'show-new-feature', 'show-ai-scan'];

/// What the status notice reports. The Dart SDK has no status stream, so this
/// is tracked from the outcome of each `initialize` call.
enum FlagsStatus { notConfigured, loading, ready, timedOut, error }

class FlagSnapshot {
  const FlagSnapshot(this.key, this.value, this.reason);

  final String key;
  final bool value;
  final String reason;
}

/// Owns the flags client and its evaluation context, and notifies listeners
/// whenever a new set of assignments lands so the UI re-reads its flags.
///
/// The SDK evaluates from a local cache and never pushes changes, so flags
/// only change here when a context is (re)applied: at startup, sign-in,
/// sign-out, and when the app returns to the foreground - see [refresh].
class FlagsController extends ChangeNotifier {
  FlagsController._(this._client);

  static const _targetingKeyPref = 'sample-flutter:targeting-key';

  final DatadogFlagsClient? _client;

  FlagsStatus _status = FlagsStatus.notConfigured;
  FlagsStatus get status => _status;

  /// Why the last initialize failed, for the status notice.
  String? _lastError;
  String? get lastError => _lastError;

  late FlagsEvaluationContext _anonymousContext;
  late FlagsEvaluationContext _context;

  /// Builds the controller and applies the anonymous context.
  ///
  /// Must run after [DatadogSdk.initialize], which is where the flags plugin
  /// is registered; with Datadog unconfigured there is no plugin and every
  /// read returns its default.
  static Future<FlagsController> create() async {
    final controller = FlagsController._(
      DatadogSdk.instance.flags?.sharedClient(),
    );
    controller._anonymousContext = FlagsEvaluationContext(
      targetingKey: await _anonymousTargetingKey(),
    );
    controller._context = controller._anonymousContext;

    if (controller._client == null) {
      debugPrint(
        '[flags] Datadog Feature Flags not configured (missing '
        '${missingConfig.join(', ')}). Flags will return their default '
        'values. See .env.example.',
      );
    } else {
      await controller._apply(controller._anonymousContext);
    }
    return controller;
  }

  /// Stable per-install targeting key, so percentage rollouts don't reshuffle
  /// on every launch. The mobile equivalent of sample-react's localStorage key.
  static Future<String> _anonymousTargetingKey() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final existing = prefs.getString(_targetingKeyPref);
      if (existing != null) return existing;
      final generated = const Uuid().v4();
      await prefs.setString(_targetingKeyPref, generated);
      return generated;
    } catch (_) {
      return 'anonymous';
    }
  }

  /// Fetches assignments for [context] and notifies listeners.
  ///
  /// A timeout is not fatal: the SDK keeps fetching and later reads pick up
  /// the result, and until then flags return their defaults.
  Future<void> _apply(FlagsEvaluationContext context) async {
    final client = _client;
    if (client == null) return;

    _context = context;
    _status = FlagsStatus.loading;
    notifyListeners();

    try {
      await client.initialize(context);
      _status = FlagsStatus.ready;
      _lastError = null;
    } on FlagsInitializationTimeoutException catch (error) {
      _status = FlagsStatus.timedOut;
      _lastError = error.message;
    } catch (error) {
      _status = FlagsStatus.error;
      _lastError = error.toString();
    }
    notifyListeners();
  }

  /// Promotes the signed-in user into the flag evaluation context, so Datadog
  /// can target on them.
  ///
  /// Same shape as sample-react's `identifyUser`: `targetingKey` is the site,
  /// making the site the unit of rollout, with `site`, `email` and `userId`
  /// also sent as flat attributes for targeting rules.
  ///
  /// Awaited by the sign-in flow so gated UI renders from this user's
  /// assignments, rather than the anonymous ones flipping a moment later.
  Future<void> identifyUser(String email, String site, String userId) {
    return _apply(
      FlagsEvaluationContext(
        targetingKey: site,
        attributes: {'site': site, 'email': email, 'userId': userId},
      ),
    );
  }

  /// Returns to the anonymous context on sign-out.
  Future<void> resetUserContext() => _apply(_anonymousContext);

  /// Refetches the current context. Called when the app returns to the
  /// foreground, so a flag switched off in Datadog acts as a kill switch the
  /// next time the user opens the app rather than only after a restart.
  Future<void> refresh() => _apply(_context);

  FlagDetails<bool> details(String key) {
    final client = _client;
    if (client == null) {
      return FlagDetails(
        key: key,
        value: false,
        error: FlagEvaluationError.providerNotReady,
      );
    }
    return client.getBooleanDetails(key: key, defaultValue: false);
  }

  /// Every flag defaults to false, so nothing gated appears if the flag is
  /// missing or Datadog is unavailable.
  bool isOn(String key) => details(key).value;

  /// All flags, for logging. Read after the context has been applied, so it
  /// reports what the user will actually see.
  List<FlagSnapshot> snapshot() => [
    for (final key in flagKeys)
      if (details(key) case final d)
        FlagSnapshot(key, d.value, d.reason ?? 'unknown'),
  ];
}
