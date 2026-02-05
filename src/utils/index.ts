/**
 * Test utility functions
 */

/**
 * Wait for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random test ID
 */
export function randomTestId(prefix = 'test'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a test API key for the specified mode
 */
export function createTestApiKey(mode: 'test' | 'live' = 'test'): string {
    const prefix = mode === 'test' ? 'sk_test' : 'sk_live';
    return `${prefix}_${randomTestId()}`;
}

/**
 * Create a test publishable key
 */
export function createTestPublishableKey(mode: 'test' | 'live' = 'test'): string {
    const prefix = mode === 'test' ? 'pk_test' : 'pk_live';
    return `${prefix}_${randomTestId()}`;
}

/**
 * Parse API key to extract mode
 */
export function parseApiKeyMode(key: string): 'test' | 'live' | 'unknown' {
    if (key.includes('_test_')) return 'test';
    if (key.includes('_live_')) return 'live';
    return 'unknown';
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        shouldRetry?: (error: unknown) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 100,
        maxDelay = 5000,
        shouldRetry = () => true,
    } = options;

    let lastError: unknown;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            await sleep(delay);
            delay = Math.min(delay * 2, maxDelay);
        }
    }

    throw lastError;
}

/**
 * Create a mock event for testing
 */
export function createMockEvent(
    type: string,
    data: Record<string, unknown> = {}
): {
    id: string;
    type: string;
    data: Record<string, unknown>;
    createdAt: string;
    zoneId: string;
} {
    return {
        id: randomTestId('evt'),
        type,
        data,
        createdAt: new Date().toISOString(),
        zoneId: randomTestId('zone'),
    };
}
