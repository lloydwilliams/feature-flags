import 'package:datadog_flags_flutter/datadog_flags_flutter.dart';
import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import 'api.dart';
import 'config.dart';
import 'flags.dart';
import 'models.dart';
import 'pages/ai_scan_page.dart';
import 'pages/login_page.dart';
import 'pages/new_feature_page.dart';
import 'pages/signed_in_page.dart';
import 'telemetry.dart';
import 'widgets.dart';

enum _View { home, newFeature, aiScan }

/// Which screen is actually on display, after the flag guard is applied.
enum ActiveView {
  login('Login'),
  signedIn('Signed In'),
  newFeature('New Feature'),
  aiScan('AI Scan Assist');

  const ActiveView(this.rumName);

  /// Name reported to RUM via startView - the same names sample-react uses,
  /// so both apps' screens line up in Datadog.
  final String rumName;
}

/// Operation vital tracking the gated feature's funnel: opening the new
/// feature page starts it, reaching the AI scan screen completes it.
const _aiScanOperation = 'new-feature-ai-scan';

class SampleApp extends StatelessWidget {
  const SampleApp({super.key, required this.flags});

  final FlagsController flags;

  @override
  Widget build(BuildContext context) {
    ThemeData theme(Brightness brightness) => ThemeData(
      colorScheme: ColorScheme.fromSeed(
        // Datadog purple.
        seedColor: const Color(0xFF632CA6),
        brightness: brightness,
      ),
    );

    // Taps anywhere below become RUM actions, named by the nearest
    // RumUserActionAnnotation - the counterpart of `trackUserInteractions`.
    return RumUserActionDetector(
      rum: rum,
      child: MaterialApp(
        title: 'Feature Flags',
        theme: theme(Brightness.light),
        darkTheme: theme(Brightness.dark),
        home: HomeScreen(flags: flags),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.flags});

  final FlagsController flags;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  FlagsController get flags => widget.flags;

  String? _signedInAs;
  String? _signedInSite;
  UserProfile? _profile;
  String? _profileError;
  _View _view = _View.home;

  /// Identifies one attempt at the funnel, so repeated attempts cannot be
  /// matched to the wrong start.
  String? _operationKey;

  /// Guards against starting the same RUM view twice.
  ActiveView? _startedView;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    flags.addListener(_onFlagsChanged);
  }

