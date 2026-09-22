package com.example.samplejavaapi.userprofile;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

  public UserProfileController(UserProfileService userProfileService) {
    this.userProfileService = userProfileService;
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
    return userProfileService.getUserProfile(email);
  }
}
