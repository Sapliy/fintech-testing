import { describe, it, expect, beforeAll } from 'vitest';

describe('Approval Node E2E', { timeout: 180000 }, () => {
    let authToken: string;
    let orgId: string;
    let zoneId: string;
    let apiKey: string;
    const email = `approval-test-${Date.now()}@sapliy.io`;
    const password = 'Password123!';

    async function getDebugToken(email: string, type: string) {
        const res = await fetch(`http://localhost:8080/auth/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) throw new Error(`Failed to get debug token: ${res.statusText}`);
        const data = await res.json() as any;
        return data.token;
    }

    beforeAll(async () => {
        // Setup via API
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
            body: JSON.stringify({ name: 'Approval Test Org', domain: `approval-test-${Date.now()}.com` })
        });
        const orgData = await orgRes.json() as any;
        orgId = orgData.id;

        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Approval Test Zone', org_id: orgId, mode: 'test' })
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

    it('should pause execution at approval node and resume correctly', async () => {
        console.log('1. Creating flow with approval node...');

        const flowData = {
            org_id: orgId,
            zone_id: zoneId,
            name: 'Approval Approval Flow',
            description: 'Flow that requires manual approval',
            enabled: true,
            nodes: [
                {
                    id: 'trigger',
                    type: 'eventTrigger',
                    data: JSON.stringify({ eventType: 'approval.required' }),
                    position: JSON.stringify({ x: 0, y: 0 })
                },
                {
                    id: 'approval',
                    type: 'approval',
                    data: JSON.stringify({ message: 'Grant access?' }),
                    position: JSON.stringify({ x: 200, y: 0 })
                },
                {
                    id: 'audit',
                    type: 'auditLog',
                    data: JSON.stringify({ message: 'Flow finished after approval' }),
                    position: JSON.stringify({ x: 400, y: 0 })
                }
            ],
            edges: [
                { id: 'e1', source: 'trigger', target: 'approval' },
                { id: 'e2', source: 'approval', target: 'audit' }
            ]
        };

        const createRes = await fetch('http://localhost:8080/v1/flows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(flowData)
        });

        expect(createRes.ok).toBe(true);
        const flow = await createRes.json() as any;
        const flowId = flow.id;
        console.log(`Flow created: ${flowId}`);

        // Trigger the flow
        console.log('2. Emitting trigger event...');
        const emitRes = await fetch('http://localhost:8080/v1/events/emit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                type: 'approval.required',
                data: { user: 'test-user', action: 'delete-db' }
            })
        });
        expect(emitRes.ok).toBe(true);

        // The flow-runner polls Redis every 100ms but may take a few seconds to discover the new stream
        // In this environment, it takes ~100s for flow-runner to fully initialize and pick up events
        console.log('3. Checking for paused status...');
        let executionId = '';
        for (let i = 0; i < 150; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const listExecsRes = await fetch(`http://localhost:8080/v1/flows/${flowId}/executions`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (listExecsRes.ok) {
                const data = await listExecsRes.json() as any;
                const executions = data.executions || [];
                if (executions.length > 0) {
                    executionId = executions[0].id;
                    if (executions[0].status === 'paused') {
                        console.log(`Execution ${executionId} is paused as expected.`);
                        break;
                    }
                    console.log(`Execution ${executionId} current status: ${executions[0].status}`);
                }
            }
        }

        expect(executionId).not.toBe('');

        // Fetch full execution to be sure
        const getExecRes = await fetch(`http://localhost:8080/v1/executions/${executionId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const exec = await getExecRes.json() as any;
        expect(exec.status).toBe('paused');

        // Resume execution
        console.log('4. Resuming execution...');
        const resumeRes = await fetch(`http://localhost:8080/v1/executions/${executionId}/resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ approved: true, notes: 'Looks good' })
        });

        if (!resumeRes.ok) {
            const errorText = await resumeRes.text();
            console.error(`Resume failed: ${resumeRes.status} ${resumeRes.statusText} - ${errorText}`);
        }
        expect(resumeRes.ok).toBe(true);
        const resumeData = await resumeRes.json() as any;
        expect(resumeData.message).toBe('Execution resumed');

        // Check for COMPLETED status
        console.log('5. Checking for completed status...');
        let finalStatus = '';
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const checkExecRes = await fetch(`http://localhost:8080/v1/executions/${executionId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const data = await checkExecRes.json() as any;
            finalStatus = data.status;
            if (finalStatus === 'completed') break;
            console.log(`Execution status: ${finalStatus}...`);
        }

        expect(finalStatus).toBe('completed');
        console.log('✅ Approval flow verified successfully!');
    });
});
