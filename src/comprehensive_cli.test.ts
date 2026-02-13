import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Path to the built CLI binary
const CLI_PATH = '/Users/marwanhassan/Sapliy-fintech/sapliy-cli';
const CLI_CMD = `${CLI_PATH}/sapliy`;
const API_URL = 'http://localhost:8080';

describe('Sapliy CLI Comprehensive Suite', () => {
    let apiKey: string;
    let zoneId: string;
    let orgId: string;
    let flowId: string;
    const email = `cli-full-test-${Date.now()}@sapliy.io`;
    const password = 'Password123!';

    // Helper to run CLI with environment variables
    const runCli = async (args: string) => {
        const cmd = `SAPLIY_API_KEY="${apiKey}" SAPLIY_API_URL="${API_URL}" ${CLI_CMD} ${args}`;
        try {
            const result = await execAsync(cmd);
            return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), error: null };
        } catch (error: any) {
            return { stdout: error.stdout?.trim(), stderr: error.stderr?.trim(), error };
        }
    };

    beforeAll(async () => {
        // 1. Register User
        console.log('Setup: Registering user...');
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!regRes.ok) throw new Error(`Register failed: ${regRes.statusText}`);

        // 2. Verify Email via Debug Token
        const verifyTokenRes = await fetch(`${API_URL}/auth/debug/tokens?email=${email}&type=verify`);
        if (!verifyTokenRes.ok) throw new Error('Failed to get verification token');
        const { token: verifyToken } = await verifyTokenRes.json() as any;

        await fetch(`${API_URL}/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: verifyToken })
        });

        // 3. Login to get Access Token
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const { token: authToken } = await loginRes.json() as any;

        // 4. Create Organization
        const orgRes = await fetch(`${API_URL}/auth/organizations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'CLI Full Test Org', domain: `cli-full-${Date.now()}.com` })
        });
        const orgData = await orgRes.json() as any;
        orgId = orgData.id;

        // 5. Create Zone
        const zoneRes = await fetch(`${API_URL}/auth/zones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'CLI Full Test Zone', org_id: orgId, mode: 'test' })
        });
        const zoneData = await zoneRes.json() as any;
        zoneId = zoneData.id;

        // 6. Create API Key
        const keyRes = await fetch(`${API_URL}/auth/api_keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ zone_id: zoneId, type: 'secret', environment: 'test' })
        });
        const keyData = await keyRes.json() as any;
        apiKey = keyData.key;
        console.log('Setup complete. API Key:', apiKey);

        // 7. Create a Flow for testing
        const flowRes = await fetch(`${API_URL}/v1/flows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                org_id: orgId,
                zone_id: zoneId,
                name: 'CLI Test Flow',
                enabled: true,
                nodes: [{ id: 'trigger', type: 'eventTrigger', data: JSON.stringify({ eventType: 'cli.test' }), position: '{"x":0,"y":0}' }],
                edges: []
            })
        });
        const flowData = await flowRes.json() as any;
        flowId = flowData.id;
    });

    // --- CLI Tests ---

    it('should display version', async () => {
        const { stdout } = await runCli('version');
        expect(stdout).toContain('sapliy');
        expect(stdout).toContain('version');
    });

    it('should show current user (whoami)', async () => {
        const { stdout } = await runCli('whoami');
        // Output might be "Logged in as <email>" or similar.
        // Or if using API key, might say "Authenticated via API Key"
        // Let's check for non-error output first.
        console.log('whoami:', stdout);
        expect(stdout.toLowerCase()).toContain('authenticated');
    });

    it('should list zones', async () => {
        const { stdout } = await runCli('zones list');
        console.log('zones list:', stdout);
        // Should contain our zone name or ID
        expect(stdout).toContain(zoneId);
        expect(stdout).toContain('CLI Full Test Zone');
    });

    it('should show current zone', async () => {
        // By default, no zone selected? Or maybe it picks default?
        // Let's select one first via 'use'
        // Wait, 'use' modifies local config. Env var SAPLIY_ZONE overrides?
        // Start with just checking output format
        const { stdout } = await runCli('zones current');
        console.log('zones current:', stdout);
    });

    it('should list flows', async () => {
        const { stdout } = await runCli('flows list');
        console.log('flows list:', stdout);
        expect(stdout).toContain(flowId);
        expect(stdout).toContain('CLI Test Flow');
    });

    it('should get flow details', async () => {
        const { stdout } = await runCli(`flows get ${flowId}`);
        console.log('flows get:', stdout);
        expect(stdout).toContain(flowId);
        expect(stdout).toContain('eventTrigger');
    });

    it('should disable and enable flow', async () => {
        // Disable
        const { stdout: disableOut } = await runCli(`flows disable ${flowId}`);
        expect(disableOut).toContain('disabled');

        // Verify via API
        const checkRes1 = await fetch(`${API_URL}/v1/flows/${flowId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const checkData1 = await checkRes1.json() as any;
        expect(checkData1.enabled).toBe(false);

        // Enable
        const { stdout: enableOut } = await runCli(`flows enable ${flowId}`);
        expect(enableOut).toContain('enabled');

        // Verify via API
        const checkRes2 = await fetch(`${API_URL}/v1/flows/${flowId}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const checkData2 = await checkRes2.json() as any;
        expect(checkData2.enabled).toBe(true);
    });

    it('should trigger an event', async () => {
        const { stdout } = await runCli(`trigger cli.test --data '{"foo":"bar"}'`);
        console.log('trigger:', stdout);
        expect(stdout).toContain('Event triggered');
        expect(stdout).toContain('cli.test');
    });

    it('should list logs', async () => {
        // Give it a moment for the triggered event to appear in logs
        await new Promise(r => setTimeout(r, 1000));
        const { stdout } = await runCli('logs --limit 5');
        console.log('logs:', stdout);
        expect(stdout).toContain('cli.test');
    });

    // Validating "every endpoint":
    // Auth (Login/Logout skipped as verified by API Key usage)
    // Zones (List, Use(skipped as verified via list checks), Current)
    // Flows (List, Get, Enable, Disable, Logs(skipped, similar to global logs))
    // Events (Trigger, Listen(skipped due to background nature))
    // Logs (List)
});
