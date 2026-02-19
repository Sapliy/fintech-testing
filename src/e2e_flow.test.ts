import { describe, it, expect, beforeAll } from 'vitest';
import { bootstrapE2EUser, E2EContext } from './utils/e2e-helpers';

/**
 * E2E Transaction Flow Test
 * 
 * This test validates the entire lifecycle of a transaction across the Sapliy ecosystem.
 * It uses the shared bootstrapE2EUser helper to create a verified user and API key.
 */
describe('E2E Transaction Flow', () => {
    let context: E2EContext;

    beforeAll(async () => {
        context = await bootstrapE2EUser('flow-e2e');
    }, 60000); // 60s timeout for setup

    it('successfully processes a payment through the entire ecosystem', async () => {
        const { client, zoneId } = context;
        // 1. Trigger a Payment Event
        const paymentIntentRes = await client.payments.createPaymentIntent(zoneId, {
            amount: 5000,
            currency: 'usd',
            description: 'E2E Test Payment'
        });
        const paymentIntent = (paymentIntentRes as any).data;
        expect(paymentIntent).toBeDefined();
        const intentId = paymentIntent.id;

        // 2. Confirm the Payment
        const confirmationRes = await client.payments.confirmPaymentIntent(intentId, zoneId, 'test', {
            payment_method_id: 'pm_card_visa'
        });
        const confirmation = (confirmationRes as any).data;
        expect(confirmation.status).toBe('succeeded');
    });
});
