# Datadog artifacts

Definitions exported from the Datadog UI, kept in git so the demo can be rebuilt in another
org or restored after someone edits it mid-demo.

```
datadog/
└── dashboards/
    └── feature-flags-app-performance.json
```

Add `monitors/`, `notebooks/`, or `powerpacks/` alongside as needed.

## Naming

Lowercase and hyphenated, no export timestamp — `git log` already records when each version
landed, and a name like `(FeatureFlags)Application&Analytics--2026-09-25T17_40_14.json`
needs quoting in every shell command that touches it.

## dashboards/feature-flags-app-performance.json

"(Feature Flags) Application Performance & Product Analytics" — one dashboard covering both
sides of this demo, in six groups:

| Group | Covers |
| --- | --- |
| Feature Flags | flag evaluations |
| RUM - User Experience | `sample-react` browser sessions |
| APM - Frontend Requests | `sample-react` calls out to the API |
| APM - Backend Performance | `sample-app`, the `sample-java-api` service |
| Product Analytics | user engagement and operations |
| Logs | both services |

Template variables `env` (`dev`) and `version` (`1.0.0`) match what the apps report:
`-Ddd.env` / `-Ddd.version` in
[run-sample-java-api.sh](../sample-java-api/run-sample-java-api.sh), and `DD_ENV` /
`DD_VERSION` in [main.tsx](../sample-react/src/main.tsx).

The prod scripts report `env:prod` and `version:2.0.0` from both services, so switch the
variables to those values to see that data.

## Exporting

Dashboard → the cog in the top right → **Export dashboard JSON**. Save it over the existing
file rather than beside it, so the diff shows what changed.

Before committing an export, check it for anything you would rather not publish: exports can
carry an `author_handle` (an email address), and notification lists carry handles too.

## Importing

**UI:** Dashboards → **New Dashboard** → **Import dashboard JSON**.

**API**, needing an app key as well as `DD_API_KEY`:

```bash
curl -X POST 'https://api.datadoghq.com/api/v1/dashboard' \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -H 'Content-Type: application/json' \
  -d @datadog/dashboards/feature-flags-app-performance.json
```

An import creates a **new** dashboard rather than updating the original — the export carries
no id. To update one in place, `PUT /api/v1/dashboard/<dashboard-id>` with the same body.

The widgets query on `service:sample-app` and `service:sample-react`, so an import into an
org that is not receiving this demo's telemetry will render empty rather than wrong.
