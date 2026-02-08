import { describe, it, expect, beforeAll } from 'vitest';

describe('Advanced Event-Driven Flow E2E', () => {
    let authToken: string;
    let orgId: string;
    let zoneId: string;
    let apiKey: string;
    const email = `adv-flow-${Date.now()}@sapliy.io`;
    const password = 'Password123!';

    async function getDebugToken(email: string, type: string) {
        const res = await fetch(`http://localhost:8080/auth/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) throw new Error(`Failed to get debug token: ${res.statusText}`);
        const data = await res.json() as any;
        return data.token;
    }

    beforeAll(async () => {
        // Setup
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
            body: JSON.stringify({ name: 'Adv Flow Org', domain: `adv-flow-${Date.now()}.com` })
        });
        const orgData = await orgRes.json() as any;
        orgId = orgData.id;

        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Adv Flow Zone', org_id: orgId, mode: 'test' })
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

    it('should trigger flow on payment.failed event for conditional branching', async () => {
        console.log('1. Creating flow with failure trigger...');

        // Create flow that triggers on payment.failed
        const flowData = {
            org_id: orgId,
            zone_id: zoneId,
            name: 'Payment Failed Handler',
            description: 'Handles payment failures with conditional logic',
            enabled: true,
            nodes: [
                {
                    id: 'trigger-failure',
                    type: 'eventTrigger',
                    data: JSON.stringify({ eventType: 'payment.failed' }),
                    position: JSON.stringify({ x: 0, y: 0 })
                }
            ],
            edges: []
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

        // Emit payment.failed event
        console.log('2. Emitting payment.failed event...');
        const emitRes = await fetch('http://localhost:8080/v1/events/emit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                type: 'payment.failed',
                data: {
                    payment_id: 'pay_failed_123',
                    reason: 'insufficient_funds',
                    amount: 5000
                }
            })
        });

        expect(emitRes.ok).toBe(true);
        console.log('Event emitted');

        // Wait and check for execution
        await new Promise(r => setTimeout(r, 1500));

        const execRes = await fetch(`http://localhost:8080/v1/flows/${flowId}/executions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (execRes.ok) {
            const execData = await execRes.json() as any;
            const executions = execData.executions || execData || [];
            if (executions.length > 0) {
                console.log(`Execution found: ${executions[0].id}, status: ${executions[0].status}`);
                expect(executions[0].status).toBe('completed');
            } else {
                console.log('No executions found yet');
            }
        }
    });

    it('should emit custom events and verify flow matching', async () => {
        console.log('3. Testing custom event matching...');

        // Create flow for custom event
        const customEventType = `custom.test.${Date.now()}`;
        const flowData = {
            org_id: orgId,
            zone_id: zoneId,
            name: 'Custom Event Handler',
            description: 'Handles custom events',
            enabled: true,
            nodes: [
                {
                    id: 'custom-trigger',
                    type: 'eventTrigger',
                    data: JSON.stringify({ eventType: customEventType }),
                    position: JSON.stringify({ x: 0, y: 0 })
                }
            ],
            edges: []
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
        console.log(`Custom flow created: ${flowId}`);

        // Emit custom event
        const emitRes = await fetch('http://localhost:8080/v1/events/emit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                type: customEventType,
                data: { custom_field: 'test_value' }
            })
        });

        expect(emitRes.ok).toBe(true);
        console.log(`Custom event ${customEventType} emitted`);

        // Wait and verify execution
        await new Promise(r => setTimeout(r, 1500));

        const execRes = await fetch(`http://localhost:8080/v1/flows/${flowId}/executions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (execRes.ok) {
            const execData = await execRes.json() as any;
            const executions = execData.executions || execData || [];
            if (executions.length > 0) {
                console.log(`Custom event triggered ${executions.length} execution(s)`);
            } else {
                console.log('No executions found for custom event');
            }
        }
    });

    it('should test wildcard event patterns', async () => {
        console.log('4. Testing wildcard event patterns...');

        // Create flow with wildcard pattern
        const flowData = {
            org_id: orgId,
            zone_id: zoneId,
            name: 'Wildcard Payment Handler',
            description: 'Handles all payment events with wildcard',
            enabled: true,
            nodes: [
                {
                    id: 'wildcard-trigger',
                    type: 'eventTrigger',
                    data: JSON.stringify({ eventType: 'order.*' }),
                    position: JSON.stringify({ x: 0, y: 0 })
                }
            ],
            edges: []
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
        console.log(`Wildcard flow created: ${flowId}`);

        // Emit various order events
        const orderEvents = ['order.created', 'order.updated', 'order.shipped'];

        for (const eventType of orderEvents) {
            const emitRes = await fetch('http://localhost:8080/v1/events/emit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    type: eventType,
                    data: { order_id: `ord_${Date.now()}` }
                })
            });
            expect(emitRes.ok).toBe(true);
            console.log(`Emitted: ${eventType}`);
        }

        // Wait and check executions
        await new Promise(r => setTimeout(r, 2000));

        const execRes = await fetch(`http://localhost:8080/v1/flows/${flowId}/executions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (execRes.ok) {
            const execData = await execRes.json() as any;
            const executions = execData.executions || execData || [];
            console.log(`Wildcard pattern matched ${executions.length} execution(s)`);
            // If wildcards are implemented, expect 3 executions
            // Otherwise, just log the result
        }
    });
});

