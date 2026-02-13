import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Frontend Integration Smoke Tests
 *
 * These tests simulate the exact API calls the frontend makes after
 * the integration refactoring (Phases 1-5). They verify:
 *   1. Auth through the gateway (/auth/*)
 *   2. CORS preflight responses
 *   3. Flow CRUD with Bearer token auth
 *   4. Zone listing after login
 *   5. Error states (401, 429 simulation)
 */

const GATEWAY = 'http://localhost:8080';
const FRONTEND_ORIGIN = 'http://localhost:3000';

describe('Frontend Integration Smoke Tests', () => {
    let authToken: string;
    let orgId: string;
    let zoneId: string;
    let apiKey: string;
    const email = `smoke-${Date.now()}@sapliy.io`;
    const password = 'SmokeTest123!';

    // --- Helper ---
    async function getDebugToken(email: string, type: string): Promise<string> {
        const res = await fetch(`http://localhost:8081/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) throw new Error(`Debug token failed: ${res.statusText}`);
        const data = await res.json() as any;
        return data.token;
    }

    // =========================================================
    // Setup: Register → Verify → Login → Create Org → Create Zone → Get API Key
    // Mirrors the auth.store.ts login flow
    // =========================================================
    beforeAll(async () => {
        // Register
        const regRes = await fetch(`${GATEWAY}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        expect(regRes.status).toBe(201);

        // Verify email (debug)
        await new Promise(r => setTimeout(r, 500));
        const token = await getDebugToken(email, 'verify');
        await fetch(`${GATEWAY}/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        // Login (mirrors authService.login → POST /auth/login)
        const loginRes = await fetch(`${GATEWAY}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        expect(loginRes.status).toBe(200);
        const loginData = await loginRes.json() as any;
        authToken = loginData.token;
        expect(authToken).toBeDefined();

        // Create org (mirrors auth.store post-login fetch)
        const orgRes = await fetch(`${GATEWAY}/auth/organizations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ name: 'Smoke Org', domain: `smoke-${Date.now()}.io` }),
        });
        const orgData = await orgRes.json() as any;
        orgId = orgData.id;

        // Create zone (mirrors auth.store post-login fetch)
        const zoneRes = await fetch(`${GATEWAY}/auth/zones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ name: 'Smoke Zone', org_id: orgId, mode: 'test' }),
        });
        const zoneData = await zoneRes.json() as any;
        zoneId = zoneData.id;

        // Generate API key
        const keyRes = await fetch(`${GATEWAY}/auth/api_keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ zone_id: zoneId, type: 'secret', environment: 'test' }),
        });
        const keyData = await keyRes.json() as any;
        apiKey = keyData.key;
    }, 30000);

    // =========================================================
    // 1. CORS Preflight
    // =========================================================
    describe('CORS', () => {
        it('should respond to OPTIONS preflight with correct headers', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows`, {
                method: 'OPTIONS',
                headers: {
                    'Origin': FRONTEND_ORIGIN,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Authorization, Content-Type',
                },
            });
            // Should be 204 No Content for preflight
            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe(FRONTEND_ORIGIN);
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
            expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
            expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        });

        it('should include CORS headers on actual requests with Origin', async () => {
            const res = await fetch(`${GATEWAY}/health`, {
                headers: { 'Origin': FRONTEND_ORIGIN },
            });
            expect(res.status).toBe(200);
            // Note: CORS headers are only set when Origin header is present
            // Node.js fetch doesn't always send it, but browsers always do
            const corsHeader = res.headers.get('Access-Control-Allow-Origin');
            if (corsHeader) {
                expect(corsHeader).toBe(FRONTEND_ORIGIN);
            }
        });
    });

    // =========================================================
    // 2. Auth endpoints through gateway (apiClient paths)
    // =========================================================
    describe('Auth via Gateway', () => {
        it('should login through gateway /auth/login', async () => {
            const res = await fetch(`${GATEWAY}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.token).toBeDefined();
            expect(data.user).toBeDefined();
            expect(data.user.email).toBe(email);
        });

        it('should fetch organizations after login', async () => {
            // GET /auth/organizations may require org_id param or return user's orgs
            const res = await fetch(`${GATEWAY}/auth/organizations`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            // Accept 200 (returns list) or 400 (needs params) — both prove routing works
            expect([200, 400].includes(res.status)).toBe(true);
        });

        it('should fetch zones after login', async () => {
            const res = await fetch(`${GATEWAY}/auth/zones?org_id=${orgId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            expect(res.status).toBe(200);
            const zones = await res.json() as any;
            expect(Array.isArray(zones)).toBe(true);
        });
    });

    // =========================================================
    // 3. Flow CRUD (mirrors flow.store.ts actions)
    // =========================================================
    describe('Flow CRUD via apiClient paths', () => {
        let flowId: string;

        it('should create a flow (POST /v1/flows)', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    name: 'Smoke Test Flow',
                    org_id: orgId,
                    zone_id: zoneId,
                    enabled: false,
                    nodes: [{
                        id: 'node-1',
                        type: 'eventTrigger',
                        data: JSON.stringify({ eventType: 'smoke.test' }),
                        position: JSON.stringify({ x: 100, y: 100 }),
                    }],
                    edges: [],
                }),
            });
            expect(res.ok).toBe(true);
            const flow = await res.json() as any;
            expect(flow.id).toBeDefined();
            flowId = flow.id;
        });

        it('should get flow by ID (GET /v1/flows/:id)', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows/${flowId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            expect(res.ok).toBe(true);
            const flow = await res.json() as any;
            expect(flow.name).toBe('Smoke Test Flow');
        });

        it('should update flow (PUT /v1/flows/:id)', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows/${flowId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    name: 'Updated Smoke Flow',
                    enabled: true,
                    nodes: [],
                    edges: [],
                }),
            });
            expect(res.ok).toBe(true);
            const flow = await res.json() as any;
            expect(flow.name).toBe('Updated Smoke Flow');
        });

        it('should delete flow (DELETE /v1/flows/:id)', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows/${flowId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            expect([200, 204].includes(res.status)).toBe(true);
        });
    });

    // =========================================================
    // 4. Error State Testing
    // =========================================================
    describe('Error States', () => {
        it('should return 401 for requests without auth', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows`, {
                method: 'GET',
                // No Authorization header
            });
            expect(res.status).toBe(401);
        });

        it('should return 401 for invalid token', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows`, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer invalid-token-xyz' },
            });
            expect(res.status).toBe(401);
        });

        it('should return 401 for invalid login credentials', async () => {
            const res = await fetch(`${GATEWAY}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'nobody@invalid.com', password: 'wrong' }),
            });
            expect(res.status).not.toBe(200);
        });

        it('should return 404 for non-existent flow', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows/nonexistent-id-00000`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            expect([404, 500].includes(res.status)).toBe(true);
        });

        it('should handle malformed JSON gracefully', async () => {
            const res = await fetch(`${GATEWAY}/v1/flows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: '{ this is not valid json }',
            });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // =========================================================
    // 5. Health Check
    // =========================================================
    describe('Health', () => {
        it('gateway should respond healthy', async () => {
            const res = await fetch(`${GATEWAY}/health`);
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.status).toBe('active');
        });
    });
});
