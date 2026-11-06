import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../telemetry.dart';
import '../widgets.dart';

/// Exclusive upper bound on the scan amount. Matches the API's own validation.
const maxAmount = 1000;

/// Digits only, so decimals, signs, and exponents are rejected as not whole
/// numbers rather than silently truncated.
final _wholeNumber = RegExp(r'^\d+$');

/// Validates the scan amount, returning the error to show or null when valid.
String? validateAmount(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return 'Enter a number to scan.';
  if (!_wholeNumber.hasMatch(trimmed)) {
    return 'Enter a whole number - no decimals, signs, or letters.';
  }
  // A long digit string would overflow int.parse; it is too big either way.
  final value = int.tryParse(trimmed);
  if (value == null || value >= maxAmount) {
    return 'Enter a number less than $maxAmount.';
  }
  return null;
}

/// Reached from "AI Scan Assist" on the new feature page.
///
/// Reaching this screen only means the app-side flag was on. Whether a scan
/// actually runs is decided by the API, which evaluates `show-ai-scan`
/// server-side for this site.
class AiScanPage extends StatefulWidget {
  const AiScanPage({
    super.key,
    required this.email,
    required this.site,
    required this.onBack,
    required this.onSignOut,
  });

  final String email;
  final String site;
  final VoidCallback onBack;
  final VoidCallback onSignOut;

  @override
  State<AiScanPage> createState() => _AiScanPageState();
}

class _AiScanPageState extends State<AiScanPage> {
  final _amount = TextEditingController();
  String? _error;
  bool _pending = false;
  AiScanResult? _result;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _scan() async {
    if (_pending) return;

    final found = validateAmount(_amount.text);
    if (found != null) {
      // Clear any previous outcome, so a stale message cannot sit alongside
      // an error about the current input.
      setState(() {
        _error = found;
        _result = null;
      });
      return;
    }

    final value = int.parse(_amount.text.trim());
    final site = widget.site;
    setState(() {
      _error = null;
      _result = null;
      _pending = true;
    });

    try {
      final scan = await startAiScan(value, widget.email, site);

      logger?.info(
        scan.enabled
            ? 'AI scan completed for $value'
            : 'AI scan unavailable at site $site',
        attributes: {
          'scan_type': 'ai',
          'amount': value,
          'site': site,
          'enabled': scan.enabled,
        },
      );

      // Only a scan that actually ran is a completed scan.
      if (scan.enabled) {
        rum?.addAction(RumActionType.custom, 'Scan Completed', {
          'scan_type': 'ai',
          'amount': value,
          'site': site,
        });
      }

      if (mounted) setState(() => _result = scan);
    } on ApiError catch (error, stack) {
      final attributes = {
        'scan_type': 'ai',
        'amount': value,
        'site': site,
        'status': error.status,
      };
      // Same level split as sign-in: a 4xx is a rejection the API handled,
      // anything else is a fault.
      if (error.status != null && error.status! < 500) {
        logger?.warn('AI scan rejected by the API', attributes: attributes);
      } else {
        logger?.error(
          'AI scan failed calling the API',
          errorMessage: error.message,
          errorStackTrace: stack,
          attributes: attributes,
        );
      }
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Panel(
      title: 'AI Scan Assist',
      children: [
        Text(
          'SmartPick AI Scan Ready!',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        RumUserActionAnnotation(
          description: 'Scan amount field',
          child: TextField(
            controller: _amount,
            enabled: !_pending,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Number to scan',
              hintText: '0 - ${maxAmount - 1}',
              errorText: _error,
              errorMaxLines: 3,
            ),
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
            onSubmitted: (_) => _scan(),
          ),
        ),
        AppButton(
          label: _pending ? 'Scanning…' : 'Scan',
          actionName: 'Scan',
          onPressed: _pending ? null : _scan,
        ),
        if (result != null)
          StatusBanner(
            result.enabled ? StatusKind.ok : StatusKind.warn,
            result.message,
          ),
        AppButton(label: 'Back', quiet: true, onPressed: widget.onBack),
        AppButton(label: 'Log out', onPressed: widget.onSignOut),
      ],
    );
  }
}
