#!/usr/bin/env bash
# Calls StartAIScan for Houston.
#
# The site is the only thing that differs from call-start-ai-scan-toronto.sh:
# run both and the responses show how show-ai-scan is targeted per site.
#
# Override with env vars, e.g. AMOUNT=7 ./call-start-ai-scan-houston.sh
set -euo pipefail

SITE="Houston"
AMOUNT="${AMOUNT:-42}"
EMAIL="${EMAIL:-lloyd.williams@datadoghq.com}"
API="${API_BASE_URL:-http://localhost:8080}"

echo "POST $API/api/ai-scan/start   site=$SITE amount=$AMOUNT"

# -sS keeps the progress meter off but still reports connection errors, and
# -w prints the status so a 404 (API not rebuilt) cannot look like a flag result.
curl -sS -X POST "$API/api/ai-scan/start" \
  -H 'Content-Type: application/json' \
  -d "{\"amount\": $AMOUNT, \"email\": \"$EMAIL\", \"site\": \"$SITE\"}" \
  -w '\nHTTP %{http_code}\n'
