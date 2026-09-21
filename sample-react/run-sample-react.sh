#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start the Vite development server
npm run dev
