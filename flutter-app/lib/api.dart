import 'dart:async';
import 'dart:convert';

import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:datadog_tracking_http_client/datadog_tracking_http_client.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

/// Shared client for sample-java-api.
///
/// Requests go through `DatadogClient`, so each one is a RUM resource and -
/// because the API host is listed in `firstPartyHostsWithTracingHeaders` (see
/// main.dart) - carries trace headers the Java tracer continues. A tap and its
/// backend span land in one flame graph, as they do for sample-react.

/// Thrown for any failed API call.
///
/// Carries the HTTP status so callers can log a 4xx as a warning and a 5xx as
/// an error, mirroring how the API logs it. `status` is null when there was no
/// response at all - the API could not be reached.
class ApiError implements Exception {
  const ApiError(this.message, this.status);

  final String message;
  final int? status;

  @override
  String toString() => message;
}

/// Request timeout, so a stalled backend cannot hang the UI.
const _requestTimeout = Duration(seconds: 5);

http.Client? _client;

http.Client get _httpClient =>
    _client ??= DatadogClient(datadogSdk: DatadogSdk.instance);

/// Performs the call and unwraps failures into [ApiError].
///
/// [label] is the API operation name, so the message reads
/// "getUserProfile failed (500): …" rather than naming a URL.
Future<Map<String, dynamic>> _request(
  String label,
  Future<http.Response> Function(http.Client client) send,
) async {
  final http.Response response;
  try {
    response = await send(_httpClient).timeout(_requestTimeout);
  } on TimeoutException {
    throw ApiError('$label timed out calling $apiBaseUrl.', null);
  } catch (_) {
    throw ApiError(
      'Could not reach the API at $apiBaseUrl. Is sample-java-api running?',
      null,
    );
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    // The API sends a JSON error body, but a proxy or 500 may not.
    String? detail;
    try {
      detail =
          (jsonDecode(response.body) as Map<String, dynamic>)['message']
              as String?;
    } catch (_) {}
    throw ApiError(
      detail != null
          ? '$label failed (${response.statusCode}): $detail'
          : '$label failed (${response.statusCode})',
      response.statusCode,
    );
  }

  return jsonDecode(response.body) as Map<String, dynamic>;
}

Uri _uri(String path, [Map<String, String>? query]) =>
    Uri.parse('$apiBaseUrl$path').replace(queryParameters: query);

Future<Map<String, dynamic>> getJson(
  String path,
  String label, [
  Map<String, String>? query,
]) {
  return _request(
    label,
    (client) =>
        client.get(_uri(path, query), headers: {'Accept': 'application/json'}),
  );
}

Future<Map<String, dynamic>> postJson(String path, String label, Object body) {
  return _request(
    label,
    (client) => client.post(
      _uri(path),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(body),
    ),
  );
}
