import 'package:flutter/material.dart';

import '../widgets.dart';

/// The gated feature itself. Only reachable while `show-new-feature` is on -
/// App re-checks the flag on every build, so turning it off returns anyone
/// sitting on this page to the landing view.
class NewFeaturePage extends StatelessWidget {
  const NewFeaturePage({
    super.key,
    required this.showAiScan,
    required this.onOpenAiScan,
    required this.onBack,
    required this.onSignOut,
  });

  /// `show-ai-scan`, resolved once in App. A flag of its own, so the AI scan
  /// screen can go to a subset of the users who already have this page.
  final bool showAiScan;
  final VoidCallback onOpenAiScan;
  final VoidCallback onBack;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return Panel(
      title: 'New feature',
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.asset(
            'assets/images/forklift.jpg',
            semanticLabel: 'Forklift in a warehouse',
          ),
        ),
        Text(
          'Congratulations you have accessed our new feature!',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        if (showAiScan)
          AppButton(label: 'AI Scan Assist', onPressed: onOpenAiScan),
        AppButton(label: 'Back', quiet: true, onPressed: onBack),
        AppButton(label: 'Log out', onPressed: onSignOut),
      ],
    );
  }
}
