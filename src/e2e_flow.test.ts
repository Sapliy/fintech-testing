import { SapliyClient } from "@sapliyio/fintech"
import { describe, it, expect } from 'vitest';

/**
 * E2E Transaction Flow Test
 * 
 * This test validates the entire lifecycle of a transaction across the Sapliy ecosystem.
 * It uses the @sapliyio/fintech SDK to interact with the gateway and verifies
 * that events are correctly processed and recorded in the ledger.
 */
describe('E2E Transaction Flow', () => {
    // Note: This test assumes the ecosystem services are running (or mocked via MSW)
    const client = new SapliyClient({
        apiKey: 'sk_test_51MzS4nLp0Xxyz...',
        base_url: 'http://localhost:8080'
    });

    it('successfully processes a payment through the entire ecosystem', async () => {
        // 1. Create a Zone for the transaction
        const zoneName = `E2E-Test-Zone-${Date.now()}`;
        const zone = await client.auth.createZone({
            name: zoneName,
            mode: 'test'
        });
        expect(zone).toBeDefined();
        const zoneId = (zone as any).id;

        // 2. Trigger a Payment Event
        // In a real scenario, this might come from an external webhook or SDK call
        const paymentIntent = await client.payments.createPaymentIntent({
            amount: 5000,
            currency: 'usd',
            zone_id: zoneId,
            description: 'E2E Test Payment'
        });
        expect(paymentIntent).toBeDefined();
        const intentId = (paymentIntent as any).id;

        // 3. Confirm the Payment
        const confirmation = await client.payments.confirmPaymentIntent(intentId);
        expect((confirmation as any).status).toBe('succeeded');

        // 4. Verify Flow Execution (Wait for async processing/Kafka/Workers)
        // Polling or a fixed wait for demo purposes
        await new Promise(resolve => setTimeout(resolve, 500));

        // 5. Check Ledger Entry
        // Ensure the transaction was recorded in the ledger for this zone
        const ledgerEntries = await client.ledger.listEntries({ zone_id: zoneId });
        const entryFound = (ledgerEntries as any[]).some(e => e.amount === 5000 && e.type === 'credit');

        // Final assertion: The ledger should reflect the successful payment
        expect(entryFound).toBe(true);
    });

    it('handles unauthorized access appropriately', async () => {
        const badClient = new SapliyClient({ apiKey: 'invalid_key' });
        try {
            await badClient.auth.listZones();
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error).toBeDefined();
        }
    });
});
