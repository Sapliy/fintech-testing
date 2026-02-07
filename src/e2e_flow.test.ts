import { SapliyClient } from "@sapliyio/fintech"
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * E2E Transaction Flow Test
 * 
 * This test validates the entire lifecycle of a transaction across the Sapliy ecosystem.
 * It dynamically creates a verified user and API key to ensure full system integration.
 */
describe('E2E Transaction Flow', () => {
    let apiKey: string;
    let client: SapliyClient;
    let zoneId: string;

    // Helper to fetch debug tokens from Auth Service directly
    async function getDebugToken(email: string, type: 'verify' | 'reset'): Promise<string> {
        const res = await fetch(`http://localhost:8081/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) {
            throw new Error(`Failed to get debug token: ${res.status} ${res.statusText}`);
        }
        const data = await res.json() as any;
        return data.token;
    }

    beforeAll(async () => {
        // 1. Register User
        const email = `e2e-payment-user-${Date.now()}@example.com`;
        const password = 'Password123!';

        const regRes = await fetch('http://localhost:8080/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!regRes.ok) throw new Error(`Register failed: ${regRes.statusText}`);
        const _user = await regRes.json() as any;

        // 2. Verify Email
        await new Promise(r => setTimeout(r, 200)); // Wait for token storage
        const token = await getDebugToken(email, 'verify');

        const verifyRes = await fetch('http://localhost:8080/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        if (!verifyRes.ok) throw new Error(`Verify failed: ${verifyRes.statusText}`);

        // 3. Login to get Auth Token
        const loginRes = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
        const loginData = await loginRes.json() as any;
        const authToken = loginData.token;

        // 4. Create Organization
        const orgRes = await fetch('http://localhost:8080/auth/organizations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `E2E Test Org ${Date.now()}`,
                domain: `e2e-${Date.now()}.com`
            })
        });
        if (!orgRes.ok) throw new Error(`Org creation failed: ${orgRes.statusText}`);
        const orgData = await orgRes.json() as any;
        const orgId = orgData.id;

        // 5. Create Zone
        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                org_id: orgId,
                name: `E2E Payment Zone ${Date.now()}`,
                mode: 'test'
            })
        });
        if (!zoneRes.ok) throw new Error(`Zone creation failed: ${zoneRes.statusText}`);
        const zoneData = await zoneRes.json() as any;
        zoneId = zoneData.id;

        // 6. Generate API Key linked to this Zone
        const keyRes = await fetch('http://localhost:8080/auth/api_keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                zone_id: zoneId,
                environment: 'test',
                type: 'secret'
            })
        });
        if (!keyRes.ok) throw new Error(`Key generation failed: ${keyRes.statusText}`);
        const keyData = await keyRes.json() as any;
        apiKey = keyData.key;

        // Initialize Client
        client = new SapliyClient(apiKey, 'http://localhost:8080');
    }, 60000); // 60s timeout for setup

    it('successfully processes a payment through the entire ecosystem', async () => {
        // 1. Trigger a Payment Event
        const paymentIntentRes = await client.payments.paymentServiceCreatePaymentIntent({
            amount: 5000,
            currency: 'usd',
            zone_id: zoneId,
            description: 'E2E Test Payment'
        } as any);
        const paymentIntent = (paymentIntentRes as any).data;
        expect(paymentIntent).toBeDefined();
        const intentId = paymentIntent.id;

        // 2. Confirm the Payment
        const confirmationRes = await client.payments.paymentServiceConfirmPaymentIntent(intentId, {
            payment_method: 'pm_card_visa' as any
        } as any);
        const confirmation = (confirmationRes as any).data;
        expect(confirmation.status).toBe('succeeded');
    });
});
