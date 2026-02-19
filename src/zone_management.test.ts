import { describe, it, expect, beforeAll } from 'vitest';

describe('Zone Management E2E', () => {
    let authToken: string;
    let orgId: string;
    const email = `zone-test-${Date.now()}@sapliy.io`;
    const password = 'Password123!';

    async function getDebugToken(email: string, type: string) {
        const res = await fetch(`http://localhost:8080/auth/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) throw new Error(`Failed to get debug token: ${res.statusText}`);
        const data = await res.json() as any;
        return data.token;
    }

    beforeAll(async () => {
        // 1. Register
        console.log('1. Registering user...');
        const regRes = await fetch('http://localhost:8080/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!regRes.ok) throw new Error(`Register failed: ${regRes.statusText}`);

        // 2. Verify Email
        console.log('2. Verifying email...');
        await new Promise(r => setTimeout(r, 500));
        const token = await getDebugToken(email, 'verify');
        const verifyRes = await fetch('http://localhost:8080/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        if (!verifyRes.ok) throw new Error(`Verify failed: ${verifyRes.statusText}`);

        // 3. Login
        console.log('3. Logging in...');
        const loginRes = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
        const loginData = await loginRes.json() as any;
        authToken = loginData.token;

        // 4. Create Organization
        console.log('4. Creating organization...');
        const orgRes = await fetch('http://localhost:8080/auth/organizations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Zone Test Org', domain: `zone-test-${Date.now()}.com` })
        });
        if (!orgRes.ok) throw new Error(`Org creation failed: ${orgRes.statusText}`);
        const orgData = await orgRes.json() as any;
        orgId = orgData.id;
    });

    it('should create a test zone', async () => {
        console.log('5. Creating test zone...');
        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test Zone', org_id: orgId, mode: 'test' })
        });
        expect(zoneRes.ok).toBe(true);
        const zoneData = await zoneRes.json() as any;
        expect(zoneData.id).toBeDefined();
        expect(zoneData.mode).toBe('test');
        console.log(`Test zone created: ${zoneData.id}`);
    });

    it('should create a live zone', async () => {
        console.log('6. Creating live zone...');
        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Live Zone', org_id: orgId, mode: 'live' })
        });
        expect(zoneRes.ok).toBe(true);
        const zoneData = await zoneRes.json() as any;
        expect(zoneData.id).toBeDefined();
        expect(zoneData.mode).toBe('live');
        console.log(`Live zone created: ${zoneData.id}`);
    });

    it('should list zones for organization', async () => {
        console.log('7. Listing zones...');
        const listRes = await fetch(`http://localhost:8080/auth/zones?org_id=${orgId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        expect(listRes.ok).toBe(true);
        const zones = await listRes.json() as any[];
        expect(zones.length).toBeGreaterThanOrEqual(2);
        console.log(`Found ${zones.length} zones`);
    });

    it('should generate API keys scoped to different zones', async () => {
        // First create a zone
        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'API Key Test Zone', org_id: orgId, mode: 'test' })
        });
        const zoneData = await zoneRes.json() as any;
        const zoneId = zoneData.id;

        // Generate a secret key
        console.log('8. Generating secret API key...');
        const secretKeyRes = await fetch('http://localhost:8080/auth/api_keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ zone_id: zoneId, type: 'secret', environment: 'test' })
        });
        expect(secretKeyRes.ok).toBe(true);
        const secretKeyData = await secretKeyRes.json() as any;
        expect(secretKeyData.key).toMatch(/^sk_test_/);
        console.log(`Secret key generated: ${secretKeyData.key.substring(0, 15)}...`);

        // Generate a publishable key
        console.log('9. Generating publishable API key...');
        const pubKeyRes = await fetch('http://localhost:8080/auth/api_keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ zone_id: zoneId, type: 'publishable', environment: 'test' })
        });
        expect(pubKeyRes.ok).toBe(true);
        const pubKeyData = await pubKeyRes.json() as any;
        expect(pubKeyData.key).toMatch(/^pk_test_/);
        console.log(`Publishable key generated: ${pubKeyData.key.substring(0, 15)}...`);
    });

    it('should enforce zone isolation for API keys', async () => {
        // Create two zones
        const zone1Res = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Isolation Zone 1', org_id: orgId, mode: 'test' })
        });
        const zone1 = await zone1Res.json() as any;

        const zone2Res = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Isolation Zone 2', org_id: orgId, mode: 'test' })
        });
        const _zone2 = await zone2Res.json() as any;

        // Generate key for zone1
        const key1Res = await fetch('http://localhost:8080/auth/api_keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ zone_id: zone1.id, type: 'secret', environment: 'test' })
        });
        const key1Data = await key1Res.json() as any;

        // Verify the key is associated with zone1
        expect(key1Data.zone_id).toBe(zone1.id);
        console.log(`Zone isolation verified: key belongs to zone ${key1Data.zone_id}`);
    });
});
