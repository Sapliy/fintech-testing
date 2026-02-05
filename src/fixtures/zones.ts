/**
 * Zone Fixtures
 */
export interface Zone {
    id: string;
    object: 'zone';
    name: string;
    mode: 'test' | 'live';
    organizationId: string;
    secretKey: string;
    publishableKey: string;
    createdAt: string;
    updatedAt: string;
}

export interface ApiKey {
    id: string;
    object: 'api_key';
    key: string;
    name: string;
    zoneId: string;
    scopes: string[];
    createdAt: string;
    expiresAt?: string;
}

let zoneCounter = 1;
let apiKeyCounter = 1;

/**
 * Factory for creating zones
 */
export const zoneFactory = {
    build(overrides: Partial<Zone> = {}): Zone {
        const id = overrides.id || `zone_test_${zoneCounter++}`;
        const mode = overrides.mode || 'test';
        return {
            id,
            object: 'zone',
            name: `Test Zone ${zoneCounter}`,
            mode,
            organizationId: 'org_test_1',
            secretKey: `sk_${mode}_${id}`,
            publishableKey: `pk_${mode}_${id}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...overrides,
        };
    },
};

/**
 * Factory for creating API keys
 */
export const apiKeyFactory = {
    build(overrides: Partial<ApiKey> = {}): ApiKey {
        const id = overrides.id || `key_test_${apiKeyCounter++}`;
        return {
            id,
            object: 'api_key',
            key: `sk_test_${id}`,
            name: 'Test API Key',
            zoneId: 'zone_test_1',
            scopes: ['events:emit', 'flows:read'],
            createdAt: new Date().toISOString(),
            ...overrides,
        };
    },
};

/**
 * Convenience functions
 */
export function createZone(params: { name?: string; mode?: 'test' | 'live' }): Zone {
    return zoneFactory.build({
        name: params.name,
        mode: params.mode || 'test',
    });
}

export function createApiKey(params: { zoneId?: string; scopes?: string[] }): ApiKey {
    return apiKeyFactory.build({
        zoneId: params.zoneId,
        scopes: params.scopes,
    });
}

/**
 * Create a test/live zone pair
 */
export function createZonePair(baseName: string): { test: Zone; live: Zone } {
    return {
        test: createZone({ name: `${baseName} (Test)`, mode: 'test' }),
        live: createZone({ name: `${baseName} (Live)`, mode: 'live' }),
    };
}

/**
 * Reset counters
 */
export function resetZoneFixtures() {
    zoneCounter = 1;
    apiKeyCounter = 1;
}
