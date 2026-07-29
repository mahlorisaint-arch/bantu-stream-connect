# Telemetry load test

Simulates the real write pattern a watching viewer generates (view-recording
RPC + a heartbeat write every ~10s), so you can find out empirically whether
the database can sustain it at real concurrency — instead of guessing.

**Never point this at production.** Always run it against a local Supabase
stack or a paid-plan branch.

## One-time setup

1. **Enable WSL2** (Docker Desktop's requirement on Windows) — needs admin
   rights and a restart:
   ```powershell
   wsl --install
   ```
   Restart your machine after this completes.

2. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop
   (or `winget install Docker.DockerDesktop`). Launch it once and accept its
   license agreement — this step needs the GUI, can't be scripted.

3. **Install the Supabase CLI**:
   ```powershell
   winget install Supabase.CLI
   ```

4. **From the project root**, start a local Supabase stack (Postgres +
   PostgREST + Studio, matching your real schema):
   ```powershell
   supabase init      # only if this project hasn't been linked locally yet
   supabase link --project-ref ydnxqnbjoshvxteevemc
   supabase db pull   # pulls the CURRENT remote schema down, including everything from tonight's session
   supabase start
   ```
   `supabase start` prints your local API URL, anon key, and a Studio link
   (http://127.0.0.1:54323) — keep that output, you'll need the URL and key.

5. **Seed minimal test data** — see `seed-test-data.sql` in this folder. Run
   it against the local instance via Studio's SQL editor or:
   ```powershell
   supabase db execute -f load-tests/seed-test-data.sql
   ```

k6 and Python are already installed on this machine (added while building
this package) — nothing further needed for the test tooling itself.

## Running it

Start small and work up — don't jump straight to 50,000:

```powershell
k6 run load-tests/telemetry-load-test.js `
  -e SUPABASE_URL=http://127.0.0.1:54321 `
  -e SUPABASE_ANON_KEY=<from supabase start output> `
  -e TEST_USER_IDS=11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,33333333-3333-3333-3333-333333333333 `
  -e TEST_CONTENT_IDS=900001,900002,900003 `
  -e TARGET_VUS=1000
```

Then repeat with `TARGET_VUS=5000`, `10000`, `25000`, `50000` — watch where
things actually start to degrade rather than assuming it's linear.

## What to watch, not just k6's summary

- **k6's own output**: `http_req_duration` p95/p99, and the `telemetry_error_rate`
  custom metric — a rising error rate under load is the clearest "it's
  breaking" signal.
- **Docker Desktop's resource stats** or `docker stats` while the test runs —
  watch the Postgres container's CPU. Sustained 100% CPU well before you hit
  your target VU count is your real ceiling for the compute size you're
  testing against.
- **Supabase Studio's local dashboard** (http://127.0.0.1:54323) → Database →
  shows active connections in real time — watch for saturation against
  `max_connections`.

Numbers from a local Docker container won't exactly match your eventual Pro
compute tier's hardware, but they'll reveal real architectural bottlenecks
(lock contention, slow queries under concurrency) that are tier-independent.

## Real baseline numbers (measured 2026-07-29, warm cache, production)

Single-query execution time via `EXPLAIN ANALYZE` wrapped in a rolled-back
transaction (real execution, zero data written) — this is what one write
costs today, not what N concurrent writes cost:

| Query | Time |
|---|---|
| `playback_heartbeats` insert | 5.7ms |
| `watch_progress` upsert | 11.0ms |
| `record_content_view` RPC | 65-83ms |

**The `record_content_view` RPC is the one to fix before load testing it.**
It's 10-15x slower than a plain insert because it recomputes the view count
via `SELECT COUNT(*) FROM content_views WHERE content_id = X` on every single
call — an O(n) scan that gets *slower* the more views a piece of content has,
right when it's getting the most traffic. `content_engagement_stats.total_views`
is already a maintained running counter (kept in sync by a trigger) — the RPC
should read that instead of recomputing it. This is a real, fixable
scalability bug independent of any load test; worth fixing first so the load
test measures the fixed version.
