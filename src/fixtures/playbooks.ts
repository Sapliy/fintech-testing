/**
 * Operational Playbook Fixtures
 * Mirrors sapliy-ecosystem internal/playbook model types.
 */

export type PlaybookType = 'revenue_recovery' | 'refund_approval' | 'invoice_reminders';
export type PlaybookStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface DunningConfig {
    maxRetries: number;
    firstRetryDelay: string;
    retryStepDelay: string;
    finalRetryDelay: string;
    channels: string[];
    magicLink: boolean;
}

export interface RefundApprovalConfig {
    autoApproveUnderCents: number;
    requireApprovalOverCents: number;
    maxRefundDays: number;
    notifyChannels: string[];
}

export interface Playbook {
    id: string;
    type: PlaybookType;
    name: string;
    description?: string;
    zoneId?: string;
    orgId?: string;
    status: PlaybookStatus;
    config: DunningConfig | RefundApprovalConfig;
    createdAt: string;
    updatedAt: string;
}

export interface DecisionEntry {
    id: string;
    playbookId: string;
    tenantId: string;
    event: string;
    action: string;
    reason: string;
    policyApplied: string;
    aiReasoning?: string;
    confidence: number;
    actor?: string;
    createdAt: string;
    prevHash: string;
    hash: string;
}

export interface IntentStep {
    id: string;
    title: string;
    description?: string;
    risk: 'low' | 'medium' | 'high';
    confidence?: number;
}

export interface IntentPreview {
    id: string;
    intent: string;
    confidence: number;
    risk: 'low' | 'medium' | 'high';
    steps: IntentStep[];
    createdAt: string;
}

let playbookCounter = 1;
let decisionCounter = 1;
let intentCounter = 1;

export const defaultDunningConfig: DunningConfig = {
    maxRetries: 4,
    firstRetryDelay: '5h',
    retryStepDelay: '48h',
    finalRetryDelay: '96h',
    channels: ['email'],
    magicLink: true,
};

export const defaultRefundApprovalConfig: RefundApprovalConfig = {
    autoApproveUnderCents: 100000,
    requireApprovalOverCents: 100000,
    maxRefundDays: 90,
    notifyChannels: ['email', 'slack'],
};

export const playbookFactory = {
    build(overrides: Partial<Playbook> = {}): Playbook {
        const id = overrides.id || `plb_${playbookCounter++}`;
        const type = overrides.type || 'revenue_recovery';
        const config =
            type === 'refund_approval'
                ? defaultRefundApprovalConfig
                : defaultDunningConfig;
        return {
            id,
            type,
            name: type === 'refund_approval' ? 'Refund Approval' : 'Revenue Recovery & Dunning',
            status: 'active',
            config,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...overrides,
        } as Playbook;
    },
};

export const decisionEntryFactory = {
    build(overrides: Partial<DecisionEntry> = {}): DecisionEntry {
        const id = overrides.id || `dec_${decisionCounter++}`;
        return {
            id,
            playbookId: 'plb_1',
            tenantId: 'org_1',
            event: 'payment.failed',
            action: 'schedule_retry',
            reason: 'First retry in 4-6h (~22% recovery expected)',
            policyApplied: 'dunning-policy',
            confidence: 0.82,
            createdAt: new Date().toISOString(),
            prevHash: 'genesis',
            hash: `sha256_${id}`,
            ...overrides,
        };
    },
};

export const intentPreviewFactory = {
    build(overrides: Partial<IntentPreview> = {}): IntentPreview {
        const id = overrides.id || `int_${intentCounter++}`;
        return {
            id,
            intent: 'Recover failed subscription payments',
            confidence: 0.9,
            risk: 'medium',
            steps: [
                { id: 's1', title: 'Create Payment Intent', description: 'Amount $19.90 (1,990 cents)', risk: 'low', confidence: 0.95 },
                { id: 's2', title: 'Schedule Dunning Retry', description: 'First retry at ~5h, then days 3/5/7', risk: 'medium', confidence: 0.84 },
                { id: 's3', title: 'Refund Request', description: 'Over $1,000 — requires manager approval', risk: 'high', confidence: 0.6 },
            ],
            createdAt: new Date().toISOString(),
            ...overrides,
        };
    },
};

export function createPlaybook(type: PlaybookType, name?: string): Playbook {
    return playbookFactory.build({ type, name });
}

export function createDecisionEntry(overrides?: Partial<DecisionEntry>): DecisionEntry {
    return decisionEntryFactory.build(overrides);
}

export function resetPlaybookFixtures() {
    playbookCounter = 1;
    decisionCounter = 1;
    intentCounter = 1;
}