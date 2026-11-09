// Package userprofile serves the getUserProfile endpoint from an in-memory
// directory - the same directory, ids included, as sample-java-api, so either
// backend can sit behind sample-react without changing who anyone is in RUM.
package userprofile

import (
	"crypto/md5"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// Account is the organization a user belongs to.
//
// Shaped for Datadog RUM's setAccount: id is required there, and the remaining
// fields arrive as account.* attributes.
type Account struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Plan string `json:"plan"`
}

// UserProfile is the getUserProfile response body. Field names and order
// match sample-java-api's record.
type UserProfile struct {
	// Stable UUID for this user. Suitable as the Datadog RUM user id.
	ID          string   `json:"id"`
	Email       string   `json:"email"`
	FirstName   string   `json:"firstName"`
	LastName    string   `json:"lastName"`
	DisplayName string   `json:"displayName"`
	JobTitle    string   `json:"jobTitle"`
	Department  string   `json:"department"`
	Location    string   `json:"location"`
	AvatarURL   string   `json:"avatarUrl"`
	MemberSince string   `json:"memberSince"` // ISO date, as Jackson writes LocalDate
	Roles       []string `json:"roles"`
	Account     Account  `json:"account"`
}

// Lookup failures. The handler maps each to a status.
//
// Capitalized against Go convention on purpose: sample-react and the Flutter
// app show the message to the user verbatim, so it reads exactly as
// sample-java-api's does.
var (
	// ErrNotFound: no profile for the email, only in strict directory mode.
	ErrNotFound = errors.New("No user profile found")
	// ErrSimulatedError: demo hook, an email starting with "error" - 500 and an
	// ERROR log.
	ErrSimulatedError = errors.New("Profile lookup failed")
	// ErrSimulatedWarning: demo hook, an email starting with "warn" - 422 and a
	// WARN log.
	ErrSimulatedWarning = errors.New("Profile lookup rejected")
)

const (
	errorPrefix   = "error"
	warningPrefix = "warn"
)

// Shared by two seeded users, so account-level grouping in RUM has something
// to group.
var exampleCorp = Account{"acct-2002", "Example Corp", "pro"}

// Several users per account, so account-level grouping in RUM and Product
// Analytics has a spread to work with.
var (
	northwind = Account{"acct-3003", "Northwind Logistics", "enterprise"}
	contoso   = Account{"acct-3004", "Contoso Freight", "pro"}
	globex    = Account{"acct-3005", "Globex Supply", "pro"}
	initech   = Account{"acct-3006", "Initech Warehousing", "trial"}
	umbrella  = Account{"acct-3007", "Umbrella Transit", "trial"}
)

