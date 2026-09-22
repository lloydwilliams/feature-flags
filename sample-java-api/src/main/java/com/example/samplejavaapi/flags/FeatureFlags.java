package com.example.samplejavaapi.flags;

import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.EvaluationContext;
import dev.openfeature.sdk.FlagEvaluationDetails;
import dev.openfeature.sdk.ImmutableContext;
import dev.openfeature.sdk.Value;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Evaluates server-side feature flags for one user.
 *
 * <p>The context mirrors what sample-react sends to the browser provider: targeting key the email,
 * plus flat {@code email} and {@code site} attributes. Those flat names are what Datadog targeting
 * rules reference, so one rule written once applies on both sides of the call - {@code
 * show-new-feature} targets on {@code site}, which is why the API has to be told which site the
 * user picked rather than inferring anything.
 */
@Service
public class FeatureFlags {

  private final Client client;

  public FeatureFlags(Client client) {
    this.client = client;
  }

  /**
   * Evaluates a boolean flag, returning the details rather than the bare value: {@code reason}
   * distinguishes a flag that is off from one that does not exist or could not be resolved, which
   * is the difference between "working" and "silently defaulting".
   */
  public FlagEvaluationDetails<Boolean> booleanDetails(
      String flagKey, boolean defaultValue, String email, String site) {
    return client.getBooleanDetails(flagKey, defaultValue, contextFor(email, site));
  }

  /** Convenience for call sites that only need the value. */
  public boolean isEnabled(String flagKey, boolean defaultValue, String email, String site) {
    return booleanDetails(flagKey, defaultValue, email, site).getValue();
  }

  /**
   * Builds the evaluation context.
   *
   * <p>{@code site} is omitted entirely when the caller did not supply one, rather than sent as an
   * empty string: a rule matching on site should then miss, not match a blank value.
   */
  private static EvaluationContext contextFor(String email, String site) {
    String normalizedEmail = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);

    Map<String, Value> attributes = new LinkedHashMap<>();
    attributes.put("email", new Value(normalizedEmail));
    if (site != null && !site.isBlank()) {
      // Not lower-cased: the UI sends display names like "Toronto", and Datadog
      // targeting compares exact strings, so folding case here would stop rules
      // written against the values in the drop-down from matching.
      attributes.put("site", new Value(site.trim()));
    }

    return new ImmutableContext(normalizedEmail, attributes);
  }
}
