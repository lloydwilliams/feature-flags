# sample-java-api

Spring Boot 3.5 / Java 17 REST backend for the `sample-react` app, built with Apache Maven.

## Build

```bash
mvn -f sample-java-api/pom.xml clean package
```

Produces the executable jar `sample-java-api/target/sample-java-api.jar` (~25 MB, with
Tomcat and dependencies inside). Use `clean install` instead to also install it into your
local `~/.m2` repository as `com.example:sample-java-api:0.0.1-SNAPSHOT`.

`clean package` runs the tests. To run just those:

```bash
mvn -f sample-java-api/pom.xml test
```

## Run

```bash
./sample-java-api/run-sample-java-api.sh
```

Runs the jar, building it first if it is missing. It does **not** rebuild a jar that is
already there, so run the build above after changing the code.

Or run it directly:

```bash
java -jar sample-java-api/target/sample-java-api.jar
```

Listens on `http://localhost:8080`. Health check: `http://localhost:8080/actuator/health`.

## getUserProfile

`GET /api/users/profile?email={email}&site={site}`

```bash
curl "http://localhost:8080/api/users/profile?email=jane@example.com&site=Toronto"
```

`site` is the value chosen in the `sample-react` drop-down. It is optional and does **not**
change the profile returned — it is passed purely so server-side flag rules can target on
it. See [Server-side feature flags](#server-side-feature-flags).

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
  "roles": ["user"],
  "account": {
    "id": "acct-2002",
    "name": "Example Corp",
    "plan": "pro"
  }
}
```

`account` is shaped for Datadog RUM's `setAccount`, which `sample-react` calls once the
profile comes back. `jane@` and `sam@` deliberately share `acct-2002` so account-level
grouping has something to group; derived profiles get an account per email domain
(`ada@acme.io` → `acct-acme-io`, "Acme").

Responses:

| Status | When |
| --- | --- |
| 200 | Profile found (or derived — see below) |
| 400 | `email` missing or not a valid address |
| 404 | Unknown email, only in strict directory mode |
| 422 | Email starts with `warn` — demo hook, logs a WARN |
| 500 | Email starts with `error` — demo hook, logs an ERROR |

Errors return `{"status":..., "error":..., "message":...}`.

### Demo failure hooks

Two email prefixes fail on purpose, so a demo can produce a failed sign-in and a log line
at a chosen level without touching the code:

| Email | Result |
| --- | --- |
| `error@example.com`, `error.anything@…` | 500, ERROR log with a stack trace |
| `warn@example.com`, `warning.anything@…` | 422, WARN log, no stack trace |

The check is on the start of the address and is case-insensitive, so `ERROR@…` works and
`terror.fan@…` does not. Defined in
[UserProfileService.java](src/main/java/com/example/samplejavaapi/userprofile/UserProfileService.java);
the log lines come from
[ApiExceptionHandler.java](src/main/java/com/example/samplejavaapi/web/ApiExceptionHandler.java).

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

## Logs

Every call to `getUserProfile` writes to `sample-java-api/logs/sample-java-api.log`. The
console and the file use the same pattern.

| Call | Lines written |
| --- | --- |
| Normal | INFO (request) + DEBUG (what was resolved) |
| Email starts with `error` | INFO + ERROR, with a stack trace |
| Email starts with `warn` | INFO + WARN |

The DEBUG line only appears because `logback-spring.xml` sets this app's package to
`debug`; the root stays at `info` so Spring's own debug output is not swept in.

```
2026-09-22T18:14:17.793-0400 INFO  [http-nio-8080-exec-2] [c.e.s.u.UserProfileController getUserProfile:45] [16638388692058845321] [6626893373907206351] getUserProfile requested for email=lloyd.williams@datadoghq.com
```

The two bracketed ids are `dd.trace_id` and `dd.span_id`, read from MDC where
`-Ddd.logs.injection=true` in [run-sample-java-api.sh](run-sample-java-api.sh) puts
them. Because `sample-react` propagates its trace id on the way in, that first id ties
the line back to the RUM session that triggered the call. Requests that arrive without a
trace, and startup lines, show empty brackets.

Everything — appenders, pattern, levels, rotation — is in
[logback-spring.xml](src/main/resources/logback-spring.xml). It rolls daily and at 10MB
into `logs/archived/`, keeping 7 days up to 100MB. `logs/` is gitignored. Tests use
[logback-test.xml](src/test/resources/logback-test.xml) and log to the
console only, so `mvn test` never appends to the file the Agent is tailing.

To ship these to Datadog, point the Agent at the file — `service` must match
`dd.service` for correlation to hold:

```yaml
logs:
  - type: file
    path: /absolute/path/to/sample-java-api/logs/sample-java-api.log
    service: sample-app
    source: java