  @override
  void dispose() {
    flags.removeListener(_onFlagsChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onFlagsChanged() => setState(() {});

  /// Refetches flags on return to the foreground, which is what lets a flag
  /// switched off in Datadog act as a kill switch without an app restart.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) flags.refresh();
  }

  Future<void> _handleSignIn(String email, String site) async {
    // The tap itself, so a sign-in is visible in Logs even when the API never
    // answers. Site, not email, to keep the address out of log text.
    logger?.info('Sign in requested', attributes: {'site': site});

    // A failure here does not block sign-in - the flag demo still needs to
    // work when the Java API is not running - so the error is carried to the
    // signed-in page instead.
    UserProfile? fetched;
    String? failure;
    try {
      fetched = await fetchUserProfile(email, site);
      logger?.debug(
        'Sign in profile resolved',
        attributes: {
          'site': site,
          'account_id': fetched.account.id,
          'account_plan': fetched.account.plan,
          'roles': fetched.roles,
        },
      );
    } on ApiError catch (error, stack) {
      failure = error.message;
      if (error.status != null && error.status! < 500) {
        logger?.warn(
          'Sign in rejected by the profile API',
          attributes: {'site': site, 'status': error.status},
        );
      } else {
        logger?.error(
          'Sign in failed calling the profile API',
          errorMessage: error.message,
          errorStackTrace: stack,
          attributes: {'site': site, 'status': error.status},
        );
      }
    } catch (error, stack) {
      // A malformed body, say - still a fault, still not fatal to sign-in.
      failure = error.toString();
      logger?.error(
        'Sign in failed calling the profile API',
        errorMessage: failure,
        errorStackTrace: stack,
        attributes: {'site': site, 'status': null},
      );
    }

    // The profile's UUID is the RUM user id; without one, fall back to the
    // email and record which happened in `user_id_source` below.
    final profileId = fetched?.id;
    final hasProfileId = profileId != null && profileId.isNotEmpty;
    final userId = hasProfileId ? profileId : email;

    // `site` lands as a custom user attribute, queryable as `usr.site`.
    DatadogSdk.instance.setUserInfo(
      id: userId,
      email: email,
      extraInfo: {'site': site},
    );
    if (fetched != null) {
      DatadogSdk.instance.setAccountInfo(
        id: fetched.account.id,
        name: fetched.account.name,
        extraInfo: {'plan': fetched.account.plan},
      );
    }

    // Awaited so the first build after sign-in uses this user's assignments.
    await flags.identifyUser(email, site, userId);

    final snapshot = flags.snapshot();
    logger?.info(
      'Sign in complete',
      attributes: {
        'site': site,
        'profile_loaded': fetched != null,
        'user_id': userId,
        'user_id_source': hasProfileId ? 'profile' : 'email-fallback',
        'account_id': fetched?.account.id,
        'flags': {for (final flag in snapshot) flag.key: flag.value},
      },
    );

    setState(() {
      _signedInAs = email;
      _signedInSite = site;
      _profile = fetched;
      _profileError = failure;
      _view = _View.home;
    });
  }

  void _openNewFeature() {
    final key = const Uuid().v4();
    _operationKey = key;
    rum?.startFeatureOperation(_aiScanOperation, operationKey: key);
    setState(() => _view = _View.newFeature);
  }

  void _openAiScan() {
    // Ends the operation started on the New Feature tap.
    final key = _operationKey;
    if (key != null) {
      rum?.succeedFeatureOperation(_aiScanOperation, operationKey: key);
      _operationKey = null;
    }
    setState(() => _view = _View.aiScan);
  }

  /// Closes an open operation as a drop-off. A no-op once it has ended, which
  /// makes it safe to call from Back on the AI scan page.
  void _abandonOperation() {
    final key = _operationKey;
    if (key == null) return;
    rum?.failFeatureOperation(
      _aiScanOperation,
      RumFeatureOperationFailureReason.abandoned,
      operationKey: key,
    );
    _operationKey = null;
  }

  Future<void> _handleSignOut() async {
    // Before clearing the user, so the vital is attributed to them.
    _abandonOperation();
    DatadogSdk.instance.clearUserInfo();
    DatadogSdk.instance.clearAccountInfo();
    // Ends the RUM session, so the next user starts a separate one.
    rum?.stopSession();

    setState(() {
      _signedInAs = null;
      _signedInSite = null;
      _profile = null;
      _profileError = null;
      _view = _View.home;
    });
    await flags.resetUserContext();
  }

  /// Both flags are re-checked on every build, so turning either off acts as
  /// a kill switch. The AI scan screen hangs off the new feature, so it needs
  /// both.
  ActiveView _activeView(bool showNewFeature, bool showAiScan) {
    if (_signedInAs == null) return ActiveView.login;
    if (_view == _View.newFeature && showNewFeature) {
      return ActiveView.newFeature;
    }
    if (_view == _View.aiScan && showNewFeature && showAiScan) {
      return ActiveView.aiScan;
    }
    return ActiveView.signedIn;
  }

  /// Starts a RUM view whenever the visible screen changes. Run after the
  /// frame, so it reflects what was actually rendered.
  void _trackView(ActiveView view) {
    if (_startedView == view) return;
    final previous = _startedView;
    _startedView = view;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (previous != null) rum?.stopView(previous.name);
      rum?.startView(view.name, view.rumName);
    });
  }

  /// Android back: same as the on-screen Back button, then nothing.
  void _handleBack(ActiveView view) {
    switch (view) {
      case ActiveView.newFeature:
        _abandonOperation();
        setState(() => _view = _View.home);
      case ActiveView.aiScan:
        _abandonOperation();
        setState(() => _view = _View.newFeature);
      case ActiveView.login || ActiveView.signedIn:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final showDatadogLogo = flags.isOn('show-datadog-logo');
    final showNewFeature = flags.isOn('show-new-feature');
    // Separate from show-new-feature so the AI scan screen can be rolled out
    // to a subset of the users who already have the gated feature.
    final showAiScan = flags.isOn('show-ai-scan');

    final active = _activeView(showNewFeature, showAiScan);
    _trackView(active);

    final page = switch (active) {
      ActiveView.login => LoginPage(onSignIn: _handleSignIn),
      ActiveView.signedIn => SignedInPage(
        email: _signedInAs!,
        site: _signedInSite!,
        profile: _profile,
        profileError: _profileError,
        showNewFeature: showNewFeature,
        onOpenNewFeature: _openNewFeature,
        onSignOut: _handleSignOut,
      ),
      ActiveView.newFeature => NewFeaturePage(
        showAiScan: showAiScan,
        onOpenAiScan: _openAiScan,
        onBack: () => _handleBack(ActiveView.newFeature),
        onSignOut: _handleSignOut,
      ),
      ActiveView.aiScan => AiScanPage(
        email: _signedInAs!,
        site: _signedInSite!,
        onBack: () => _handleBack(ActiveView.aiScan),
        onSignOut: _handleSignOut,
      ),
    };

    final canGoBack =
        active == ActiveView.newFeature || active == ActiveView.aiScan;

    return PopScope(
      canPop: !canGoBack,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack(active);
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
            children: [
              if (showDatadogLogo)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Image.asset(
                    'assets/images/dd_icon_rgb.png',
                    height: 103,
                    semanticLabel: 'Datadog',
                  ),
                ),
              // Keyed on the screen so each one gets fresh form state.
              KeyedSubtree(key: ValueKey(active), child: page),
              _ProviderStatusNotice(flags: flags),
              for (final key in flagKeys)
                _FlagReadout(flags: flags, flagKey: key),
            ],
          ),
        ),
      ),
    );
  }
}

