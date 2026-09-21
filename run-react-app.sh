#!/usr/bin/env bash
set -euo pipefail

cd react-app

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start the React development server
npm run dev
