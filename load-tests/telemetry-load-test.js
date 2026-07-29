// Load test for bantu-stream-connect's playback telemetry write path -
// the actual hot path a real viewer generates: one view-recording RPC
// call ~15s into playback, then a heartbeat write every ~10s for the
// life of the session (mirrors js/watch-session.js's real behavior).
//
// SAFETY: point this at a local Supabase stack (via `supabase start`)
// or a paid-plan branch - NEVER at production. Point BASE_URL/ANON_KEY
// at your target before running.
//
// Usage:
//   k6 run load-tests/telemetry-load-test.js -e TARGET_VUS=1000
//
// Start small (100-1000 VUs) and work up toward 50000 - watch Postgres
// CPU/connection saturation as you go rather than jumping straight to
// the target number.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// =====================================================================
// CONFIG - point these at your LOCAL stack or a branch, never prod.
// =====================================================================
const BASE_URL = __ENV.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'REPLACE_WITH_LOCAL_ANON_KEY';

// Seed a handful of real user_profiles/Content rows first (see
// seed-test-data.sql) and list their ids here so FK constraints don't
// reject every write. Comma-separated via env var, or edit directly.
const TEST_USER_IDS = (__ENV.TEST_USER_IDS || 'REPLACE-WITH-REAL-TEST-USER-UUID').split(',');
const TEST_CONTENT_IDS = (__ENV.TEST_CONTENT_IDS || '1,2,3').split(',').map(Number);

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '1000', 10);

// =====================================================================
// Custom metrics - these are what actually answer "can it handle it"
// =====================================================================
const viewRpcLatency = new Trend('view_rpc_latency', true);
const heartbeatLatency = new Trend('heartbeat_latency', true);
const progressUpsertLatency = new Trend('progress_upsert_latency', true);
const errorRate = new Rate('telemetry_error_rate');

export const options = {
    scenarios: {
        viewers: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: Math.floor(TARGET_VUS * 0.25) },
                { duration: '30s', target: Math.floor(TARGET_VUS * 0.5) },
                { duration: '30s', target: TARGET_VUS },
                { duration: '2m', target: TARGET_VUS },  // sustain at target - this is the number that matters
                { duration: '30s', target: 0 },
            ],
        },
    },
    thresholds: {
        // Fail the test loudly if the hot path degrades under load -
        // these thresholds are a starting point, tune them once you
        // have a baseline from a real run.
        'view_rpc_latency': ['p(95)<500'],
        'heartbeat_latency': ['p(95)<200'],
        'telemetry_error_rate': ['rate<0.01'],
    },
};

function headers(userId) {
    return {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    };
}

export default function () {
    const userId = randomItem(TEST_USER_IDS);
    const contentId = randomItem(TEST_CONTENT_IDS);
    const sessionId = `loadtest-${__VU}-${__ITER}-${Date.now()}`;

    // --- Simulate the real player: view-recording RPC fires once, ~15s in ---
    sleep(randomIntBetween(1, 3)); // stagger start so VUs don't all fire at t=0

    const rpcRes = http.post(
        `${BASE_URL}/rest/v1/rpc/record_content_view`,
        JSON.stringify({
            p_content_id: contentId,
            p_user_id: userId,
            p_session_id: sessionId,
            p_device_type: 'web',
        }),
        { headers: headers(userId), tags: { name: 'record_content_view' } }
    );
    viewRpcLatency.add(rpcRes.timings.duration);
    errorRate.add(rpcRes.status >= 400);
    check(rpcRes, { 'view RPC succeeded': (r) => r.status >= 200 && r.status < 300 });

    // --- Simulate a watch session: heartbeat every ~10s for a while ---
    const sessionLengthTicks = randomIntBetween(3, 12); // 30s-2min of "watching"
    let progressSeconds = 15;
    let sequenceNumber = 0;

    for (let i = 0; i < sessionLengthTicks; i++) {
        sleep(10);
        sequenceNumber++;
        progressSeconds += 10;

        const hbRes = http.post(
            `${BASE_URL}/rest/v1/playback_heartbeats`,
            JSON.stringify({
                playback_session_id: sessionId,
                content_id: contentId,
                user_id: userId,
                sequence_number: sequenceNumber,
                progress_seconds: progressSeconds,
                cumulative_watch_time_ms: progressSeconds * 1000,
                playback_state: 'PLAYING',
            }),
            { headers: headers(userId), tags: { name: 'playback_heartbeats' } }
        );
        heartbeatLatency.add(hbRes.timings.duration);
        errorRate.add(hbRes.status >= 400);

        // Matches the real periodic watch_progress sync in watch-session.js
        const progRes = http.post(
            `${BASE_URL}/rest/v1/watch_progress`,
            JSON.stringify({
                user_id: userId,
                content_id: contentId,
                last_position: progressSeconds,
                total_watch_time: progressSeconds,
                is_completed: false,
            }),
            {
                headers: { ...headers(userId), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
                tags: { name: 'watch_progress_upsert' },
            }
        );
        progressUpsertLatency.add(progRes.timings.duration);
        errorRate.add(progRes.status >= 400);
    }
}
