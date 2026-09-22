package com.example.samplejavaapi.userprofile;

import com.example.samplejavaapi.flags.FeatureFlags;
import dev.openfeature.sdk.FlagEvaluationDetails;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.propertyeditors.StringTrimmerEditor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** REST endpoints for user profiles. */
@RestController
@RequestMapping("/api/users")
@Validated
public class UserProfileController {

  private static final Logger log = LoggerFactory.getLogger(UserProfileController.class);

  private final UserProfileService userProfileService;
  private final FeatureFlags featureFlags;
  private final String readoutFlagKey;

  public UserProfileController(
      UserProfileService userProfileService,
      FeatureFlags featureFlags,
      @Value("${sample.flags.readout-key:show-new-feature}") String readoutFlagKey) {
    this.userProfileService = userProfileService;
    this.featureFlags = featureFlags;
    this.readoutFlagKey = readoutFlagKey;
  }

  /** Trims incoming query params so " jane@example.com " passes email validation. */
  @InitBinder
  void trimStrings(WebDataBinder binder) {
    binder.registerCustomEditor(String.class, new StringTrimmerEditor(false));
  }

  /**
   * getUserProfile - returns the profile for the given email address.
   *
   * <p>{@code GET /api/users/profile?email=jane@example.com}
   */
  @GetMapping("/profile")
  public UserProfile getUserProfile(
      @RequestParam("email") @NotBlank @Email(message = "must be a valid email address")
          String email) {
    log.info("getUserProfile requested for email={}", email);

    UserProfile profile = userProfileService.getUserProfile(email);

    // Server-side flag readout, the counterpart to sample-react's on-screen one:
    // `reason` is what tells a flag that is off apart from one that does not
    // exist or could not be fetched. Nothing is gated on it yet.
    FlagEvaluationDetails<Boolean> flag =
        featureFlags.booleanDetails(readoutFlagKey, false, email);

    // What was actually resolved, at DEBUG so the INFO line above stays the
    // one-per-request summary. Not reached when the lookup throws.
    log.debug(
        "getUserProfile resolved email={} displayName={} account={} plan={} roles={} flag {}={} (reason {})",
        email,
        profile.displayName(),
        profile.account().id(),
        profile.account().plan(),
        profile.roles(),
        readoutFlagKey,
        flag.getValue(),
        flag.getReason());

    return profile;
  }
}
