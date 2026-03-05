# Database Migration Plan

## Decision: Move away from embedded databases

After performance testing, we decided to move away from embedded databases
like SQLite. We are migrating to PostgreSQL for better concurrency support.
The decision is final: no embedded databases in production.
