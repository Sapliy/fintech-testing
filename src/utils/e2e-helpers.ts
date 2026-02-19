import { SapliyClient } from '@sapliyio/fintech';
import { sleep } from './index';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:8081';

export interface E2EContext {
    apiKey: string;
    client: SapliyClient;
    orgId: string;
    zoneId: string;
    authToken: string;
    email: string;
}

/**
 * Retrieve a debug token (verify / reset) directly from the Auth service.
 * The debug endpoint is only available when ENABLE_DEBUG_ENDPOINTS=true.
 */
export async function getDebugToken(
    email: string,
    type: 'verify' | 'reset',
): Promise<string> {
    const url = `${AUTH_SERVICE_URL}/debug/tokens?email=${encodeURIComponent(email)}&type=${type}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to get debug token (${type}) for ${email}: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { token: string };
    if (!data.token) throw new Error(`Debug token response missing 'token' field`);
    return data.token;
}

/**
 * Perform a POST to the gateway and throw a descriptive error on failure.
 */
async function gatewayPost(
    path: string,
    body: unknown,
    authToken?: string,
): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${GATEWAY_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        let detail = res.statusText;
        try {
            const errBody = (await res.json()) as { error?: string };
            if (errBody.error) detail = errBody.error;
        } catch {
            // swallow JSON parse error
        }
        throw new Error(`POST ${path} failed [${res.status}]: ${detail}`);
    }
    return res.json();
}

/**
 * Full E2E bootstrap: register → verify email → login → create org → create zone → generate API key.
 *
 * Returns a ready-to-use context object that can be shared across tests in a `beforeAll`.
 */
export async function bootstrapE2EUser(prefix = 'e2e'): Promise<E2EContext> {
    const ts = Date.now();
    const email = `${prefix}-${ts}@sapliy.io`;
    const password = 'Password123!';

    // 1. Register
    await gatewayPost('/auth/register', { email, password });

    // 2. Wait briefly for async Redis write, then grab debug token
    await sleep(300);
    const verifyToken = await getDebugToken(email, 'verify');

    // 3. Verify email
    await gatewayPost('/auth/verify-email', { token: verifyToken });

    // 4. Login
    const loginData = (await gatewayPost('/auth/login', { email, password })) as {
        token: string;
    };
    const authToken = loginData.token;

    // 5. Create organisation
    const orgData = (await gatewayPost(
        '/auth/organizations',
        { name: `${prefix} Org ${ts}`, domain: `${prefix}-${ts}.com` },
        authToken,
    )) as { id: string };

    // 6. Create zone
    const zoneData = (await gatewayPost(
        '/auth/zones',
        { org_id: orgData.id, name: `${prefix} Zone ${ts}`, mode: 'test' },
        authToken,
    )) as { id: string };

    // 7. Generate API key
    const keyData = (await gatewayPost(
        '/auth/api_keys',
        { zone_id: zoneData.id, environment: 'test', type: 'secret' },
        authToken,
    )) as { key: string };

    const client = new SapliyClient(keyData.key, { basePath: GATEWAY_URL });

    return {
        apiKey: keyData.key,
        client,
        orgId: orgData.id,
        zoneId: zoneData.id,
        authToken,
        email,
    };
}
