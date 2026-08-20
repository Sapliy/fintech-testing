import { http, HttpResponse } from 'msw';
import { playbookFactory, decisionEntryFactory, intentPreviewFactory } from '../fixtures/playbooks';

const API_BASE = process.env.SAPLIY_API_URL || 'https://api.sapliy.io';

/**
 * Playbook Handlers
 */
export const playbookHandlers = [
    // List playbooks
    http.get(`${API_BASE}/v1/playbooks`, () => {
        const playbooks = [
            playbookFactory.build({ type: 'revenue_recovery' }),
            playbookFactory.build({ type: 'refund_approval' }),
            playbookFactory.build({ type: 'invoice_reminders' }),
        ];
        return HttpResponse.json({ data: playbooks });
    }),

    // Get playbook
    http.get(`${API_BASE}/v1/playbooks/:id`, ({ params }) => {
        const playbook = playbookFactory.build({ id: params.id as string });
        return HttpResponse.json(playbook);
    }),

    // Create playbook
    http.post(`${API_BASE}/v1/playbooks`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const playbook = playbookFactory.build({
            type: (body.type as 'revenue_recovery' | 'refund_approval' | 'invoice_reminders') || 'revenue_recovery',
            name: body.name as string | undefined,
        });
        return HttpResponse.json(playbook, { status: 201 });
    }),

    // Preview an intent (AI-recommended steps before execution)
    http.post(`${API_BASE}/v1/playbooks/preview`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const preview = intentPreviewFactory.build({ intent: (body.intent as string) || 'Recover failed subscription payments' });
        return HttpResponse.json(preview, { status: 200 });
    }),

    // List decision log entries
    http.get(`${API_BASE}/v1/playbooks/decisions`, () => {
        const entries = [
            decisionEntryFactory.build(),
            decisionEntryFactory.build({
                event: 'refund.requested',
                action: 'request_approval',
                reason: 'Over $1,000 threshold — requires finance_manager approval',
                policyApplied: 'refund-approval-policy',
                confidence: 0.64,
            }),
            decisionEntryFactory.build({
                event: 'invoice.overdue',
                action: 'send_reminder',
                reason: 'Invoice overdue — reminder #1',
                policyApplied: 'invoice-reminder-policy',
                confidence: 0.77,
            }),
        ];
        return HttpResponse.json({ data: entries });
    }),

    // Get a single decision entry
    http.get(`${API_BASE}/v1/playbooks/decisions/:id`, ({ params }) => {
        const entry = decisionEntryFactory.build({ id: params.id as string });
        return HttpResponse.json(entry);
    }),
];