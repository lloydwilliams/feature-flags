package com.example.samplejavaapi.userprofile;

/**
 * Demo hook: thrown for an email starting with "warn", so the sample app can show a rejected
 * sign-in and the API can emit a WARN log on demand.
 */
public class SimulatedProfileWarningException extends RuntimeException {

  public SimulatedProfileWarningException(String email) {
    super("Profile lookup rejected for " + email);
  }
}
