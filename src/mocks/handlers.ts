import { http, HttpResponse } from 'msw';
import {
    createPaymentIntent,
    createCharge,
    createRefund,
    paymentIntentFactory,
} from '../fixtures/payments';
import { createZone, zoneFactory } from '../fixtures/zones';

const API_BASE = process.env.SAPLIY_API_URL || 'https://api.sapliy.io';

/**
 * Payment Intent Handlers
 */
export const paymentHandlers = [
    // Create payment intent
    http.post(`${API_BASE}/v1/payment_intents`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const intent = createPaymentIntent({
            amount: body.amount as number,
            currency: (body.currency as string) || 'USD',
        });
        return HttpResponse.json(intent, { status: 201 });
    }),

    // Get payment intent
    http.get(`${API_BASE}/v1/payment_intents/:id`, ({ params }) => {
        const intent = paymentIntentFactory.build({ id: params.id as string });
        return HttpResponse.json(intent);
    }),

    // Confirm payment intent
    http.post(`${API_BASE}/v1/payment_intents/:id/confirm`, ({ params }) => {
        const intent = paymentIntentFactory.build({
            id: params.id as string,
            status: 'succeeded',
        });
        return HttpResponse.json(intent);
    }),

    // Create charge
    http.post(`${API_BASE}/v1/charges`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const charge = createCharge({
            amount: body.amount as number,
            currency: (body.currency as string) || 'USD',
        });
        return HttpResponse.json(charge, { status: 201 });
    }),

    // Create refund
    http.post(`${API_BASE}/v1/refunds`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const refund = createRefund({
            chargeId: body.charge as string,
            amount: body.amount as number,
        });
        return HttpResponse.json(refund, { status: 201 });
    }),
];

/**
 * Zone Handlers
 */
export const zoneHandlers = [
    // List zones
    http.get(`${API_BASE}/v1/zones`, () => {
        const zones = [
            zoneFactory.build({ mode: 'test' }),
            zoneFactory.build({ mode: 'live' }),
        ];
        return HttpResponse.json({ data: zones });
    }),

    // Create zone
    http.post(`${API_BASE}/v1/zones`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const zone = createZone({
            name: body.name as string,
            mode: (body.mode as 'test' | 'live') || 'test',
        });
        return HttpResponse.json(zone, { status: 201 });
    }),

    // Get zone
    http.get(`${API_BASE}/v1/zones/:id`, ({ params }) => {
        const zone = zoneFactory.build({ id: params.id as string });
        return HttpResponse.json(zone);
    }),

    // Delete zone
    http.delete(`${API_BASE}/v1/zones/:id`, () => {
        return HttpResponse.json({ deleted: true });
    }),
];

/**
 * Auth Handlers
 */
export const authHandlers = [
    // Verify API key
    http.get(`${API_BASE}/v1/auth/verify`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer sk_')) {
            return HttpResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }
        return HttpResponse.json({
            valid: true,
            mode: authHeader.includes('test') ? 'test' : 'live',
        });
    }),
];

/**
 * Event Handlers
 */
export const eventHandlers = [
    // Emit event
    http.post(`${API_BASE}/v1/events`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
            id: `evt_${Date.now()}`,
            type: body.type,
            data: body.data,
            createdAt: new Date().toISOString(),
        }, { status: 201 });
    }),

    // List events
    http.get(`${API_BASE}/v1/events`, () => {
        return HttpResponse.json({
            data: [
                { id: 'evt_1', type: 'payment.succeeded', createdAt: new Date().toISOString() },
                { id: 'evt_2', type: 'checkout.completed', createdAt: new Date().toISOString() },
            ],
        });
    }),
];

/**
 * All handlers combined
 */
export const allHandlers = [
    ...paymentHandlers,
    ...zoneHandlers,
    ...authHandlers,
    ...eventHandlers,
];
