# sample-java-api

Spring Boot 3.5 / Java 17 REST backend for the `sample-react` app, built with Apache Maven.

## Run

```bash
./sample-java-api/run-sample-java-api.sh
```

Listens on `http://localhost:8080`. Health check: `http://localhost:8080/actuator/health`.

Tests:

```bash
cd sample-java-api && mvn test
```

## getUserProfile

`GET /api/users/profile?email={email}`

```bash
curl "http://localhost:8080/api/users/profile?email=jane@example.com"
```

```json
{
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "displayName": "Jane Doe",
  "jobTitle": "Platform Engineer",
  "department": "Engineering",
  "location": "Sydney, AU",
  "avatarUrl": "https://www.gravatar.com/avatar/jane?d=identicon",
  "memberSince": "2023-07-01",
  "roles": ["user"]
}
```

Responses:

| Status | When |
| --- | --- |
| 200 | Profile found (or derived — see below) |
| 400 | `email` missing or not a valid address |
| 404 | Unknown email, only in strict directory mode |

Errors return `{"status":..., "error":..., "message":...}`.

### Profile data

Profiles come from an in-memory directory in
[UserProfileService.java](src/main/java/com/example/samplejavaapi/userprofile/UserProfileService.java):
`lloyd.williams@datadoghq.com`, `jane@example.com`, `sam@example.com`. Lookup is
case-insensitive and whitespace is trimmed.

Any other email gets a profile derived from its local part (`ada.lovelace@acme.io` →
"Ada Lovelace"), so you can sign into `sample-react` as anyone and still get a 200. To
return 404 for unknown emails instead, set in `application.yml`:

```yaml
sample:
  profile:
    strict-directory: true
```

## Calling it from sample-react

CORS already allows the Vite dev server origins `http://localhost:5174` (the port in
`sample-react/vite.config.ts`) and `http://localhost:5173`. Add more under
`sample.cors.allowed-origins` in
[application.yml](src/main/resources/application.yml).

From the React app, a button handler needs no more than:

```ts
const res = await fetch(
  `http://localhost:8080/api/users/profile?email=${encodeURIComponent(email)}`,
)
if (!res.ok) throw new Error(`getUserProfile failed: ${res.status}`)
const profile = await res.json()
```

## Layout

```
sample-java-api/
├── pom.xml
├── run-sample-java-api.sh
└── src/
    ├── main/java/com/example/samplejavaapi/
    │   ├── SampleJavaApiApplication.java
    │   ├── userprofile/          # UserProfile, service, controller, not-found exception
    │   └── web/                  # CORS config, JSON error handler
    ├── main/resources/application.yml
    └── test/java/com/example/samplejavaapi/userprofile/
```
