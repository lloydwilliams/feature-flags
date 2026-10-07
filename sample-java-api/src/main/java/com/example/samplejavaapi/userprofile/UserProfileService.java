package com.example.samplejavaapi.userprofile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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

  /** Email prefix that makes a lookup fail with a 500 and an ERROR log. */
  private static final String ERROR_PREFIX = "error";

  /** Email prefix that makes a lookup fail with a 422 and a WARN log. */
  private static final String WARNING_PREFIX = "warn";

  /** Shared by two seeded users, so account-level grouping in RUM has something to group. */
  private static final Account EXAMPLE_CORP = new Account("acct-2002", "Example Corp", "pro");

  // Several users per account, so account-level grouping in RUM and Product
  // Analytics has a spread to work with.
  private static final Account NORTHWIND =
      new Account("acct-3003", "Northwind Logistics", "enterprise");
  private static final Account CONTOSO =
      new Account("acct-3004", "Contoso Freight", "pro");
  private static final Account GLOBEX =
      new Account("acct-3005", "Globex Supply", "pro");
  private static final Account INITECH =
      new Account("acct-3006", "Initech Warehousing", "trial");
  private static final Account UMBRELLA =
      new Account("acct-3007", "Umbrella Transit", "trial");

  private static final Map<String, UserProfile> DIRECTORY =
      Stream.of(
              new UserProfile(
                  "db214327-40ea-4526-bed6-896c099f582c",
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
                  "28ea71b5-164b-4eb6-aef4-f4f793d4f086",
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
                  "9d3855e5-319d-44c0-b4a3-d885983c09bd",
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
                  EXAMPLE_CORP),
              seeded(
                  "79c1fb8c-31ad-478c-b47f-d6542e177d3b",
                  "Amara Okonkwo",
                  "amara.okonkwo@northwind.example",
                  "Warehouse Supervisor",
                  "Operations",
                  "Toronto",
                  "2021-04-05",
                  NORTHWIND),
              seeded(
                  "f54b2714-ed76-4fa8-a3c7-d4701ce7e4de",
                  "Devin Park",
                  "devin.park@contoso.example",
                  "Fleet Analyst",
                  "Logistics",
                  "Denver",
                  "2021-09-27",
                  CONTOSO),
              seeded(
                  "663bf48c-290c-4b66-8dc0-1f0ff664e827",
                  "Priya Raman",
                  "priya.raman@globex.example",
                  "Site Manager",
                  "Operations",
                  "Austin",
                  "2025-12-06",
                  GLOBEX),
              seeded(
                  "d0c5707c-10d3-4609-8add-b5ac8325714a",
                  "Tomas Lindqvist",
                  "tomas.lindqvist@initech.example",
                  "Inventory Lead",
                  "Supply Chain",
                  "Chicago",
                  "2022-01-24",
                  INITECH),
              seeded(
                  "1b1e2fe9-50d4-4111-8e8d-608b05e9a9d4",
                  "Noor Haddad",
                  "noor.haddad@umbrella.example",
                  "Platform Engineer",
                  "Engineering",
                  "Seattle",
                  "2023-10-25",
                  UMBRELLA),
              seeded(
                  "06ec9ed2-c428-48c9-87c7-80062307898c",
                  "Eli Brandt",
                  "eli.brandt@northwind.example",
                  "Data Analyst",
                  "Analytics",
                  "Montreal",
                  "2025-02-28",
                  NORTHWIND),
              seeded(
                  "942ce596-4565-4905-9e54-9736a3da45f4",
                  "Marisol Vega",
                  "marisol.vega@contoso.example",
                  "Safety Officer",
                  "Compliance",
                  "Phoenix",
                  "2025-04-27",
                  CONTOSO),
              seeded(
                  "bed6317d-6f24-49a6-b0f8-f7ab9a119b22",
                  "Kenji Watanabe",
                  "kenji.watanabe@globex.example",
                  "Dispatch Coordinator",
                  "Logistics",
                  "Atlanta",
                  "2022-04-12",
                  GLOBEX),
              seeded(
                  "f72aeb3f-d48f-4dc0-9348-d45ca6227100",
                  "Freya Nilsen",
                  "freya.nilsen@initech.example",
                  "Procurement Specialist",
                  "Supply Chain",
                  "Dallas",
                  "2024-02-18",
                  INITECH),
              seeded(
                  "d83c17ee-2b9e-4a24-bbc8-ccb43293f5a3",
                  "Omar Benali",
                  "omar.benali@umbrella.example",
                  "Reliability Engineer",
                  "Engineering",
                  "Boston",
                  "2024-10-24",
                  UMBRELLA),
              seeded(
                  "d7d3cc22-f851-48d1-b4b6-cf1aff95698d",
                  "Lucia Ferraro",
                  "lucia.ferraro@northwind.example",
                  "Warehouse Supervisor",
                  "Operations",
                  "Portland",
                  "2022-12-28",
                  NORTHWIND),
              seeded(
                  "556b5527-25c1-4418-940c-e61e021f53de",
                  "Dmitri Volkov",
                  "dmitri.volkov@contoso.example",
                  "Fleet Analyst",
                  "Logistics",
                  "Miami",
                  "2023-09-16",
                  CONTOSO),
              seeded(
                  "b2ccb6da-1c37-4127-8ab0-86dec38e9163",
                  "Aisha Mbeki",
                  "aisha.mbeki@globex.example",
                  "Site Manager",
                  "Operations",
                  "Vancouver",
                  "2021-05-14",
                  GLOBEX),
              seeded(
                  "e52e2423-3010-4072-92c9-bd1a27183ea6",
                  "Callum Doyle",
                  "callum.doyle@initech.example",
                  "Inventory Lead",
                  "Supply Chain",
                  "Houston",
                  "2025-01-02",
                  INITECH),
              seeded(
                  "eb2688db-5116-4d70-b869-f395d1523404",
                  "Hana Sato",
                  "hana.sato@umbrella.example",
                  "Platform Engineer",
                  "Engineering",
                  "Minneapolis",
                  "2024-02-12",
                  UMBRELLA),
              seeded(
                  "315ccd6f-99ec-4203-8faa-407bc472f4c8",
                  "Rafael Duarte",
                  "rafael.duarte@northwind.example",
                  "Data Analyst",
                  "Analytics",
                  "Toronto",
                  "2022-11-27",
                  NORTHWIND),
              seeded(
                  "0cbb1e90-481a-4a99-86f4-3f935bbe5c48",
                  "Ingrid Sorensen",
                  "ingrid.sorensen@contoso.example",
                  "Safety Officer",
                  "Compliance",
                  "Denver",
                  "2022-10-14",
                  CONTOSO),
              seeded(
                  "c91ce8d6-1e13-4b43-b17f-b6ae4410b3e4",
                  "Yusuf Demir",
                  "yusuf.demir@globex.example",
                  "Dispatch Coordinator",
                  "Logistics",
                  "Austin",
                  "2022-01-13",
                  GLOBEX),
              seeded(
                  "1a6dd895-a972-4457-8d61-004fcc1d6c30",
                  "Chloe Beaumont",
                  "chloe.beaumont@initech.example",
                  "Procurement Specialist",
                  "Supply Chain",
                  "Chicago",
                  "2021-12-23",
                  INITECH),
              seeded(
                  "7e882cdf-e782-45f2-91cd-9154d9374cb1",
                  "Arjun Kapoor",
                  "arjun.kapoor@umbrella.example",
                  "Reliability Engineer",
                  "Engineering",
                  "Seattle",
                  "2023-07-09",
                  UMBRELLA),
              seeded(
                  "0d742882-5531-4743-aa71-e1eb43701e9a",
                  "Maja Kowalski",
                  "maja.kowalski@northwind.example",
                  "Warehouse Supervisor",
                  "Operations",
                  "Montreal",
                  "2022-10-11",
                  NORTHWIND),
              seeded(
                  "ea890da9-0ef3-4ff0-9603-7e62f4a8e302",
                  "Theo Laurent",
                  "theo.laurent@contoso.example",
                  "Fleet Analyst",
                  "Logistics",
                  "Phoenix",
                  "2021-10-03",
                  CONTOSO),
              seeded(
                  "5dff0484-c0af-4d25-ad18-e782822dcd44",
                  "Zara Hussain",
                  "zara.hussain@globex.example",
                  "Site Manager",
                  "Operations",
                  "Atlanta",
                  "2025-03-26",
                  GLOBEX),
              seeded(
                  "4354ecf7-3aa0-42b6-9b1b-7d6d4514aebf",
                  "Mateo Rossi",
                  "mateo.rossi@initech.example",
                  "Inventory Lead",
                  "Supply Chain",
                  "Dallas",
                  "2021-05-25",
                  INITECH),
              seeded(
                  "7499d5c4-1d90-4feb-b000-3500df87ea18",
                  "Linnea Bergstrom",
                  "linnea.bergstrom@umbrella.example",
                  "Platform Engineer",
                  "Engineering",
                  "Boston",
                  "2023-04-13",
                  UMBRELLA),
              seeded(
                  "2df7be8c-d726-4a3b-a1ae-2707160a0b60",
                  "Idris Camara",
                  "idris.camara@northwind.example",
                  "Data Analyst",
                  "Analytics",
                  "Portland",
                  "2022-07-21",
                  NORTHWIND),
              seeded(
                  "5ad8d9c6-9412-4ea7-96cc-54ae06507c10",
                  "Sofia Marchetti",
                  "sofia.marchetti@contoso.example",
                  "Safety Officer",
                  "Compliance",
                  "Miami",
                  "2021-07-11",
                  CONTOSO),
              seeded(
                  "17eff6a6-41db-4eda-9e8e-6f4c793ed510",
                  "Haruto Kobayashi",
                  "haruto.kobayashi@globex.example",
                  "Dispatch Coordinator",
                  "Logistics",
                  "Vancouver",
                  "2022-09-08",
                  GLOBEX),
              seeded(
                  "a3a59816-871d-4b6f-a614-c93721502d87",
                  "Nadia Petrova",
                  "nadia.petrova@initech.example",
                  "Procurement Specialist",
                  "Supply Chain",
                  "Houston",
                  "2024-12-12",
                  INITECH),
              seeded(
                  "c6b9f5c4-aa13-426a-8acc-219a822f59ce",
                  "Ethan Whitfield",
                  "ethan.whitfield@umbrella.example",
                  "Reliability Engineer",
                  "Engineering",
                  "Minneapolis",
                  "2021-06-20",
                  UMBRELLA))
          .collect(Collectors.toUnmodifiableMap(p -> normalize(p.email()), p -> p));

  /**
   * Compact constructor for directory entries that take the common defaults:
   * a single "user" role, and a gravatar derived from the first name.
   */
  private static UserProfile seeded(
      String id,
      String displayName,
      String email,
      String jobTitle,
      String department,
      String location,
      String memberSince,
      Account account) {
    int space = displayName.indexOf(' ');
    String firstName = space > 0 ? displayName.substring(0, space) : displayName;
    String lastName = space > 0 ? displayName.substring(space + 1) : "User";
    return new UserProfile(
        id,
        email,
        firstName,
        lastName,
        displayName,
        jobTitle,
        department,
        location,
        "https://www.gravatar.com/avatar/" + firstName.toLowerCase(Locale.ROOT) + "?d=identicon",
        LocalDate.parse(memberSince),
        List.of("user"),
        account);
  }

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

    // Demo hooks, checked before the directory so they work for any domain:
    // these two prefixes fail the request on purpose, which is what drives the
    // ERROR and WARN log lines in ApiExceptionHandler.
    if (key.startsWith(ERROR_PREFIX)) {
      throw new SimulatedProfileErrorException(email);
    }
    if (key.startsWith(WARNING_PREFIX)) {
      throw new SimulatedProfileWarningException(email);
    }

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
        deriveId(email),
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
   * Stable UUID for a derived profile, from the normalized email.
   *
   * Deliberately derived rather than random: a user id that changed on every
   * request would give the same person a new identity each sign-in, fragmenting
   * their sessions in RUM. Same 8-4-4-4-12 shape as the seeded ids.
   */
  private static String deriveId(String email) {
    return UUID.nameUUIDFromBytes(email.getBytes(StandardCharsets.UTF_8)).toString();
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
