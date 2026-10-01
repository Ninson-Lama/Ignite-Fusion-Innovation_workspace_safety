# Database regression checks

Use a **disposable local Supabase/PostgreSQL database**, with all migrations and `supabase/seed.sql` applied. Do not run these scripts on production or a database containing real user records. They create synthetic auth users and exercise admin/trainee operations inside a transaction, then roll it back.

Run each SQL file with an owner/admin connection and stop on SQL errors, for example:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/learning-games.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/admin-activity-feed.sql
```

Each check returns `test`, `passed`, and `observed`. A failed check raises an exception before rollback; closing the failed connection also rolls back its transaction. The scripts have been exercised on PostgreSQL 18.3 through a temporary PGlite harness with minimal Supabase auth/storage compatibility. They do not validate network Realtime delivery, browser rendering, or true concurrent connections.
