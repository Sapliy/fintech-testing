/**
 * Payment Intent Fixtures
 */
export interface PaymentIntent {
    id: string;
    object: 'payment_intent';
    amount: number;
    currency: string;
    status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled';
    clientSecret: string;
    createdAt: string;
    metadata?: Record<string, string>;
}

export interface Charge {
    id: string;
    object: 'charge';
    amount: number;
    currency: string;
    status: 'pending' | 'succeeded' | 'failed';
    paymentIntentId?: string;
    createdAt: string;
}

export interface Refund {
    id: string;
    object: 'refund';
    amount: number;
    chargeId: string;
    status: 'pending' | 'succeeded' | 'failed';
    createdAt: string;
}

let paymentIntentCounter = 1;
let chargeCounter = 1;
let refundCounter = 1;

/**
 * Factory for creating payment intents
 */
export const paymentIntentFactory = {
    build(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
        const id = overrides.id || `pi_test_${paymentIntentCounter++}`;
        return {
            id,
            object: 'payment_intent',
            amount: 1000,
            currency: 'USD',
            status: 'requires_payment_method',
            clientSecret: `${id}_secret_test`,
            createdAt: new Date().toISOString(),
            ...overrides,
        };
    },
};

/**
 * Factory for creating charges
 */
export const chargeFactory = {
    build(overrides: Partial<Charge> = {}): Charge {
        return {
            id: overrides.id || `ch_test_${chargeCounter++}`,
            object: 'charge',
            amount: 1000,
            currency: 'USD',
            status: 'succeeded',
            createdAt: new Date().toISOString(),
            ...overrides,
        };
    },
};

/**
 * Factory for creating refunds
 */
export const refundFactory = {
    build(overrides: Partial<Refund> = {}): Refund {
        return {
            id: overrides.id || `re_test_${refundCounter++}`,
            object: 'refund',
            amount: 1000,
            chargeId: 'ch_test_1',
            status: 'succeeded',
            createdAt: new Date().toISOString(),
            ...overrides,
        };
    },
};

/**
 * Convenience functions
 */
export function createPaymentIntent(params: { amount: number; currency?: string }): PaymentIntent {
    return paymentIntentFactory.build({
        amount: params.amount,
        currency: params.currency || 'USD',
    });
}

export function createCharge(params: { amount: number; currency?: string }): Charge {
    return chargeFactory.build({
        amount: params.amount,
        currency: params.currency || 'USD',
    });
}

export function createRefund(params: { chargeId: string; amount?: number }): Refund {
    return refundFactory.build({
        chargeId: params.chargeId,
        amount: params.amount,
    });
}

/**
 * Reset counters (useful between tests)
 */
export function resetPaymentFixtures() {
    paymentIntentCounter = 1;
    chargeCounter = 1;
    refundCounter = 1;
}
