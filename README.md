```
███████╗ █████╗ ██████╗ ██╗     ██╗   ██╗ ██╗   ██╗
██╔════╝██╔══██╗██╔══██╗██║     ██║   ██║ ╚██╗ ██╔╝
███████╗███████║██████╔╝██║     ██║   ██║  ╚████╔╝
╚════██║██╔══██║██╔══██╗██║     ██║   ██║   ╚██╔╝
███████║██║  ██║██║  ██║███████╗╚██████╔╝    ██║
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝     ╚═╝
```

# @sapliyio/fintech-testing

Shared test kit for the Sapliy AI-Native Financial Operations Platform — MSW mock servers, fixtures/factories, and assertion helpers.

> **Sapliy is an AI-native Financial Operations Intelligence Layer that turns business goals into reliable, explainable, auditable financial outcomes — by orchestrating the systems companies already run (Stripe, PayPal, Paddle, HubSpot, Xero), not replacing them.**

| Badge | |
|---|---|
| Package | [`@sapliyio/fintech-testing`](https://www.npmjs.com/package/@sapliyio/fintech-testing) |
| Version | `1.0.0` |
| License | [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) |
| Dependencies | `msw` (mock servers), optional `@sapliyio/fintech` peer for e2e helpers |
| Language | TypeScript |

> **Legacy package name:** `@sapliyio/fintech-testing` is the published name, kept for compatibility with the platform's fintech heritage. It is the official Sapliy test kit.

---

## What is this?

The **official test toolkit** for teams building on Sapliy. Instead of hand-writing mock servers and test data for every playbook and API call, install this package and get:

- **MSW mock handlers** for the Sapliy HTTP API — including `/v1/playbooks`, `/v1/playbooks/preview`, and `/v1/playbooks/decisions`
- **Fixtures & factories** for payments, charges, refunds, zones, API keys — and the MVP playbook model (dunning config, refund-approval config, decision entries, intent previews)
- **Assertion helpers** for webhook signature verification, ledger balance checks, scope checks, and idempotency keys
- **Utilities** for retries, random test IDs, mock events, and full e2e bootstrap against a running gateway

It is designed to mirror `sapliy-ecosystem/internal/playbook` model types, so tests and the real backend stay in sync.

## Install

```bash
npm install -D @sapliyio/fintech-testing
# or
yarn add -D @sapliyio/fintech-testing
```

## Quickstart

### Set up the mock server

```typescript
import { setupTestServer } from '@sapliyio/fintech-testing';

// In your test setup file (e.g., vitest.setup.ts)
setupTestServer();
```

`setupTestServer()` starts an MSW server with every handler (`allHandlers` + `playbookHandlers`), and manages `listen` / `resetHandlers` / `close` around your test run.

### Use fixtures

```typescript
import { createPaymentIntent, zoneFactory, apiKeyFactory } from '@sapliyio/fintech-testing';

const intent = createPaymentIntent({ amount: 5000, currency: 'EUR' });
const zone = zoneFactory.build({ mode: 'live', name: 'Production' });
const key = apiKeyFactory.build({ scopes: ['events:emit'] });
```

### Use playbook fixtures (mirrors `internal/playbook`)

```typescript
import {
  playbookFactory,
  decisionEntryFactory,
  intentPreviewFactory,
  defaultDunningConfig,
  defaultRefundApprovalConfig,
} from '@sapliyio/fintech-testing';

const playbook = playbookFactory.build({ type: 'revenue_recovery' });

const decision = decisionEntryFactory.build({
  event: 'refund.requested',
  action: 'request_approval',
  reason: 'Over $1,000 threshold — requires finance_manager approval',
  policyApplied: 'refund-approval-policy',
  confidence: 0.64,
});

const preview = intentPreviewFactory.build({ intent: 'Recover failed subscription payments' });

// Sane defaults straight from the engine
// defaultDunningConfig: maxRetries 4, first retry +5h, step +48h, final +96h, email, magic-link
// defaultRefundApprovalConfig: auto-approve under $1,000, approval over $1,000, 90-day window
```

### Webhook signature verification

```typescript
import { verifyWebhookSignature, generateWebhookSignature } from '@sapliyio/fintech-testing';

const payload = JSON.stringify({ type: 'payment.succeeded', data: {} });
const signature = generateWebhookSignature(payload, 'whsec_test_key');

const result = verifyWebhookSignature(payload, signature, 'whsec_test_key');
console.log(result.valid); // true
```

### Utilities

```typescript
import { retryWithBackoff, createMockEvent, createTestApiKey } from '@sapliyio/fintech-testing';

const result = await retryWithBackoff(
  () => fetchSomething(),
  { maxRetries: 3, initialDelay: 100 }
);

const event = createMockEvent('checkout.completed', { orderId: 'order_123' });
const key = createTestApiKey('test'); // sk_test_...
```

## API reference

### Mock handlers

| Export | Purpose |
|---|---|
| `paymentHandlers` | Payment intents, charges, refunds |
| `zoneHandlers` | Zone CRUD |
| `authHandlers` | API key verification (`/v1/auth/verify`) |
| `eventHandlers` | Event emission and listing |
| `playbookHandlers` | `/v1/playbooks` list/get/create, `/v1/playbooks/preview`, `/v1/playbooks/decisions` |
| `allHandlers` | All of the above combined |
| `server` / `setupTestServer()` | MSW server and lifecycle helper |

Handlers use the base URL `process.env.SAPLIY_API_URL || 'https://api.sapliy.io'`.

### Fixtures & factories

| Export | Purpose |
|---|---|
| `paymentIntentFactory.build()` / `createPaymentIntent({amount, currency})` | Payment intents |
| `chargeFactory.build()` / `createCharge(...)` | Charges |
| `refundFactory.build()` / `createRefund(...)` | Refunds |
| `zoneFactory.build()` / `createZone(...)` / `createZonePair(name)` | Zones + test/live pair |
| `apiKeyFactory.build()` / `createApiKey(...)` | API keys |
| `playbookFactory.build()` / `createPlaybook(type)` | Playbooks (dunning/refund config) |
| `decisionEntryFactory.build()` / `createDecisionEntry(...)` | Audit decision entries |
| `intentPreviewFactory.build()` | Intent previews |
| `defaultDunningConfig` / `defaultRefundApprovalConfig` | Engine defaults |
| `resetPaymentFixtures()` / `resetZoneFixtures()` / `resetPlaybookFixtures()` | Reset counters |

### Assertions

| Export | Purpose |
|---|---|
| `verifyWebhookSignature(payload, signature, secret, tolerance?)` | HMAC webhook verification |
| `generateWebhookSignature(payload, secret)` | Build valid test signatures |
| `assertLedgerBalance(entries, expectedBalance)` | Double-entry balance check |
| `assertHasScopes(keyScopes, requiredScopes)` | Scope / wildcard / prefix matching |
| `assertIdempotencyKey(key)` | Idempotency-key validation |

### Utilities & e2e helpers

| Export | Purpose |
|---|---|
| `retryWithBackoff(fn, opts?)` | Exponential backoff retry |
| `sleep(ms)` | Pause |
| `randomTestId(prefix?)` | Random test IDs |
| `createTestApiKey(mode)` / `createTestPublishableKey(mode)` / `parseApiKeyMode(key)` | Test keys |
| `createMockEvent(type, data)` | Mock events |
| `bootstrapE2EUser(prefix?)` | Full e2e bootstrap: register → verify → login → org → zone → API key (needs a running gateway at `GATEWAY_URL`, default `http://localhost:8080`) |
| `getDebugToken(email, type)` | Auth-service debug tokens (`AUTH_SERVICE_URL`, default `http://localhost:8081`) |

## Operational Playbooks

This is where playbook testing happens. The playbook fixtures and mock handlers cover all three MVP playbooks:

- **Revenue Recovery & Dunning** — `playbookFactory.build({ type: 'revenue_recovery' })` carries the engine's dunning defaults (4 retries: +5h, then days 3/5/7, email channel, magic-link). The `dunning-policy` decision entries and retry-schedule intent previews let you assert schedules without a backend.
- **Refund & Invoice Orchestration** — `defaultRefundApprovalConfig` encodes the policy gate (> $1,000 → manager approval, 90-day window); `refund-approval-policy` decision fixtures cover `request_approval` outcomes.
- **Audit Decision Log** — `decisionEntryFactory` builds append-only, hash-chained entries (`prevHash`, `hash`) with reason, policy applied, actor, and confidence.

The mock handlers expose `/v1/playbooks/preview` (AI intent previews) and `/v1/playbooks/decisions` so you can test the console's explainability UI end-to-end.

## Development

```bash
npm run build       # tsup
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (e2e-style suites require a live gateway on :8080)
npm run test:watch
```

## Part of the Sapliy platform

- [`sapliy-ecosystem`](https://github.com/Sapliy/sapliy-ecosystem) — core backend, playbook engine, policy & audit engines
- [`sapliy-sdk-node`](https://github.com/Sapliy/sapliy-sdk-node) — Node.js SDK (`@sapliyio/fintech`)
- [`sapliy-ui`](https://github.com/Sapliy/sapliy-ui) — React components (`@sapliyio/fintech-ui`)
- [`sapliy-automation`](https://github.com/Sapliy/sapliy-automation) — Sapliy console
- Docs — [docs.sapliy.io](https://docs.sapliy.io)

## License

MIT © [Sapliy](https://github.com/sapliy)