/// Reports the flags client's real status, not just whether config was
/// present.
class _ProviderStatusNotice extends StatelessWidget {
  const _ProviderStatusNotice({required this.flags});

  final FlagsController flags;

  @override
  Widget build(BuildContext context) {
    return switch (flags.status) {
      FlagsStatus.notConfigured => StatusBanner(
        StatusKind.warn,
        'Datadog not initialized. Add ${missingConfig.join(' and ')} to '
        '.env.local and run with --dart-define-from-file=.env.local. Flags '
        'return their defaults until then.',
      ),
      FlagsStatus.loading => const StatusBanner(
        StatusKind.warn,
        'Flags status: loading',
      ),
      FlagsStatus.ready => StatusBanner(
        StatusKind.ok,
        'Flags ready — site ${datadogSite.name}, env $datadogEnv',
      ),
      FlagsStatus.timedOut => StatusBanner(
        StatusKind.warn,
        'Flags timed out (${flags.lastError}). Still fetching; flags return '
        'their defaults until assignments arrive.',
      ),
      FlagsStatus.error => StatusBanner(
        StatusKind.error,
        'Flags failed to initialize (${flags.lastError}). A 401/403 means '
        'DD_CLIENT_TOKEN or DD_APPLICATION_ID is wrong. Flags return their '
        'defaults.',
      ),
    };
  }
}

/// Development aid: shows how a flag resolved. `reason` distinguishes a flag
/// that is off from one that does not exist in Datadog yet.
class _FlagReadout extends StatelessWidget {
  const _FlagReadout({required this.flags, required this.flagKey});

  final FlagsController flags;
  final String flagKey;

  @override
  Widget build(BuildContext context) {
    final FlagDetails<bool> details = flags.details(flagKey);
    final style = Theme.of(context).textTheme.bodySmall
        ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Text.rich(
        TextSpan(
          style: style,
          children: [
            TextSpan(text: flagKey, style: monospace),
            const TextSpan(text: ' = '),
            TextSpan(
              text: '${details.value}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const TextSpan(text: ' · reason '),
            TextSpan(text: details.reason ?? 'unknown', style: monospace),
            if (details.variant != null) ...[
              const TextSpan(text: ' · variant '),
              TextSpan(text: details.variant, style: monospace),
            ],
            if (details.error != null) ...[
              const TextSpan(text: ' · error '),
              TextSpan(text: details.error!.code, style: monospace),
            ],
          ],
        ),
      ),
    );
  }
}
