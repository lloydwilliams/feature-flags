package com.example.samplejavaapi.flags;

import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.EvaluationContext;
import dev.openfeature.sdk.FlagEvaluationDetails;
import dev.openfeature.sdk.ImmutableContext;
import dev.openfeature.sdk.Value;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Evaluates server-side feature flags for one user.
 *
 * <p>The targeting key is the email, matching what sample-react sends to the browser provider, so
 * a rule written once in Datadog targets the same person on both sides of the call.
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
      String flagKey, boolean defaultValue, String email) {
    return client.getBooleanDetails(flagKey, defaultValue, contextFor(email));
  }

  /** Convenience for call sites that only need the value. */
  public boolean isEnabled(String flagKey, boolean defaultValue, String email) {
    return booleanDetails(flagKey, defaultValue, email).getValue();
  }

  private static EvaluationContext contextFor(String email) {
    String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    return new ImmutableContext(normalized, Map.of("email", new Value(normalized)));
  }
}