var directory = index(
	UserProfile{
		"db214327-40ea-4526-bed6-896c099f582c", "lloyd.williams@datadoghq.com", "Lloyd", "Williams", "Lloyd Williams",
		"Sales Engineer", "Technical Solutions", "Toronto, CA", "https://www.gravatar.com/avatar/lloyd?d=identicon",
		"2021-03-15", []string{"admin", "flag-editor"}, Account{"acct-1001", "Datadog", "enterprise"},
	},
	UserProfile{
		"28ea71b5-164b-4eb6-aef4-f4f793d4f086", "jane@example.com", "Jane", "Doe", "Jane Doe",
		"Platform Engineer", "Engineering", "Sydney, AU", "https://www.gravatar.com/avatar/jane?d=identicon",
		"2023-07-01", []string{"user"}, exampleCorp,
	},
	UserProfile{
		"9d3855e5-319d-44c0-b4a3-d885983c09bd", "sam@example.com", "Sam", "Rivera", "Sam Rivera",
		"Product Manager", "Product", "New York, US", "https://www.gravatar.com/avatar/sam?d=identicon",
		"2022-01-10", []string{"user", "flag-editor"}, exampleCorp,
	},
	seeded("79c1fb8c-31ad-478c-b47f-d6542e177d3b", "Amara Okonkwo", "amara.okonkwo@northwind.example", "Warehouse Supervisor", "Operations", "Toronto", "2021-04-05", northwind),
	seeded("f54b2714-ed76-4fa8-a3c7-d4701ce7e4de", "Devin Park", "devin.park@contoso.example", "Fleet Analyst", "Logistics", "Denver", "2021-09-27", contoso),
	seeded("663bf48c-290c-4b66-8dc0-1f0ff664e827", "Priya Raman", "priya.raman@globex.example", "Site Manager", "Operations", "Austin", "2025-12-06", globex),
	seeded("d0c5707c-10d3-4609-8add-b5ac8325714a", "Tomas Lindqvist", "tomas.lindqvist@initech.example", "Inventory Lead", "Supply Chain", "Chicago", "2022-01-24", initech),
	seeded("1b1e2fe9-50d4-4111-8e8d-608b05e9a9d4", "Noor Haddad", "noor.haddad@umbrella.example", "Platform Engineer", "Engineering", "Seattle", "2023-10-25", umbrella),
	seeded("06ec9ed2-c428-48c9-87c7-80062307898c", "Eli Brandt", "eli.brandt@northwind.example", "Data Analyst", "Analytics", "Montreal", "2025-02-28", northwind),
	seeded("942ce596-4565-4905-9e54-9736a3da45f4", "Marisol Vega", "marisol.vega@contoso.example", "Safety Officer", "Compliance", "Phoenix", "2025-04-27", contoso),
	seeded("bed6317d-6f24-49a6-b0f8-f7ab9a119b22", "Kenji Watanabe", "kenji.watanabe@globex.example", "Dispatch Coordinator", "Logistics", "Atlanta", "2022-04-12", globex),
	seeded("f72aeb3f-d48f-4dc0-9348-d45ca6227100", "Freya Nilsen", "freya.nilsen@initech.example", "Procurement Specialist", "Supply Chain", "Dallas", "2024-02-18", initech),
	seeded("d83c17ee-2b9e-4a24-bbc8-ccb43293f5a3", "Omar Benali", "omar.benali@umbrella.example", "Reliability Engineer", "Engineering", "Boston", "2024-10-24", umbrella),
	seeded("d7d3cc22-f851-48d1-b4b6-cf1aff95698d", "Lucia Ferraro", "lucia.ferraro@northwind.example", "Warehouse Supervisor", "Operations", "Portland", "2022-12-28", northwind),
	seeded("556b5527-25c1-4418-940c-e61e021f53de", "Dmitri Volkov", "dmitri.volkov@contoso.example", "Fleet Analyst", "Logistics", "Miami", "2023-09-16", contoso),
	seeded("b2ccb6da-1c37-4127-8ab0-86dec38e9163", "Aisha Mbeki", "aisha.mbeki@globex.example", "Site Manager", "Operations", "Vancouver", "2021-05-14", globex),
	seeded("e52e2423-3010-4072-92c9-bd1a27183ea6", "Callum Doyle", "callum.doyle@initech.example", "Inventory Lead", "Supply Chain", "Houston", "2025-01-02", initech),
	seeded("eb2688db-5116-4d70-b869-f395d1523404", "Hana Sato", "hana.sato@umbrella.example", "Platform Engineer", "Engineering", "Minneapolis", "2024-02-12", umbrella),
	seeded("315ccd6f-99ec-4203-8faa-407bc472f4c8", "Rafael Duarte", "rafael.duarte@northwind.example", "Data Analyst", "Analytics", "Toronto", "2022-11-27", northwind),
	seeded("0cbb1e90-481a-4a99-86f4-3f935bbe5c48", "Ingrid Sorensen", "ingrid.sorensen@contoso.example", "Safety Officer", "Compliance", "Denver", "2022-10-14", contoso),
	seeded("c91ce8d6-1e13-4b43-b17f-b6ae4410b3e4", "Yusuf Demir", "yusuf.demir@globex.example", "Dispatch Coordinator", "Logistics", "Austin", "2022-01-13", globex),
	seeded("1a6dd895-a972-4457-8d61-004fcc1d6c30", "Chloe Beaumont", "chloe.beaumont@initech.example", "Procurement Specialist", "Supply Chain", "Chicago", "2021-12-23", initech),
	seeded("7e882cdf-e782-45f2-91cd-9154d9374cb1", "Arjun Kapoor", "arjun.kapoor@umbrella.example", "Reliability Engineer", "Engineering", "Seattle", "2023-07-09", umbrella),
	seeded("0d742882-5531-4743-aa71-e1eb43701e9a", "Maja Kowalski", "maja.kowalski@northwind.example", "Warehouse Supervisor", "Operations", "Montreal", "2022-10-11", northwind),
	seeded("ea890da9-0ef3-4ff0-9603-7e62f4a8e302", "Theo Laurent", "theo.laurent@contoso.example", "Fleet Analyst", "Logistics", "Phoenix", "2021-10-03", contoso),
	seeded("5dff0484-c0af-4d25-ad18-e782822dcd44", "Zara Hussain", "zara.hussain@globex.example", "Site Manager", "Operations", "Atlanta", "2025-03-26", globex),
	seeded("4354ecf7-3aa0-42b6-9b1b-7d6d4514aebf", "Mateo Rossi", "mateo.rossi@initech.example", "Inventory Lead", "Supply Chain", "Dallas", "2021-05-25", initech),
	seeded("7499d5c4-1d90-4feb-b000-3500df87ea18", "Linnea Bergstrom", "linnea.bergstrom@umbrella.example", "Platform Engineer", "Engineering", "Boston", "2023-04-13", umbrella),
	seeded("2df7be8c-d726-4a3b-a1ae-2707160a0b60", "Idris Camara", "idris.camara@northwind.example", "Data Analyst", "Analytics", "Portland", "2022-07-21", northwind),
	seeded("5ad8d9c6-9412-4ea7-96cc-54ae06507c10", "Sofia Marchetti", "sofia.marchetti@contoso.example", "Safety Officer", "Compliance", "Miami", "2021-07-11", contoso),
	seeded("17eff6a6-41db-4eda-9e8e-6f4c793ed510", "Haruto Kobayashi", "haruto.kobayashi@globex.example", "Dispatch Coordinator", "Logistics", "Vancouver", "2022-09-08", globex),
	seeded("a3a59816-871d-4b6f-a614-c93721502d87", "Nadia Petrova", "nadia.petrova@initech.example", "Procurement Specialist", "Supply Chain", "Houston", "2024-12-12", initech),
	seeded("c6b9f5c4-aa13-426a-8acc-219a822f59ce", "Ethan Whitfield", "ethan.whitfield@umbrella.example", "Reliability Engineer", "Engineering", "Minneapolis", "2021-06-20", umbrella),
)

