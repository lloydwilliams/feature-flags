package com.example.samplejavaapi.userprofile;

import java.time.LocalDate;
import java.util.List;

/** A user profile returned by the getUserProfile endpoint. */
public record UserProfile(
    String email,
    String firstName,
    String lastName,
    String displayName,
    String jobTitle,
    String department,
    String location,
    String avatarUrl,
    LocalDate memberSince,
    List<String> roles,
    Account account) {}
