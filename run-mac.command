#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

pause_and_exit() {
  echo
  read -r -p "Press Return to close this window... " _
  exit 1
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20.9 or newer is required. Install Node.js 22, then run this again."
  open "https://nodejs.org/en/download" >/dev/null 2>&1 || true
  pause_and_exit
fi

if ! node -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major < 20 || (major === 20 && minor < 9) ? 1 : 0)'; then
  echo "Your Node.js version is $(node --version). Please install Node.js 20.9 or newer."
  pause_and_exit
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example."
fi

if grep -Eq 'YOUR_PROJECT\.supabase\.co|YOUR_SUPABASE_PUBLISHABLE_KEY|YOUR_SUPABASE_SECRET_KEY|REPLACE_WITH' .env.local; then
  echo "LeadFlow still needs your private Supabase configuration."
  echo "A parent/guardian should help create/manage the provider project where required."
  echo "Opening .env.local in TextEdit. Fill in the values locally; never send secrets in chat."
  open -a TextEdit .env.local >/dev/null 2>&1 || true
  pause_and_exit
fi

if [ ! -d node_modules ]; then
  echo "Installing project dependencies..."
  npm install
fi

echo "Starting LeadFlow on http://localhost:3000 ..."
npm run dev &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' INT TERM EXIT

ready=0
for _ in {1..60}; do
  if curl -fsS http://127.0.0.1:3000/login >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid" || true
    echo "LeadFlow stopped during startup. Check the error above."
    pause_and_exit
  fi
  sleep 1
done

if [ "$ready" -eq 1 ]; then
  open http://localhost:3000/login >/dev/null 2>&1 || true
  echo "LeadFlow is running. Keep this Terminal window open."
  echo "Press Control+C here to stop the development server."
else
  echo "The app did not respond within 60 seconds. Keep this window open to inspect the server output."
fi
wait "$server_pid"
