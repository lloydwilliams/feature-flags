#!/usr/bin/env bash
set -euo pipefail

# Run from this script's own directory, so it works from anywhere - the repo
# root, react-app/, or an absolute path. The old `cd react-app` only worked
# when invoked from the root, which is why it broke when the script moved here.
cd "$(dirname "$0")"

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start the React development server
npm run dev
