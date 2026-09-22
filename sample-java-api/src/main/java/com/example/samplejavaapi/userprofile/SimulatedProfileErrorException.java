package com.example.samplejavaapi.userprofile;

/**
 * Demo hook: thrown for an email starting with "error", so the sample app can show a failed
 * sign-in and the API can emit an ERROR log on demand.
 */
public class SimulatedProfileErrorException extends RuntimeException {

  public SimulatedProfileErrorException(String email) {
    super("Profile lookup failed for " + email);
  }
}
