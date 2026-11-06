import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';

enum StatusKind { ok, warn, error }

/// The `.status--ok/warn/error` banners from sample-react.
class StatusBanner extends StatelessWidget {
  const StatusBanner(this.kind, this.text, {super.key});

  final StatusKind kind;
  final String text;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (background, foreground) = switch ((kind, dark)) {
      (StatusKind.ok, false) => (
        const Color(0xFFECFDF5),
        const Color(0xFF065F46),
      ),
      (StatusKind.ok, true) => (
        const Color(0xFF052E1F),
        const Color(0xFF6EE7B7),
      ),
      (StatusKind.warn, false) => (
        const Color(0xFFFFFBEB),
        const Color(0xFF92400E),
      ),
      (StatusKind.warn, true) => (
        const Color(0xFF2E2205),
        const Color(0xFFFCD34D),
      ),
      (StatusKind.error, false) => (
        const Color(0xFFFEF2F2),
        const Color(0xFFB91C1C),
      ),
      (StatusKind.error, true) => (
        const Color(0xFF300B0B),
        const Color(0xFFFCA5A5),
      ),
    };
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, style: TextStyle(color: foreground, fontSize: 14)),
    );
  }
}

/// Primary or quiet button, with a RUM action name.
///
/// [actionName] plays the part of `data-dd-action-name` in sample-react: RUM
/// reports the tap under that label instead of guessing from the widget tree.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.quiet = false,
    String? actionName,
  }) : actionName = actionName ?? label;

  final String label;
  final VoidCallback? onPressed;
  final bool quiet;
  final String actionName;

  @override
  Widget build(BuildContext context) {
    final button = quiet
        ? OutlinedButton(onPressed: onPressed, child: Text(label))
        : FilledButton(onPressed: onPressed, child: Text(label));
    return RumUserActionAnnotation(
      description: actionName,
      child: SizedBox(width: double.infinity, child: button),
    );
  }
}

/// Page scaffold shared by every screen: heading, content, then the logo,
/// status notice and flag readouts that App adds below.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 16),
        ..._spaced(children),
      ],
    );
  }

  static Iterable<Widget> _spaced(List<Widget> children) sync* {
    for (var i = 0; i < children.length; i++) {
      if (i > 0) yield const SizedBox(height: 12);
      yield children[i];
    }
  }
}

const monospace = TextStyle(fontFamily: 'monospace');