```

Two things a pattern needs that JSON did not:

- **A grok rule.** `source: java` applies the built-in Java pipeline, but the bracketed
  trace and span ids are not where it expects them, so map them to `dd.trace_id` and
  `dd.span_id` yourself if you want logs and traces linked in the UI.
- **A multiline rule**, because the ERROR hook logs a stack trace. Without it each `at …`
  frame ships as its own log:

  ```yaml
      log_processing_rules:
        - type: multi_line
          name: new_log_start_with_timestamp
          pattern: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}
  ```

## Runtime metrics

The tracer reports JVM runtime metrics — `jvm.heap_memory`, `jvm.gc.*`,
`jvm.cpu_load.*`, `jvm.thread_count` and the rest — tagged with `service`, `env`,
`version`, and `runtime-id`, which is what links them to this service's traces.

These are on by default;
[run-sample-java-api.sh](run-sample-java-api.sh) sets `-Ddd.runtime.metrics.enabled=true`
anyway so the demo does not rely on that default holding.

**The part that is easy to miss:** runtime metrics travel over DogStatsD (UDP), not the
trace port, and the tracer defaults to port 8125. This setup points the trace API at
8136, and that Agent's DogStatsD listens on **8135**, so the script also sets
`DD_DOGSTATSD_PORT=8135`. Without it the metrics are sent to a port nothing reads and
simply never appear — no error anywhere. Check what your Agent expects with:

```bash
curl -s localhost:8136/info | python3 -m json.tool | grep statsd
```

Then confirm arrival in Datadog by graphing `jvm.heap_memory` filtered to
`service:sample-app`.

## Server-side feature flags

Flags are evaluated in-process through OpenFeature, with Datadog's provider:

```java
OpenFeatureAPI api = OpenFeatureAPI.getInstance();
api.setProviderAndWait(new Provider(new Provider.Options().initTimeout(5, TimeUnit.SECONDS)));
Client client = api.getClient("sample-java-api");
```

Registered once in
[FeatureFlagsConfig.java](src/main/java/com/example/samplejavaapi/flags/FeatureFlagsConfig.java),
which exposes the `Client` as a bean;
[FeatureFlags.java](src/main/java/com/example/samplejavaapi/flags/FeatureFlags.java) builds the
evaluation context.

### Targeting attributes

The context mirrors what `sample-react` sends to the browser provider, so a rule written once
in Datadog applies on both sides of the call:

| Context | Value | Notes |
| --- | --- | --- |
| targeting key | the email | Stable identity; percentage rollouts follow the person |
| `email` | the email, lower-cased | Available as a targeting attribute |
| `site` | the `site` query param, as sent | Omitted when absent, so a site rule misses rather than matching a blank |

`site` is not lower-cased: the drop-down sends display names like `Toronto`, and Datadog
compares exact strings, so folding case would stop rules written against those values from
matching.

This is why `getUserProfile` takes `site` at all — `show-new-feature` targets on it, and a
backend that never receives it can only ever evaluate that flag to its default.

### Requirements

- `dd-java-agent` attached: evaluation happens inside the agent
- `DD_API_KEY` set, or the provider cannot fetch its configuration
- `dev.openfeature:sdk` and `com.datadoghq:dd-openfeature` on the classpath, and
  **`dd-openfeature` must match the agent version**. `get-dd-java-agent.sh` always fetches
  the latest agent, so bump `dd-openfeature.version` in the pom when that moves on.

### Without those

`setProviderAndWait` throws; that is caught and logged as a warning. OpenFeature keeps its
no-op provider, every evaluation returns the default passed at the call site, and the app
starts normally — the same fallback shape `sample-react` uses. This is what happens during
`mvn test`:

```
WARN  Datadog feature flag provider unavailable (FatalError: Failed to initialize provider,
      is the tracer configured?); flags will return their code defaults.
```

With the agent and a key, startup reports instead:

```
INFO  Provider datadog-openfeature-provider transitioned from state NOT_READY to state READY
INFO  Datadog feature flag provider registered for client=sample-java-api
```

### Current usage

`getUserProfile` evaluates one flag purely as a readout, logged at DEBUG beside the resolved
profile. **Nothing is gated on it yet:**

```
… flag show-new-feature=false (reason STATIC)
```

`reason` is the useful part: `STATIC` or `TARGETING_MATCH` means the value came from real
configuration, while `ERROR` or `DEFAULT` means it fell back to the code default. Change
which key is read with `sample.flags.readout-key`.

Site targeting is visible in that readout — `show-new-feature` currently matches on
`site:Toronto`:

```
site=null         flag show-new-feature=false (reason STATIC)
site=Toronto      flag show-new-feature=true  (reason TARGETING_MATCH)
site=Mexico City  flag show-new-feature=false (reason STATIC)
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
    ├── main/resources/
    │   ├── application.yml       # server, CORS, profile directory mode
    │   └── logback-spring.xml    # console + rolling file appenders, pattern
    └── test/
        ├── java/com/example/samplejavaapi/userprofile/
        └── resources/logback-test.xml  # console only, keeps tests out of the log file
```
