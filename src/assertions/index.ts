import { createHmac } from 'crypto';

/**
 * Webhook signature verification assertion
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    tolerance = 300
): { valid: boolean; error?: string } {
    try {
        const parts = signature.split(',');
        const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
        const sig = parts.find(p => p.startsWith('v1='))?.slice(3);

        if (!timestamp || !sig) {
            return { valid: false, error: 'Invalid signature format' };
        }

        const ts = parseInt(timestamp, 10);
        const now = Math.floor(Date.now() / 1000);

        if (now - ts > tolerance) {
            return { valid: false, error: 'Signature timestamp expired' };
        }

        const signedPayload = `${timestamp}.${payload}`;
        const expectedSig = createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        if (sig !== expectedSig) {
            return { valid: false, error: 'Signature mismatch' };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, error: `Verification failed: ${error}` };
    }
}

/**
 * Generate a valid webhook signature for testing
 */
export function generateWebhookSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const sig = createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');
    return `t=${timestamp},v1=${sig}`;
}

/**
 * Assert that a ledger entry balances correctly
 */
export function assertLedgerBalance(
    entries: Array<{ type: 'credit' | 'debit'; amount: number }>,
    expectedBalance: number
): { valid: boolean; actualBalance: number; error?: string } {
    let balance = 0;

    for (const entry of entries) {
        if (entry.type === 'credit') {
            balance += entry.amount;
        } else {
            balance -= entry.amount;
        }
    }

    if (balance !== expectedBalance) {
        return {
            valid: false,
            actualBalance: balance,
            error: `Expected balance ${expectedBalance}, got ${balance}`,
        };
    }

    return { valid: true, actualBalance: balance };
}

/**
 * Assert that an API key has the required scopes
 */
export function assertHasScopes(
    keyScopes: string[],
    requiredScopes: string[]
): { valid: boolean; missingScopes: string[] } {
    const missing = requiredScopes.filter(scope => {
        // Check for wildcard match
        if (keyScopes.includes('*')) return false;
        if (keyScopes.includes(scope)) return false;

        // Check for prefix match (e.g., 'payments:*' matches 'payments:read')
        const [prefix] = scope.split(':');
        if (keyScopes.includes(`${prefix}:*`)) return false;

        return true;
    });

    return {
        valid: missing.length === 0,
        missingScopes: missing,
    };
}

/**
 * Assert idempotency key behavior
 */
export function assertIdempotencyKey(
    key: string,
    maxLength = 64
): { valid: boolean; error?: string } {
    if (!key || key.length === 0) {
        return { valid: false, error: 'Idempotency key cannot be empty' };
    }

    if (key.length > maxLength) {
        return { valid: false, error: `Idempotency key exceeds max length of ${maxLength}` };
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return { valid: false, error: 'Idempotency key contains invalid characters' };
    }

    return { valid: true };
}
