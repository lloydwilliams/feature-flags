import 'package:flutter/material.dart';

import '../models.dart';
import '../widgets.dart';

/// "2021-03-15" -> "15 March 2021", without pulling in intl.
String formatMemberSince(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return isoDate;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', //
    'August', 'September', 'October', 'November', 'December',
  ];
  return '${parsed.day} ${months[parsed.month - 1]} ${parsed.year}';
}

/// Post-login landing view.
///
/// The forklift and its entry button are gated together on `show-new-feature`,
/// so with the flag off there is no trace of the feature to discover.
class SignedInPage extends StatelessWidget {
  const SignedInPage({
    super.key,
    required this.email,
    required this.site,
    required this.profile,
    required this.profileError,
    required this.showNewFeature,
    required this.onOpenNewFeature,
    required this.onSignOut,
  });

  final String email;
  final String site;

  /// Result of the getUserProfile call made at sign-in; null if it failed.
  final UserProfile? profile;
  final String? profileError;

  /// Resolved once in App and passed down, so the gate here and the guard
  /// there can never disagree about one decision.
  final bool showNewFeature;
  final VoidCallback onOpenNewFeature;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    final profile = this.profile;

    return Panel(
      title: 'Signed in',
      children: [
        Text.rich(
          TextSpan(
            style: muted,
            children: [
              const TextSpan(text: 'RUM user set to '),
              TextSpan(text: email, style: monospace),
              const TextSpan(text: ' · site '),
              TextSpan(text: site, style: monospace),
            ],
          ),
        ),
        if (profile != null)
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(profile.displayName, style: theme.textTheme.titleLarge),
                  Text(
                    '${profile.jobTitle} · ${profile.department}',
                    style: muted,
                  ),
                  const SizedBox(height: 12),
                  _detail(context, 'Email', profile.email),
                  _detail(
                    context,
                    'Account',
                    '${profile.account.name} · ${profile.account.plan}\n'
                        '${profile.account.id}',
                  ),
                  _detail(context, 'Location', profile.location),
                  _detail(
                    context,
                    'Member since',
                    formatMemberSince(profile.memberSince),
                  ),
                  _detail(context, 'Roles', profile.roles.join(', ')),
                  const SizedBox(height: 8),
                  Text(
                    'from GET /api/users/profile · account set on RUM',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          )
        else
          StatusBanner(
            StatusKind.error,
            'Profile unavailable — ${profileError ?? 'unknown error'}',
          ),
        if (showNewFeature) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.asset(
              'assets/images/forklift.jpg',
              semanticLabel: 'Forklift in a warehouse',
            ),
          ),
          AppButton(label: 'New Feature', onPressed: onOpenNewFeature),
        ],
        AppButton(label: 'Sign out', quiet: true, onPressed: onSignOut),
      ],
    );
  }

  Widget _detail(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
