import 'package:flutter_test/flutter_test.dart';
import 'package:sample_flutter/pages/ai_scan_page.dart';
import 'package:sample_flutter/pages/login_page.dart';
import 'package:sample_flutter/pages/signed_in_page.dart';
import 'package:sample_flutter/sites.dart';

void main() {
  group('isValidEmail', () {
    test('accepts a dotted domain', () {
      expect(isValidEmail(' jane@example.com '), isTrue);
    });

    test('rejects a bare host, as sample-react does', () {
      expect(isValidEmail('a@b'), isFalse);
      expect(isValidEmail(''), isFalse);
    });
  });

  group('validateAmount', () {
    test('accepts whole numbers below the limit', () {
      expect(validateAmount('0'), isNull);
      expect(validateAmount('999'), isNull);
    });

    test('rejects the limit, decimals, signs and huge input', () {
      expect(validateAmount('1000'), contains('less than'));
      expect(validateAmount('12.5'), contains('whole number'));
      expect(validateAmount('-3'), contains('whole number'));
      expect(validateAmount('99999999999999999999999'), contains('less than'));
      expect(validateAmount(' '), contains('Enter a number'));
    });
  });

  test('formatMemberSince', () {
    expect(formatMemberSince('2021-03-15'), '15 March 2021');
    expect(formatMemberSince('not a date'), 'not a date');
  });

  test('sites are the 30 metros, alphabetical', () {
    expect(sites, hasLength(30));
    expect(sites.first, 'Atlanta');
    expect(sites, containsAll(['Houston', 'Toronto', 'St. Louis']));
  });
}
