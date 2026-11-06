import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';

import '../sites.dart';
import '../telemetry.dart';
import '../widgets.dart';

/// Pragmatic email check, identical to sample-react's: requires a dotted
/// domain with a 2+ character TLD, without attempting full RFC 5322.
final _emailPattern = RegExp(
  r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$',
);

bool isValidEmail(String value) {
  final trimmed = value.trim();
  // Guard against pathologically long input before the regex sees it.
  if (trimmed.isEmpty || trimmed.length > 254) return false;
  return _emailPattern.hasMatch(trimmed);
}

/// Sample login form. A successful submit hands the validated email upward,
/// where it becomes the Datadog RUM identity and the key for the backend's
/// getUserProfile call.
///
/// The password is never logged, sent anywhere, or retained after submit.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.onSignIn});

  /// Called with a validated, trimmed email and the chosen site. The form
  /// shows a pending state until it settles.
  final Future<void> Function(String email, String site) onSignIn;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _site;
  String? _emailError;
  String? _passwordError;
  String? _siteError;
  bool _pending = false;
  String? _sessionNote;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  bool _validate() {
    final email = _email.text;
    setState(() {
      _emailError = email.trim().isEmpty
          ? 'Email is required.'
          : !isValidEmail(email)
          ? 'Enter a valid email address, for example jane@example.com.'
          : null;
      _passwordError = _password.text.isEmpty ? 'Password is required.' : null;
      _siteError = _site == null ? 'Select a site.' : null;
    });
    return _emailError == null && _passwordError == null && _siteError == null;
  }

  Future<void> _submit() async {
    if (_pending || !_validate()) return;

    _password.clear();
    setState(() => _pending = true);
    try {
      await widget.onSignIn(_email.text.trim(), _site!);
    } finally {
      // On success this widget is gone; this matters on failure, so the form
      // becomes usable again.
      if (mounted) setState(() => _pending = false);
    }
  }

  /// Ends the current RUM session. Datadog starts a fresh one on the next
  /// interaction rather than immediately, so this reports the id just retired.
  Future<void> _endSession() async {
    final previous = await rum?.getCurrentSessionId();
    rum?.stopSession();
    setState(() {
      _sessionNote = previous != null
          ? 'Ended session ${previous.substring(0, 8)}… — the next tap starts a new one.'
          : 'Session ended — the next tap starts a new one.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Panel(
      title: 'Login',
      children: [
        // RUM never sees field contents - the Flutter SDK records taps, not
        // text - so the annotation only names the action.
        RumUserActionAnnotation(
          description: 'Email field',
          child: TextField(
            controller: _email,
            enabled: !_pending,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.username],
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Email',
              hintText: 'jane@example.com',
              errorText: _emailError,
              errorMaxLines: 2,
            ),
            onChanged: (_) {
              if (_emailError != null) setState(() => _emailError = null);
            },
          ),
        ),
        RumUserActionAnnotation(
          description: 'Password field',
          child: TextField(
            controller: _password,
            enabled: !_pending,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(
              labelText: 'Password',
              errorText: _passwordError,
            ),
            onChanged: (_) {
              if (_passwordError != null) setState(() => _passwordError = null);
            },
            onSubmitted: (_) => _submit(),
          ),
        ),
        RumUserActionAnnotation(
          description: 'Site selector',
          child: DropdownButtonFormField<String>(
            initialValue: _site,
            hint: const Text('Select a site'),
            decoration: InputDecoration(
              labelText: 'Site',
              errorText: _siteError,
            ),
            items: [
              for (final name in sites)
                DropdownMenuItem(value: name, child: Text(name)),
            ],
            onChanged: _pending
                ? null
                : (value) => setState(() {
                    _site = value;
                    _siteError = null;
                  }),
          ),
        ),
        const SizedBox(height: 4),
        AppButton(
          label: _pending ? 'Logging in…' : 'Login',
          actionName: 'Login',
          onPressed: _pending ? null : _submit,
        ),
        const SizedBox(height: 8),
        AppButton(
          label: 'End Datadog Session',
          quiet: true,
          onPressed: _endSession,
        ),
        if (_sessionNote != null)
          Text(_sessionNote!, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
