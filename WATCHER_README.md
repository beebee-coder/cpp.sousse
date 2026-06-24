Watcher (filesystem -> Chroma sync)

Overview
- A filesystem watcher keeps local directories synced to Chroma collections.
- Controlled by environment variable: SYNC_ENABLE. Default: disabled.

Quick start (development)
1. Install dependencies:
   npm install
2. Enable and run watcher locally:
   export SYNC_ENABLE=true
   npm run watcher

Notes for deployment
- Vercel / serverless: not suitable to run a continuous filesystem watcher. Keep SYNC_ENABLE unset or false in serverless environments.
- Recommended hosting for the watcher: VM, container, systemd service, or a separate worker instance.
- If using production, prefer running the watcher in a dedicated process and ensure CHROMA_URL is reachable from that host.

Environment variables
- SYNC_ENABLE (true|false): enable the watcher
- SYNC_WATCH_DIR: directory to watch (default: ./data)
- SYNC_EXTS: comma-separated extensions to include (default: .md,.txt,.json)
- CHROMA_URL: URL for local Chroma service

Security
- Do not commit secrets to repo (.env). Use environment-specific secret stores.
