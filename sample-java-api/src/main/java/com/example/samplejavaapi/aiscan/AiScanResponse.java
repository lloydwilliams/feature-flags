package com.example.samplejavaapi.aiscan;

/**
 * Result of a StartAIScan call.
 *
 * <p>{@code message} is the human-readable line for the UI. The other fields carry the same facts
 * in structured form, so a caller can branch on {@code enabled} without matching on message text.
 */
public record AiScanResponse(boolean enabled, String site, int amount, String message) {

  public static AiScanResponse enabled(String site, int amount) {
    return new AiScanResponse(true, site, amount, "AI Scan Successful at site: " + site);
  }

  public static AiScanResponse disabled(String site, int amount) {
    return new AiScanResponse(
        false, site, amount, "Sorry this feature is not available at this site yet: " + site);
  }
}
