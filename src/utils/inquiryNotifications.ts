import { supabase } from '../supabase';

export interface SubmitClientInquiryInput {
  name: string;
  email: string;
  phone?: string;
  inquiryType?: string;
  message: string;
  propertyName?: string | null;
  source: string;
}

export interface WhatsAppDispatchResult {
  ok: boolean;
  sent: boolean;
  configured: boolean;
  provider?: string | null;
  deduplicated?: boolean;
  referenceId?: string;
  recipientMasked?: string;
  reason?: string;
  error?: string;
}

export interface SubmitClientInquiryResult {
  inquiryId: string;
  whatsapp: WhatsAppDispatchResult;
}

/**
 * Generates an RFC 4122 v4 UUID suitable for `public.inquiries.id` primary keys.
 */
export function generateClientUuid(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Triggers the `/api/notifyInquiry` serverless endpoint to dispatch a structured
 * WhatsApp notification to the website's linked WhatsApp account.
 */
export async function triggerInquiryWhatsAppDispatch(
  inquiryId: string,
  options: { accessToken?: string | null; timeoutMs?: number } = {}
): Promise<WhatsAppDispatchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 5500);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const originUrl =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

    const response = await fetch('/api/notifyInquiry', {
      method: 'POST',
      headers,
      body: JSON.stringify({ inquiryId, originUrl }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as Partial<WhatsAppDispatchResult>;
    if (!response.ok) {
      return {
        ok: false,
        sent: false,
        configured: false,
        error: data.error || data.reason || `Notification endpoint returned status ${response.status}`,
      };
    }

    return {
      ok: Boolean(data.ok),
      sent: Boolean(data.sent),
      configured: Boolean(data.configured),
      provider: data.provider ?? null,
      deduplicated: data.deduplicated,
      referenceId: data.referenceId,
      recipientMasked: data.recipientMasked,
      reason: data.reason,
    };
  } catch (err) {
    return {
      ok: false,
      sent: false,
      configured: false,
      reason: err instanceof Error ? err.message : 'Notification dispatch unavailable',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Persists a public client inquiry into `public.inquiries` (Admin Messages tab) and
 * immediately dispatches a structured executive WhatsApp alert in a non-blocking manner.
 */
export async function submitClientInquiry(
  input: SubmitClientInquiryInput
): Promise<SubmitClientInquiryResult> {
  const inquiryId = generateClientUuid();

  const rowPayload: Record<string, unknown> = {
    id: inquiryId,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: (input.phone ?? '').trim(),
    message: input.message.trim(),
    property_name: input.propertyName ? input.propertyName.trim() : null,
    status: 'Unread',
    source: input.source,
  };

  if (input.inquiryType?.trim()) {
    rowPayload.inquiry_type = input.inquiryType.trim();
  }

  const { error } = await supabase.from('inquiries').insert(rowPayload);
  if (error) {
    throw error;
  }

  const whatsapp = await triggerInquiryWhatsAppDispatch(inquiryId);
  if (!whatsapp.ok && whatsapp.error) {
    console.warn('[inquiryNotifications] WhatsApp alert warning:', whatsapp.error);
  }

  return { inquiryId, whatsapp };
}