func index(profiles ...UserProfile) map[string]UserProfile {
	m := make(map[string]UserProfile, len(profiles))
	for _, p := range profiles {
		m[normalize(p.Email)] = p
	}
	return m
}

// seeded is the compact constructor for directory entries that take the
// common defaults: a single "user" role, and a gravatar derived from the first
// name.
func seeded(id, displayName, email, jobTitle, department, location, memberSince string, account Account) UserProfile {
	firstName, lastName, found := strings.Cut(displayName, " ")
	if !found {
		lastName = "User"
	}
	return UserProfile{
		id, email, firstName, lastName, displayName, jobTitle, department, location,
		"https://www.gravatar.com/avatar/" + strings.ToLower(firstName) + "?d=identicon",
		memberSince, []string{"user"}, account,
	}
}

// Service looks up profiles.
//
// Emails not present in the directory are answered with a profile derived from
// the address, so sample-react can sign in as anyone and still get a response.
// Set StrictDirectory to return ErrNotFound for unknown emails instead.
type Service struct {
	StrictDirectory bool
}

// GetUserProfile looks up the profile for email.
func (s Service) GetUserProfile(email string) (UserProfile, error) {
	key := normalize(email)

	// Demo hooks, checked before the directory so they work for any domain:
	// these two prefixes fail the request on purpose, which is what drives the
	// ERROR and WARN log lines in the handler.
	if strings.HasPrefix(key, errorPrefix) {
		return UserProfile{}, fmt.Errorf("%w for %s", ErrSimulatedError, email)
	}
	if strings.HasPrefix(key, warningPrefix) {
		return UserProfile{}, fmt.Errorf("%w for %s", ErrSimulatedWarning, email)
	}

	if p, ok := directory[key]; ok {
		return p, nil
	}
	if s.StrictDirectory {
		return UserProfile{}, fmt.Errorf("%w for email %s", ErrNotFound, email)
	}
	return derive(key), nil
}

var wordSeparators = regexp.MustCompile(`[._+-]+`)

// derive builds a plausible profile from the email's local part, e.g.
// "ada.lovelace" -> "Ada Lovelace".
func derive(email string) UserProfile {
	localPart, domain, _ := strings.Cut(email, "@")

	var words []string
	for _, w := range wordSeparators.Split(localPart, -1) {
		if strings.TrimSpace(w) != "" {
			words = append(words, capitalize(w))
		}
	}

	firstName, lastName := "Unknown", "User"
	if len(words) > 0 {
		firstName = words[0]
	}
	if len(words) > 1 {
		lastName = strings.Join(words[1:], " ")
	}

	return UserProfile{
		deriveID(email), email, firstName, lastName, firstName + " " + lastName,
		"Sample User", "Demo", "Remote",
		"https://www.gravatar.com/avatar/" + localPart + "?d=identicon",
		"2024-01-01", []string{"user"}, deriveAccount(domain),
	}
}

// deriveID returns a stable UUID for a derived profile, from the normalized
// email.
//
// Deliberately derived rather than random: a user id that changed on every
// request would give the same person a new identity each sign-in, fragmenting
// their sessions in RUM. Computed exactly as Java's UUID.nameUUIDFromBytes
// (MD5, version 3, no namespace), so sample-java-api and this API give the
// same person the same id.
func deriveID(email string) string {
	b := md5.Sum([]byte(email))
	b[6] = b[6]&0x0f | 0x30 // version 3
	b[8] = b[8]&0x3f | 0x80 // IETF variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// deriveAccount groups derived profiles by email domain, so everyone at
// "acme.io" shares account acct-acme-io named "Acme".
func deriveAccount(domain string) Account {
	if strings.TrimSpace(domain) == "" {
		return Account{"acct-unknown", "Unknown", "trial"}
	}
	first, _, _ := strings.Cut(domain, ".")
	return Account{"acct-" + strings.ReplaceAll(domain, ".", "-"), capitalize(first), "trial"}
}

func capitalize(word string) string {
	if word == "" {
		return word
	}
	return strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
}

func normalize(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
