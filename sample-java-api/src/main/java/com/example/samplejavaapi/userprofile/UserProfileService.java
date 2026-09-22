package com.example.samplejavaapi.userprofile;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Serves user profiles from an in-memory directory.
 *
 * <p>Emails not present in the directory are answered with a profile derived from the address, so
 * the sample React app can sign in as anyone and still get a response. Set
 * {@code sample.profile.strict-directory=true} to return 404 for unknown emails instead.
 */
@Service
public class UserProfileService {

  /** Shared by two seeded users, so account-level grouping in RUM has something to group. */
  private static final Account EXAMPLE_CORP = new Account("acct-2002", "Example Corp", "pro");

  private static final Map<String, UserProfile> DIRECTORY =
      Stream.of(
              new UserProfile(
                  "lloyd.williams@datadoghq.com",
                  "Lloyd",
                  "Williams",
                  "Lloyd Williams",
                  "Sales Engineer",
                  "Technical Solutions",
                  "Toronto, CA",
                  "https://www.gravatar.com/avatar/lloyd?d=identicon",
                  LocalDate.of(2021, 3, 15),
                  List.of("admin", "flag-editor"),
                  new Account("acct-1001", "Datadog", "enterprise")),
              new UserProfile(
                  "jane@example.com",
                  "Jane",
                  "Doe",
                  "Jane Doe",
                  "Platform Engineer",
                  "Engineering",
                  "Sydney, AU",
                  "https://www.gravatar.com/avatar/jane?d=identicon",
                  LocalDate.of(2023, 7, 1),
                  List.of("user"),
                  EXAMPLE_CORP),
              new UserProfile(
                  "sam@example.com",
                  "Sam",
                  "Rivera",
                  "Sam Rivera",
                  "Product Manager",
                  "Product",
                  "New York, US",
                  "https://www.gravatar.com/avatar/sam?d=identicon",
                  LocalDate.of(2022, 1, 10),
                  List.of("user", "flag-editor"),
                  EXAMPLE_CORP))
          .collect(Collectors.toUnmodifiableMap(p -> normalize(p.email()), p -> p));

  private final boolean strictDirectory;

  public UserProfileService(
      @Value("${sample.profile.strict-directory:false}") boolean strictDirectory) {
    this.strictDirectory = strictDirectory;
  }

  /**
   * Looks up the profile for {@code email}.
   *
   * @throws UserProfileNotFoundException when strict directory mode is on and the email is unknown
   */
  public UserProfile getUserProfile(String email) {
    String key = normalize(email);
    return Optional.ofNullable(DIRECTORY.get(key))
        .orElseGet(
            () -> {
              if (strictDirectory) {
                throw new UserProfileNotFoundException(email);
              }
              return derive(key);
            });
  }

  /** Builds a plausible profile from the email's local part, e.g. "ada.lovelace" -> "Ada Lovelace". */
  private static UserProfile derive(String email) {
    int at = email.indexOf('@');
    String localPart = at >= 0 ? email.substring(0, at) : email;
    String domain = at >= 0 ? email.substring(at + 1) : "";
    List<String> words =
        Stream.of(localPart.split("[._+-]+"))
            .filter(word -> !word.isBlank())
            .map(UserProfileService::capitalize)
            .toList();

    String firstName = words.isEmpty() ? "Unknown" : words.get(0);
    String lastName = words.size() > 1 ? String.join(" ", words.subList(1, words.size())) : "User";

    return new UserProfile(
        email,
        firstName,
        lastName,
        firstName + " " + lastName,
        "Sample User",
        "Demo",
        "Remote",
        "https://www.gravatar.com/avatar/" + localPart + "?d=identicon",
        LocalDate.of(2024, 1, 1),
        List.of("user"),
        deriveAccount(domain));
  }

  /**
   * Groups derived profiles by email domain, so everyone at "acme.io" shares account
   * {@code acct-acme-io} named "Acme".
   */
  private static Account deriveAccount(String domain) {
    if (domain.isBlank()) {
      return new Account("acct-unknown", "Unknown", "trial");
    }
    String name = capitalize(domain.split("\\.")[0]);
    return new Account("acct-" + domain.replace('.', '-'), name, "trial");
  }

  private static String capitalize(String word) {
    return word.substring(0, 1).toUpperCase(Locale.ROOT) + word.substring(1).toLowerCase(Locale.ROOT);
  }

  private static String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
