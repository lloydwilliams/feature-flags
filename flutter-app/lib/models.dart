import 'api.dart';

/// The organization a user belongs to. Shaped to pass straight to
/// `setAccountInfo`, which requires `id` and treats the rest as `account.*`.
class Account {
  const Account({required this.id, required this.name, required this.plan});

  factory Account.fromJson(Map<String, dynamic> json) => Account(
    id: json['id'] as String,
    name: json['name'] as String,
    plan: json['plan'] as String,
  );

  final String id;
  final String name;
  final String plan;
}

/// Mirrors the `UserProfile` record returned by the Java API.
class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.displayName,
    required this.jobTitle,
    required this.department,
    required this.location,
    required this.memberSince,
    required this.roles,
    required this.account,
  });

  /// [id] stays nullable-tolerant: an API that answers without one (version
  /// skew) surfaces as an empty string, which sign-in treats as missing.
  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    id: json['id'] as String? ?? '',
    email: json['email'] as String,
    displayName: json['displayName'] as String,
    jobTitle: json['jobTitle'] as String,
    department: json['department'] as String,
    location: json['location'] as String,
    memberSince: json['memberSince'] as String,
    roles: (json['roles'] as List<dynamic>).cast<String>(),
    account: Account.fromJson(json['account'] as Map<String, dynamic>),
  );

  /// Stable UUID for this user.
  final String id;
  final String email;
  final String displayName;
  final String jobTitle;
  final String department;
  final String location;

  /// ISO date, e.g. "2021-03-15".
  final String memberSince;
  final List<String> roles;
  final Account account;
}

/// Calls `getUserProfile` for the given email and site.
///
/// `site` does not change the profile; it is sent so the API can put it in its
/// server-side flag evaluation context, matching the attribute this app sends
/// to the flags SDK.
Future<UserProfile> fetchUserProfile(String email, String site) async {
  final json = await getJson('/api/users/profile', 'getUserProfile', {
    'email': email,
    'site': site,
  });
  return UserProfile.fromJson(json);
}

/// Mirrors the `AiScanResponse` record returned by StartAIScan.
class AiScanResult {
  const AiScanResult({
    required this.enabled,
    required this.message,
    this.reason,
    this.variant,
  });

  factory AiScanResult.fromJson(Map<String, dynamic> json) => AiScanResult(
    enabled: json['enabled'] as bool,
    message: json['message'] as String,
    reason: json['reason'] as String?,
    variant: json['variant'] as String?,
  );

  /// Whether the scan actually ran. False means `show-ai-scan` is not live for
  /// this site - a normal 200, not a failure.
  final bool enabled;

  /// Human-readable line, composed by the API.
  final String message;
  final String? reason;
  final String? variant;
}

/// Calls StartAIScan. The API evaluates `show-ai-scan` server-side for [site]
/// and decides there, so the decision cannot drift from the app's cache.
Future<AiScanResult> startAiScan(int amount, String email, String site) async {
  final json = await postJson('/api/ai-scan/start', 'StartAIScan', {
    'amount': amount,
    'email': email,
    'site': site,
  });
  return AiScanResult.fromJson(json);
}
