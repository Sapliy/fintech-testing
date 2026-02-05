import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { allHandlers } from './handlers';

/**
 * Create a mock server for testing
 * Use in Node.js test environments (Jest, Vitest, etc.)
 */
export const server = setupServer(...allHandlers);

/**
 * Setup function for test suites
 * Call this in your test setup file
 */
export function setupTestServer() {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
}

export * from './handlers';
