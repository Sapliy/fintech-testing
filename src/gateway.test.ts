import { describe, it, expect, beforeAll } from 'vitest';

describe('Gateway Public Routes E2E', () => {
    it('should return health status on /health', async () => {
        console.log('Testing /health endpoint...');
        const res = await fetch('http://localhost:8080/health');
        expect(res.ok).toBe(true);
        const data = await res.json() as any;
        expect(data.status).toBe('active');
        expect(data.service).toBe('gateway');
        console.log(`Health check passed: ${data.status}`);
    });

    it('should allow unauthenticated access to /auth/register', async () => {
        console.log('Testing /auth/register accessibility...');
        const res = await fetch('http://localhost:8080/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `test-${Date.now()}@sapliy.io`, password: 'Test123!' })
        });
        // Should succeed (user created) or fail with "email taken" - but not 401/403
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
        console.log(`Register route accessible: status ${res.status}`);
    });

    it('should allow unauthenticated access to /auth/login', async () => {
        console.log('Testing /auth/login accessibility...');
        const res = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' })
        });
        // Should fail with bad credentials, not with auth required
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
        console.log(`Login route accessible: status ${res.status}`);
    });

    it('should reject protected routes without API key', async () => {
        console.log('Testing protected route without API key...');
        const res = await fetch('http://localhost:8080/v1/payments', {
            method: 'GET'
        });
        expect(res.status).toBe(401);
        const data = await res.json() as any;
        expect(data.error).toContain('API Key');
        console.log(`Protected route correctly rejected: ${data.error}`);
    });

    it('should reject invalid API key format', async () => {
        console.log('Testing invalid API key format...');
        const res = await fetch('http://localhost:8080/v1/payments', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer invalid_key_format'
            }
        });
        expect(res.status).toBe(401);
        console.log('Invalid key format correctly rejected');
    });

    it('should reject revoked or non-existent API keys', async () => {
        console.log('Testing non-existent API key...');
        const res = await fetch('http://localhost:8080/v1/payments', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer sk_test_nonexistent1234567890abcdef'
            }
        });
        expect(res.status).toBe(401);
        console.log('Non-existent key correctly rejected');
    });
});

describe('API Key Validation E2E', () => {
    let authToken: string;
    let zoneId: string;
    let apiKey: string;
    const email = `keyval-${Date.now()}@sapliy.io`;
    const password = 'Password123!';

    async function getDebugToken(email: string, type: string) {
        const res = await fetch(`http://localhost:8080/auth/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) throw new Error(`Failed to get debug token: ${res.statusText}`);
        const data = await res.json() as any;
        return data.token;
    }

    beforeAll(async () => {
        // Setup: Register, verify, login, create org, create zone, generate key
        const regRes = await fetch('http://localhost:8080/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!regRes.ok) throw new Error(`Register failed: ${regRes.statusText}`);

        await new Promise(r => setTimeout(r, 500));
        const token = await getDebugToken(email, 'verify');
        await fetch('http://localhost:8080/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const loginRes = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json() as any;
        authToken = loginData.token;

        const orgRes = await fetch('http://localhost:8080/auth/organizations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Key Validation Org', domain: `keyval-${Date.now()}.com` })
        });
        const orgData = await orgRes.json() as any;

        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Key Validation Zone', org_id: orgData.id, mode: 'test' })
        });
        const zoneData = await zoneRes.json() as any;
        zoneId = zoneData.id;

        const keyRes = await fetch('http://localhost:8080/auth/api_keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ zone_id: zoneId, type: 'secret', environment: 'test' })
        });
        const keyData = await keyRes.json() as any;
        apiKey = keyData.key;
    });

    it('should accept valid API key for protected routes', async () => {
        console.log('Testing valid API key...');
        const res = await fetch('http://localhost:8080/v1/flows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                name: 'Test Flow',
                zone_id: zoneId,
                enabled: true,
                nodes: [],
                edges: []
            })
        });
        // Should not be 401/403
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
        console.log(`Valid API key accepted: status ${res.status}`);
    });

    it('should inject zone context headers for downstream services', async () => {
        console.log('Testing zone context injection...');
        // Events endpoint uses the zone context from API key
        const res = await fetch('http://localhost:8080/v1/events/emit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                type: 'test.event',
                data: { test: true }
            })
        });
        expect(res.ok).toBe(true);
        const data = await res.json() as any;
        expect(data.status).toBe('ingested');
        console.log(`Event ingested with zone context: ${data.event_id}`);
    });
});
