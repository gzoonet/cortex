# Storage Architecture

## Decision: Use SQLite for local storage

We decided to use SQLite as our primary storage engine.
SQLite provides zero-config, single-file storage which perfectly suits our
local-first architecture. We will NOT use any external database servers.