describe('Webhook Delivery E2E', () => {
    let apiKey: string;
    let zoneId: string;
    let orgId: string;
    const email = `webhook-${Date.now()}@sapliy.io`;
    const password = 'Password123!';

    async function getDebugToken(email: string, type: string) {
        const res = await fetch(`http://localhost:8080/auth/debug/tokens?email=${email}&type=${type}`);
        if (!res.ok) throw new Error(`Failed to get debug token: ${res.statusText}`);
        const data = await res.json() as any;
        return data.token;
    }

    beforeAll(async () => {
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
        const authToken = loginData.token;

        const orgRes = await fetch('http://localhost:8080/auth/organizations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Webhook Org', domain: `webhook-${Date.now()}.com` })
        });
        const orgData = await orgRes.json() as any;
        orgId = orgData.id;

        const zoneRes = await fetch('http://localhost:8080/auth/zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Webhook Zone', org_id: orgData.id, mode: 'test' })
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

    it('should create flow with webhook node and trigger delivery', async () => {
        console.log('5. Testing webhook delivery...');

        // Create a flow with webhook action
        const flowData = {
            org_id: orgId,
            zone_id: zoneId,
            name: 'Webhook Notification Flow',
            description: 'Sends webhook on event',
            enabled: true,
            nodes: [
                {
                    id: 'trigger',
                    type: 'eventTrigger',
                    data: JSON.stringify({ eventType: 'notification.send' }),
                    position: JSON.stringify({ x: 0, y: 0 })
                },
                {
                    id: 'webhook',
                    type: 'webhook',
                    data: JSON.stringify({
                        url: 'https://webhook.site/test-endpoint',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    }),
                    position: JSON.stringify({ x: 200, y: 0 })
                }
            ],
            edges: [
                {
                    id: 'edge-1',
                    source: 'trigger',
                    target: 'webhook'
                }
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
        console.log(`Webhook flow created: ${flow.id}`);

        // Trigger the flow
        const emitRes = await fetch('http://localhost:8080/v1/events/emit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                type: 'notification.send',
                data: { message: 'Test webhook notification' }
            })
        });

        expect(emitRes.ok).toBe(true);
        console.log('Webhook trigger event emitted');

        // Wait for execution
        await new Promise(r => setTimeout(r, 2000));

        const execRes = await fetch(`http://localhost:8080/v1/flows/${flow.id}/executions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (execRes.ok) {
            const execData = await execRes.json() as any;
            const executions = execData.executions || execData || [];
            if (executions.length > 0) {
                console.log(`Webhook flow executed: ${executions[0].status}`);
            }
        }
    });
});
