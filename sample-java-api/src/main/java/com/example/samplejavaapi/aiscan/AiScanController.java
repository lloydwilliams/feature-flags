package com.example.samplejavaapi.aiscan;

import com.example.samplejavaapi.flags.FeatureFlags;
import dev.openfeature.sdk.FlagEvaluationDetails;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** StartAIScan: runs a scan if the AI scan feature is live for the caller's site. */
@RestController
@RequestMapping("/api/ai-scan")
public class AiScanController {

  private static final Logger log = LoggerFactory.getLogger(AiScanController.class);

  private final FeatureFlags featureFlags;
  private final String aiScanFlagKey;

  public AiScanController(
      FeatureFlags featureFlags,
      @Value("${sample.flags.ai-scan-key:show-ai-scan}") String aiScanFlagKey) {
    this.featureFlags = featureFlags;
    this.aiScanFlagKey = aiScanFlagKey;
  }

  /**
   * StartAIScan - {@code POST /api/ai-scan/start}.
   *
   * <p>Whether the scan runs is decided by the {@code show-ai-scan} flag evaluated for the caller's
   * site, so the same Datadog rule that shows the button in sample-react also governs the backend.
   *
   * <p>A gated-off scan is a 200 with {@code enabled: false}, not an error: nothing went wrong, the
   * feature is simply not live for that site, and the UI needs the message either way. Callers
   * should branch on {@code enabled} rather than the status code.
   */
  @PostMapping("/start")
  public AiScanResponse startAiScan(@Valid @RequestBody AiScanRequest request) {
    log.info(
        "StartAIScan requested for email={} site={} amount={}",
        request.email(),
        request.site(),
        request.amount());

    // Default false, so a provider that cannot be reached leaves the feature off
    // rather than announcing success it cannot back up.
    FlagEvaluationDetails<Boolean> flag =
        featureFlags.booleanDetails(aiScanFlagKey, false, request.email(), request.site());

    // errorCode as well as reason: reason ERROR alone does not say whether the
    // key is missing from the flag configuration or the provider failed, and
    // those need different fixes.
    log.debug(
        "StartAIScan flag {}={} (reason {}, errorCode {}) for site={}",
        aiScanFlagKey,
        flag.getValue(),
        flag.getReason(),
        flag.getErrorCode(),
        request.site());

    if (!Boolean.TRUE.equals(flag.getValue())) {
      log.info("StartAIScan not available at site={} amount={}", request.site(), request.amount());
      return AiScanResponse.disabled(request.site(), request.amount());
    }

    log.info("StartAIScan completed at site={} amount={}", request.site(), request.amount());
    return AiScanResponse.enabled(request.site(), request.amount());
  }
}
