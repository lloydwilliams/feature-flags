package com.example.samplejavaapi.userprofile;

/** Thrown when no profile exists for the requested email address. */
public class UserProfileNotFoundException extends RuntimeException {

  public UserProfileNotFoundException(String email) {
    super("No user profile found for email " + email);
  }
}
