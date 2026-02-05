# Sapliy Fintech Testing

Test utilities for the Sapliy Fintech Ecosystem — mock servers, fixtures, and assertion helpers.

## Installation

```bash
npm install @sapliyio/fintech-testing --save-dev
```

## Features

- **Mock Servers**: MSW-based mock handlers for all API endpoints
- **Fixtures**: Factory functions for creating test data
- **Assertions**: Custom helpers for webhook signatures, ledger balances, etc.
- **Utilities**: Helper functions for retries, test IDs, and more

## Quick Start

### Setting Up Mock Server

```typescript
import { setupTestServer } from '@sapliyio/fintech-testing/mocks';

// In your test setup file (e.g., vitest.setup.ts)
setupTestServer();
```

### Using Fixtures

```typescript
import { 
  createPaymentIntent, 
  createZone, 
  zoneFactory 
} from '@sapliyio/fintech-testing/fixtures';

// Create a payment intent
const intent = createPaymentIntent({ amount: 5000, currency: 'EUR' });

// Create a zone with custom options
const zone = zoneFactory.build({ mode: 'live', name: 'Production' });
```

### Webhook Signature Verification

```typescript
import { 
  verifyWebhookSignature, 
  generateWebhookSignature 
} from '@sapliyio/fintech-testing';

// Generate a signature for testing
const payload = JSON.stringify({ type: 'payment.succeeded', data: {} });
const signature = generateWebhookSignature(payload, 'whsec_test_key');

// Verify in your tests
const result = verifyWebhookSignature(payload, signature, 'whsec_test_key');
console.log(result.valid); // true
```

### Other Utilities

```typescript
import { retryWithBackoff, createMockEvent } from '@sapliyio/fintech-testing';

// Retry flaky operations
const result = await retryWithBackoff(
  () => fetchSomething(),
  { maxRetries: 3, initialDelay: 100 }
);

// Create mock events
const event = createMockEvent('checkout.completed', { 
  orderId: 'order_123' 
});
```

## API Reference

### Mock Handlers

- `paymentHandlers` — Payment intents, charges, refunds
- `zoneHandlers` — Zone CRUD operations
- `authHandlers` — API key verification
- `eventHandlers` — Event emission and listing
- `allHandlers` — All handlers combined

### Fixtures

- `paymentIntentFactory.build(overrides)` — Create PaymentIntent
- `chargeFactory.build(overrides)` — Create Charge
- `refundFactory.build(overrides)` — Create Refund
- `zoneFactory.build(overrides)` — Create Zone
- `apiKeyFactory.build(overrides)` — Create ApiKey
- `createZonePair(name)` — Create test/live zone pair

### Assertions

- `verifyWebhookSignature(payload, signature, secret)`
- `assertLedgerBalance(entries, expectedBalance)`
- `assertHasScopes(keyScopes, requiredScopes)`
- `assertIdempotencyKey(key)`

## License

MIT © [Sapliy](https://github.com/sapliy)
