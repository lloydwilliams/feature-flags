#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  npm install
fi

# Matches prod-sample-java-api.sh, so both halves of the demo report the same
# env and release. Vite inlines these at start-up, so a change needs a restart.
export VITE_DD_ENV=prod
export VITE_DD_VERSION=2.0.0

# Start the Vite development server
npm run dev
