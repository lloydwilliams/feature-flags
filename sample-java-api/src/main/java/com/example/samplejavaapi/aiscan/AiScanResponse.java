package com.example.samplejavaapi.aiscan;

/**
 * Result of a StartAIScan call.
 *
 * <p>{@code message} is the human-readable line for the UI. The other fields carry the same facts
 * in structured form, so a caller can branch on {@code enabled} without matching on message text.
 *
 * <p>{@code reason} and {@code variant} come straight from the flag evaluation, and are what
 * explain a decision rather than just stating it: {@code TARGETING_MATCH} means a rule named this
 * site, {@code SPLIT} means the caller fell into a percentage rollout - with {@code variant}
 * naming the bucket - and {@code STATIC} means neither applied and the flag's own value was used.
 *
 * <p>Datadog populates {@code variant} for boolean flags too, as the strings "true" and "false",
 * so it is usually present rather than null. Jackson is configured to omit nulls, so a provider
 * that supplies none leaves the field out of the response entirely.
 */
public record AiScanResponse(
    boolean enabled, String site, int amount, String reason, String variant, String message) {

  public static AiScanResponse enabled(String site, int amount, String reason, String variant) {
    return new AiScanResponse(
        true, site, amount, reason, variant, "AI Scan Successful at site: " + site);
  }

  public static AiScanResponse disabled(String site, int amount, String reason, String variant) {
    return new AiScanResponse(
        false,
        site,
        amount,
        reason,
        variant,
        "Sorry this feature is not available at this site yet: " + site);
  }
}
