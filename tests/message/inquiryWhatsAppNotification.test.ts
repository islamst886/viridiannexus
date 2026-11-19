import { describe, it, expect, vi } from 'vitest';
import {
  buildInquiryTemplateParameters,
  buildWhatsAppChatUrl,
  formatClientWhatsAppReplyDraft,
  formatProfessionalWhatsAppInquiryMessage,
  normalizeClientWhatsAppDigits,
  parseInquiryDetails,
} from '../../src/utils/inquiryWhatsApp';
import {
  handleNotifyInquiryRequest,
  type NotifyInquiryEnv,
} from '../../src/utils/inquiryWhatsAppServer';

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('WhatsApp Inquiry Notification Engine', () => {
  describe('Formatting & Parsing Across All 4 Public Channels', () => {
    it('formats Corporate Contact Page inquiries with priority, SLA, client contact, and portal link', () => {
      const formatted = formatProfessionalWhatsAppInquiryMessage(
        {
          id: 'a1b2c3d4-e5f6-4789-8abc-1234567890ef',
          name: 'Shahana Parveen',
          email: 'shahana@example.com',
          phone: '01711223344',
          inquiry_type: 'NRB / International Purchase',
          property_name: 'Viridian Manor',
          source: 'Corporate Contact Page',
          message: 'Calling from London regarding foreign remittance options.',
          created_at: '2026-11-14T15:30:00Z',
        },
        { originUrl: 'https://viridiannexus.com' }
      );

      expect(formatted).toContain('*VIRIDIAN NEXUS DEVELOPMENT LTD.*');
      expect(formatted).toContain('Reference: *VN-INQ-A1B2C3*');
      expect(formatted).toContain('Priority: High Priority — NRB & Cross-Border Desk');
      expect(formatted).toContain('Category: NRB / International Purchase');
      expect(formatted).toContain('Origin: Corporate Contact Page');
      expect(formatted).toContain('Subject: Viridian Manor');
      expect(formatted).toContain('Name: Shahana Parveen');
      expect(formatted).toContain('Direct Client Reply: https://wa.me/8801711223344');
      expect(formatted).toContain('Calling from London regarding foreign remittance options.');
      expect(formatted).toContain('https://viridiannexus.com/admin/messages');
      expect(formatted.length).toBeLessThan(3900);
    });

    it('parses [VIP Consultation Request] blocks into clean executive portfolio fields without raw brackets', () => {
      const rawVipMessage =
        '[VIP Consultation Request]\nType: Virtual / NRB Video Walkthrough\nTarget Property: Viridian Jolshiri Exclusivity\nPreferred Date: 2026-12-01\nClient Notes: Need evening Dhaka slot.';

      const details = parseInquiryDetails({
        inquiry_type: 'Private Consultation',
        source: 'VIP Consultation Modal',
        property_name: 'Viridian Jolshiri Exclusivity',
        message: rawVipMessage,
      });

      expect(details.consultationFormat).toBe('Virtual / NRB Video Walkthrough');
      expect(details.subject).toBe('Viridian Jolshiri Exclusivity');
      expect(details.preferredSchedule).toBe('2026-12-01');
      expect(details.narrative).toBe('Need evening Dhaka slot.');

      const formatted = formatProfessionalWhatsAppInquiryMessage({
        id: '11223344-5566-4777-8888-999900001111',
        name: 'Dr. Tariqul Islam',
        email: 'tariqul@example.com',
        phone: '+44 7700 900123',
        inquiry_type: 'Private Consultation',
        source: 'VIP Consultation Modal',
        property_name: 'Viridian Jolshiri Exclusivity',
        message: rawVipMessage,
      });

      expect(formatted).not.toContain('[VIP Consultation Request]');
      expect(formatted).toContain('Consultation Format: Virtual / NRB Video Walkthrough');
      expect(formatted).toContain('Preferred Schedule: 2026-12-01');
      expect(formatted).toContain('Priority: High Priority — Private Client Advisory');
      expect(formatted).toContain('Direct Client Reply: https://wa.me/447700900123');
    });

    it('parses [Publication Dossier Request] blocks cleanly and handles optional phone numbers', () => {
      const formatted = formatProfessionalWhatsAppInquiryMessage(
        {
          id: 'deadbeef-1111-4222-8333-444455556666',
          name: 'Arif Chowdhury',
          email: 'arif@example.com',
          phone: '',
          inquiry_type: 'Brochure Request',
          property_name: 'Biophilic Living in Dhaka',
          source: 'Viridian Journal Page',
          message:
            '[Publication Dossier Request]\nArticle: Biophilic Living in Dhaka\nCategory: Architecture\nPhone: N/A\nNotes: Requested Full Dossier & Feasibility Whitepaper',
        },
        { originUrl: 'http://localhost:5173' }
      );

      expect(formatted).not.toContain('[Publication Dossier Request]');
      expect(formatted).not.toContain('localhost');
      expect(formatted).not.toContain('Direct Client Reply:');
      expect(formatted).toContain('Editorial Pillar: Architecture');
      expect(formatted).toContain('Phone / WhatsApp: Not provided');
      expect(formatted).toContain('Requested Full Dossier & Feasibility Whitepaper');
      expect(formatted).toContain('Priority: Information Dispatch — Dossier & Brochure');
    });

    it('sanitizes control characters and caps extremely long inquiry bodies within WhatsApp limits', () => {
      const longBody = 'A'.repeat(6000);
      const formatted = formatProfessionalWhatsAppInquiryMessage({
        id: '99887766-1122-4333-8444-555566667777',
        name: 'Test\nClient\r\x00Name',
        email: 'client@example.com',
        phone: '+8801811223344',
        source: 'Property Details Page',
        property_name: 'Viridian Residence',
        message: longBody,
      });

      expect(formatted).toContain('Name: Test Client Name');
      expect(formatted).toContain('[Full text in Admin Portal]');
      expect(formatted.length).toBeLessThanOrEqual(3900);
    });

    it('generates newline-free Meta template parameters and safe client wa.me reply drafts', () => {
      const inquiry = {
        id: 'abcdef12-0000-4000-8000-000000000000',
        name: 'Nadia\nRahman',
        email: 'nadia@example.com',
        phone: '01911223344',
        inquiry_type: 'Domestic Investment',
        property_name: 'Viridian Manor',
        source: 'Contact Page',
        message: 'Line 1\nLine 2\tDetails',
      };

      const params = buildInquiryTemplateParameters(inquiry);
      expect(params).toHaveLength(7);
      expect(params[0]).toBe('VN-INQ-ABCDEF');
      for (const param of params) {
        expect(param).not.toMatch(/[\r\n\t]/);
      }

      const replyDraft = formatClientWhatsAppReplyDraft(inquiry);
      expect(replyDraft).toContain('Dear Nadia Rahman,');
      expect(replyDraft).toContain('Ref: VN-INQ-ABCDEF');

      const waUrl = buildWhatsAppChatUrl('01911223344', replyDraft, {
        treatAsClientPhone: true,
      });
      expect(waUrl).toMatch(/^https:\/\/wa\.me\/8801911223344\?text=/);
      expect(normalizeClientWhatsAppDigits('invalid')).toBe('');
    });
  });

  describe('Serverless /api/notifyInquiry Handler', () => {
    const baseEnv: NotifyInquiryEnv = {
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    };

    const validInquiryId = '11111111-2222-4333-8444-555555555555';
    const recentCreatedAt = new Date('2026-11-14T18:00:00Z').toISOString();
    const fixedNow = () => Date.parse('2026-11-14T18:01:00Z');

    it('rejects non-POST methods and invalid inquiry UUID payloads', async () => {
      const getRes = await handleNotifyInquiryRequest(
        new Request('https://example.com/api/notifyInquiry', { method: 'GET' }),
        baseEnv
      );
      expect(getRes.status).toBe(405);

      const badUuidRes = await handleNotifyInquiryRequest(
        new Request('https://example.com/api/notifyInquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: 'not-a-uuid' }),
        }),
        baseEnv
      );
      expect(badUuidRes.status).toBe(400);
    });

    it('dispatches structured WhatsApp text alerts via Meta Cloud API to linked Site Settings number', async () => {
      const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
      const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        fetchCalls.push({ url, init });

        if (url.includes('/rest/v1/inquiries')) {
          return createJsonResponse([
            {
              id: validInquiryId,
              name: 'Karim Ahmed',
              email: 'karim@example.com',
              phone: '01712345678',
              inquiry_type: 'Private Consultation',
              property_name: 'Viridian Manor',
              source: 'Corporate Contact Page',
              message: 'Please schedule an executive briefing.',
              status: 'Unread',
              created_at: recentCreatedAt,
            },
          ]);
        }

        if (url.includes('/rest/v1/settings')) {
          return createJsonResponse([{ value: { whatsappNumber: '8801811998877' } }]);
        }

        if (url.includes('graph.facebook.com')) {
          return createJsonResponse({ messages: [{ id: 'wamid.HBgM12345' }] });
        }

        return createJsonResponse({}, 404);
      }) as unknown as typeof fetch;

      const dedupeMap = new Map<string, number>();
      const req = new Request('https://viridiannexus.com/api/notifyInquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: validInquiryId, originUrl: 'https://viridiannexus.com' }),
      });

      const res = await handleNotifyInquiryRequest(
        req,
        {
          ...baseEnv,
          WHATSAPP_CLOUD_ACCESS_TOKEN: 'meta-token',
          WHATSAPP_PHONE_NUMBER_ID: '9988776655',
        },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap }
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.sent).toBe(true);
      expect(data.provider).toBe('meta_cloud_api');
      expect(data.recipientMasked).toBe('***8877');
      expect(data.referenceId).toBe('VN-INQ-111111');

      const metaCall = fetchCalls.find((c) => c.url.includes('graph.facebook.com'));
      expect(metaCall).toBeDefined();
      const metaBody = JSON.parse(String(metaCall?.init?.body)) as {
        to: string;
        type: string;
        text: { body: string };
      };
      expect(metaBody.to).toBe('8801811998877');
      expect(metaBody.type).toBe('text');
      expect(metaBody.text.body).toContain('*VIRIDIAN NEXUS DEVELOPMENT LTD.*');
      expect(metaBody.text.body).toContain('Karim Ahmed');

      // Duplicate rapid submission with same inquiryId is deduplicated cleanly
      const dupRes = await handleNotifyInquiryRequest(
        new Request('https://viridiannexus.com/api/notifyInquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: validInquiryId }),
        }),
        {
          ...baseEnv,
          WHATSAPP_CLOUD_ACCESS_TOKEN: 'meta-token',
          WHATSAPP_PHONE_NUMBER_ID: '9988776655',
        },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap }
      );
      const dupData = (await dupRes.json()) as Record<string, unknown>;
      expect(dupData.deduplicated).toBe(true);
      expect(fetchCalls.filter((c) => c.url.includes('graph.facebook.com'))).toHaveLength(1);
    });

    it('supports Meta approved templates, Twilio WhatsApp, and custom Webhook gateways', async () => {
      const webhookCalls: Array<{ url: string; headers: HeadersInit | undefined; body: string }> = [];
      const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rest/v1/inquiries')) {
          return createJsonResponse([
            {
              id: validInquiryId,
              name: 'Nadia',
              email: 'nadia@example.com',
              phone: '+8801711000111',
              inquiry_type: 'Brochure Request',
              property_name: 'Viridian Manor',
              source: 'Viridian Journal Page',
              message: 'Please send feasibility whitepaper.',
              created_at: recentCreatedAt,
            },
          ]);
        }
        if (url.includes('/rest/v1/settings')) {
          return createJsonResponse([{ value: { whatsappNumber: '8801711998877' } }]);
        }
        if (url.includes('hooks.example.com')) {
          webhookCalls.push({ url, headers: init?.headers, body: String(init?.body || '') });
          return createJsonResponse({ received: true });
        }
        if (url.includes('api.twilio.com')) {
          webhookCalls.push({ url, headers: init?.headers, body: String(init?.body || '') });
          return createJsonResponse({ sid: 'SM123' });
        }
        if (url.includes('graph.facebook.com')) {
          webhookCalls.push({ url, headers: init?.headers, body: String(init?.body || '') });
          return createJsonResponse({ messages: [{ id: 'wamid.tpl' }] });
        }
        return createJsonResponse({}, 404);
      }) as unknown as typeof fetch;

      // 1. Meta Template mode
      const tplRes = await handleNotifyInquiryRequest(
        new Request('https://viridiannexus.com/api/notifyInquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: validInquiryId }),
        }),
        {
          ...baseEnv,
          WHATSAPP_CLOUD_ACCESS_TOKEN: 'meta-token',
          WHATSAPP_PHONE_NUMBER_ID: '1234',
          WHATSAPP_TEMPLATE_NAME: 'vn_inquiry_alert',
        },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap: new Map() }
      );
      expect(tplRes.status).toBe(200);
      expect(JSON.parse(webhookCalls[0].body).type).toBe('template');

      // 2. Twilio mode
      const twilioRes = await handleNotifyInquiryRequest(
        new Request('https://viridiannexus.com/api/notifyInquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: validInquiryId }),
        }),
        {
          ...baseEnv,
          TWILIO_ACCOUNT_SID: 'AC123',
          TWILIO_AUTH_TOKEN: 'auth456',
          TWILIO_WHATSAPP_FROM: '+14155238886',
        },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap: new Map() }
      );
      expect((await twilioRes.json()).provider).toBe('twilio');
      expect(webhookCalls[1].body).toContain('To=whatsapp%3A%2B8801711998877');

      // 3. Webhook mode
      const hookRes = await handleNotifyInquiryRequest(
        new Request('https://viridiannexus.com/api/notifyInquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: validInquiryId }),
        }),
        {
          ...baseEnv,
          WHATSAPP_WEBHOOK_URL: 'https://hooks.example.com/whatsapp',
          WHATSAPP_WEBHOOK_SECRET: 'hook-secret',
        },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap: new Map() }
      );
      expect((await hookRes.json()).provider).toBe('webhook');
      const hookPayload = JSON.parse(webhookCalls[2].body) as Record<string, unknown>;
      expect(hookPayload.event).toBe('inquiry.created');
      expect(hookPayload.recipientWhatsapp).toBe('8801711998877');
    });

    it('blocks stale public replays while allowing verified admin resends', async () => {
      const oldCreatedAt = '2026-10-01T10:00:00Z';
      const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/v1/user')) {
          return createJsonResponse({ id: 'admin-1', last_sign_in_at: '2026-11-14T17:00:00Z' });
        }
        if (url.includes('/rest/v1/profiles')) {
          return createJsonResponse([{ role: 'admin', is_banned: false }]);
        }
        if (url.includes('/rest/v1/rpc/is_session_valid')) {
          return createJsonResponse(true);
        }
        if (url.includes('/rest/v1/inquiries')) {
          return createJsonResponse([
            {
              id: validInquiryId,
              name: 'Old Client',
              email: 'old@example.com',
              phone: '01711223344',
              message: 'Older inquiry',
              created_at: oldCreatedAt,
            },
          ]);
        }
        if (url.includes('/rest/v1/settings')) {
          return createJsonResponse([{ value: { whatsappNumber: '8801711998877' } }]);
        }
        if (url.includes('hooks.example.com')) {
          return createJsonResponse({ ok: true });
        }
        return createJsonResponse({}, 404);
      }) as unknown as typeof fetch;

      // Public trigger on old inquiry -> rejected
      const staleRes = await handleNotifyInquiryRequest(
        new Request('https://viridiannexus.com/api/notifyInquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inquiryId: validInquiryId }),
        }),
        { ...baseEnv, WHATSAPP_WEBHOOK_URL: 'https://hooks.example.com/hook' },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap: new Map() }
      );
      expect(staleRes.status).toBe(403);

      // Admin resend on old inquiry -> allowed and sent
      const adminRes = await handleNotifyInquiryRequest(
        new Request('https://viridiannexus.com/api/notifyInquiry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-admin-jwt',
          },
          body: JSON.stringify({ inquiryId: validInquiryId }),
        }),
        { ...baseEnv, WHATSAPP_WEBHOOK_URL: 'https://hooks.example.com/hook' },
        { fetchFn: mockFetch, nowMs: fixedNow, dedupeMap: new Map() }
      );
      expect(adminRes.status).toBe(200);
      expect((await adminRes.json()).sent).toBe(true);
    });
  });
});
