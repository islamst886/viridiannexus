import {
  buildInquiryTemplateParameters,
  formatProfessionalWhatsAppInquiryMessage,
  generateInquiryReference,
  normalizeClientWhatsAppDigits,
  parseInquiryDetails,
  resolveInquiryPriority,
  type InquiryNotificationPayload,
} from './inquiryWhatsApp.js';

export type WhatsAppProviderName = 'meta_cloud_api' | 'twilio' | 'webhook';

export interface NotifyInquiryEnv {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WHATSAPP_PROVIDER?: string;
  WHATSAPP_CLOUD_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  WHATSAPP_WEBHOOK_URL?: string;
  WHATSAPP_WEBHOOK_SECRET?: string;
  WHATSAPP_RECIPIENT_NUMBER?: string;
  PUBLIC_SITE_URL?: string;
}

export interface NotifyInquiryDeps {
  fetchFn?: typeof fetch;
  nowMs?: () => number;
  dedupeMap?: Map<string, number>;
}

interface SupabaseInquiryRow extends InquiryNotificationPayload {
  id: string;
  created_at?: string;
}

interface SupabaseAuthUserResponse {
  id?: string;
  last_sign_in_at?: string | null;
}

interface ProfileRoleRow {
  role?: string;
  is_banned?: boolean;
}

interface DispatchOutcome {
  sent: boolean;
  configured: boolean;
  provider: WhatsAppProviderName | null;
  reason?: string;
  externalId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPABASE_API_SUFFIX_RE = /\/+(?:rest|auth|storage|realtime)\/v1\/?$/i;
const ADMIN_MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
const PUBLIC_INQUIRY_MAX_AGE_MS = 15 * 60 * 1000;
const DEDUPE_TTL_MS = 10 * 60 * 1000;
const DEDUPE_MAX_ENTRIES = 500;

const defaultDedupeMap = new Map<string, number>();

export function jsonHttpResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeSupabaseBaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.username || parsed.password) return '';
    const cleanedPath = parsed.pathname.replace(SUPABASE_API_SUFFIX_RE, '').replace(/\/+$/, '');
    return `${parsed.origin}${cleanedPath}`;
  } catch {
    return '';
  }
}

function normalizeWebhookUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (!parsed.hostname || parsed.username || parsed.password) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function recordDedupe(map: Map<string, number>, inquiryId: string, now: number): boolean {
  for (const [key, ts] of map.entries()) {
    if (now - ts > DEDUPE_TTL_MS) {
      map.delete(key);
    }
  }
  const existing = map.get(inquiryId);
  if (existing !== undefined && now - existing <= DEDUPE_TTL_MS) {
    return true;
  }
  if (map.size >= DEDUPE_MAX_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(inquiryId, now);
  return false;
}

async function verifyAdminBearerToken(
  token: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchFn: typeof fetch
): Promise<{ authorized: boolean; status: number; error?: string }> {
  const userRes = await fetchFn(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: serviceRoleKey,
    },
  });

  if (!userRes.ok) {
    return { authorized: false, status: 401, error: 'Invalid or expired authorization token' };
  }

  const userData = (await userRes.json()) as SupabaseAuthUserResponse;
  if (!userData.id) {
    return { authorized: false, status: 401, error: 'Invalid or expired authorization token' };
  }

  const profileRes = await fetchFn(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userData.id)}&select=role,is_banned`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    }
  );

  if (!profileRes.ok) {
    return { authorized: false, status: 403, error: 'Admin privileges required' };
  }

  const profiles = (await profileRes.json()) as ProfileRoleRow[];
  const profile = profiles[0];
  if (
    !profile ||
    profile.is_banned ||
    (profile.role !== 'admin' && profile.role !== 'super_admin')
  ) {
    return { authorized: false, status: 403, error: 'Admin privileges required' };
  }

  try {
    const rpcRes = await fetchFn(`${supabaseUrl}/rest/v1/rpc/is_session_valid`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });
    if (rpcRes.ok) {
      const valid = Boolean(await rpcRes.json());
      if (!valid) {
        return { authorized: false, status: 401, error: 'Session expired. Please sign in again.' };
      }
      return { authorized: true, status: 200 };
    }
    if (rpcRes.status === 401 || rpcRes.status === 403) {
      return { authorized: false, status: 401, error: 'Session expired. Please sign in again.' };
    }
  } catch {
    // Fall back to sign-in timestamp validation if RPC is unavailable
  }

  if (userData.last_sign_in_at) {
    const signInMs = Date.parse(userData.last_sign_in_at);
    if (Number.isFinite(signInMs) && Date.now() - signInMs > ADMIN_MAX_SESSION_AGE_MS) {
      return { authorized: false, status: 401, error: 'Session expired. Please sign in again.' };
    }
  }

  return { authorized: true, status: 200 };
}

async function fetchInquiryById(
  inquiryId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchFn: typeof fetch
): Promise<SupabaseInquiryRow | null> {
  const selectCols = 'id,name,email,phone,inquiry_type,message,property_name,source,status,created_at';
  const res = await fetchFn(
    `${supabaseUrl}/rest/v1/inquiries?id=eq.${encodeURIComponent(inquiryId)}&select=${selectCols}&limit=1`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Supabase inquiry lookup failed with status ${res.status}`);
  }
  const rows = (await res.json()) as SupabaseInquiryRow[];
  return rows[0] ?? null;
}

async function fetchLinkedWhatsappNumber(
  supabaseUrl: string,
  serviceRoleKey: string,
  env: NotifyInquiryEnv,
  fetchFn: typeof fetch
): Promise<string> {
  try {
    const res = await fetchFn(
      `${supabaseUrl}/rest/v1/settings?key=eq.site&select=value&limit=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ value?: { whatsappNumber?: unknown } }>;
      const fromSettings = normalizeClientWhatsAppDigits(rows[0]?.value?.whatsappNumber);
      if (fromSettings) return fromSettings;
    }
  } catch {
    // Fall back to optional server override below
  }

  return normalizeClientWhatsAppDigits(env.WHATSAPP_RECIPIENT_NUMBER);
}

async function sendViaMetaCloudApi(
  env: NotifyInquiryEnv,
  recipientDigits: string,
  formattedMessage: string,
  inquiry: InquiryNotificationPayload,
  fetchFn: typeof fetch
): Promise<DispatchOutcome> {
  const accessToken = env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() || '';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  if (!accessToken || !phoneNumberId) {
    return { sent: false, configured: false, provider: null };
  }

  const graphVersion = (env.WHATSAPP_GRAPH_VERSION || 'v21.0').trim().replace(/[^a-zA-Z0-9._-]/g, '') || 'v21.0';
  const templateName = env.WHATSAPP_TEMPLATE_NAME?.trim() || '';
  const templateLang = env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en_US';

  const bodyPayload = templateName
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientDigits,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: 'body',
              parameters: buildInquiryTemplateParameters(inquiry).map((text) => ({
                type: 'text',
                text,
              })),
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientDigits,
        type: 'text',
        text: {
          preview_url: false,
          body: formattedMessage,
        },
      };

  const res = await fetchFn(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[api/notifyInquiry] Meta Cloud API error:', res.status, errText);
    return {
      sent: false,
      configured: true,
      provider: 'meta_cloud_api',
      reason: `Meta WhatsApp API rejected delivery (status ${res.status}).`,
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
  };

  return {
    sent: true,
    configured: true,
    provider: 'meta_cloud_api',
    externalId: data.messages?.[0]?.id,
  };
}

async function sendViaTwilio(
  env: NotifyInquiryEnv,
  recipientDigits: string,
  formattedMessage: string,
  fetchFn: typeof fetch
): Promise<DispatchOutcome> {
  const sid = env.TWILIO_ACCOUNT_SID?.trim() || '';
  const authToken = env.TWILIO_AUTH_TOKEN?.trim() || '';
  const fromDigits = normalizeClientWhatsAppDigits(env.TWILIO_WHATSAPP_FROM);
  if (!sid || !authToken || !fromDigits) {
    return { sent: false, configured: false, provider: null };
  }

  const form = new URLSearchParams({
    From: `whatsapp:+${fromDigits}`,
    To: `whatsapp:+${recipientDigits}`,
    Body: formattedMessage,
  });

  const res = await fetchFn(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[api/notifyInquiry] Twilio WhatsApp error:', res.status, errText);
    return {
      sent: false,
      configured: true,
      provider: 'twilio',
      reason: `Twilio WhatsApp API rejected delivery (status ${res.status}).`,
    };
  }

  const data = (await res.json().catch(() => ({}))) as { sid?: string };
  return {
    sent: true,
    configured: true,
    provider: 'twilio',
    externalId: data.sid,
  };
}

async function sendViaWebhook(
  env: NotifyInquiryEnv,
  recipientDigits: string,
  formattedMessage: string,
  inquiry: SupabaseInquiryRow,
  fetchFn: typeof fetch
): Promise<DispatchOutcome> {
  const webhookUrl = normalizeWebhookUrl(env.WHATSAPP_WEBHOOK_URL);
  if (!webhookUrl) {
    return { sent: false, configured: false, provider: null };
  }

  const parsed = parseInquiryDetails(inquiry);
  const priority = resolveInquiryPriority(parsed.category, parsed.source);
  const referenceId = generateInquiryReference(inquiry.id, inquiry.created_at);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const secret = env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (secret) {
    headers['X-Webhook-Secret'] = secret;
    headers.Authorization = `Bearer ${secret}`;
  }

  const payload = {
    event: 'inquiry.created',
    company: 'Viridian Nexus Development Ltd.',
    referenceId,
    recipientWhatsapp: recipientDigits,
    formattedMessage,
    message: formattedMessage,
    inquiry: {
      id: inquiry.id,
      name: inquiry.name || '',
      email: inquiry.email || '',
      phone: inquiry.phone || '',
      category: parsed.category,
      subject: parsed.subject,
      priority: priority.priority,
      recommendedAction: priority.slaAction,
      source: parsed.source,
      narrative: parsed.narrative,
      consultationFormat: parsed.consultationFormat ?? null,
      preferredSchedule: parsed.preferredSchedule ?? null,
      publicationCategory: parsed.publicationCategory ?? null,
      createdAt: inquiry.created_at ?? null,
    },
  };

  const res = await fetchFn(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[api/notifyInquiry] Webhook delivery error:', res.status, errText);
    return {
      sent: false,
      configured: true,
      provider: 'webhook',
      reason: `WhatsApp webhook endpoint responded with status ${res.status}.`,
    };
  }

  return {
    sent: true,
    configured: true,
    provider: 'webhook',
  };
}

async function dispatchToConfiguredProvider(
  env: NotifyInquiryEnv,
  recipientDigits: string,
  formattedMessage: string,
  inquiry: SupabaseInquiryRow,
  fetchFn: typeof fetch
): Promise<DispatchOutcome> {
  const explicit = (env.WHATSAPP_PROVIDER || '').trim().toLowerCase();

  const tryMeta = () => sendViaMetaCloudApi(env, recipientDigits, formattedMessage, inquiry, fetchFn);
  const tryTwilio = () => sendViaTwilio(env, recipientDigits, formattedMessage, fetchFn);
  const tryWebhook = () => sendViaWebhook(env, recipientDigits, formattedMessage, inquiry, fetchFn);

  if (explicit === 'meta' || explicit === 'meta_cloud_api') return tryMeta();
  if (explicit === 'twilio') return tryTwilio();
  if (explicit === 'webhook') return tryWebhook();

  const metaReady = Boolean(env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() && env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  if (metaReady) return tryMeta();

  const twilioReady = Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      normalizeClientWhatsAppDigits(env.TWILIO_WHATSAPP_FROM)
  );
  if (twilioReady) return tryTwilio();

  if (normalizeWebhookUrl(env.WHATSAPP_WEBHOOK_URL)) {
    return tryWebhook();
  }

  return {
    sent: false,
    configured: false,
    provider: null,
    reason: 'No WhatsApp Business API provider configured on the server.',
  };
}

/**
 * Shared serverless handler for `/api/notifyInquiry` (used by both Vercel Node
 * and Cloudflare Pages Functions).
 */
export async function handleNotifyInquiryRequest(
  request: Request,
  env: NotifyInquiryEnv,
  deps: NotifyInquiryDeps = {}
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonHttpResponse({ error: 'Method not allowed' }, 405);
  }

  const fetchFn = deps.fetchFn ?? globalThis.fetch;
  const now = (deps.nowMs ?? Date.now)();
  const dedupeMap = deps.dedupeMap ?? defaultDedupeMap;

  let body: { inquiryId?: unknown; originUrl?: unknown } = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === 'object') {
      body = raw as { inquiryId?: unknown; originUrl?: unknown };
    }
  } catch {
    return jsonHttpResponse({ error: 'Invalid JSON request body' }, 400);
  }

  const inquiryId = typeof body.inquiryId === 'string' ? body.inquiryId.trim() : '';
  if (!UUID_RE.test(inquiryId)) {
    return jsonHttpResponse({ error: 'Valid inquiryId UUID is required' }, 400);
  }

  const supabaseUrl = normalizeSupabaseBaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const authHeader = request.headers.get('authorization') || '';

  if (!supabaseUrl || !serviceRoleKey) {
    if (authHeader) {
      return jsonHttpResponse(
        {
          ok: false,
          sent: false,
          configured: false,
          reason: 'Server configuration incomplete (SUPABASE_SERVICE_ROLE_KEY missing).',
        },
        503
      );
    }
    return jsonHttpResponse(
      {
        ok: true,
        sent: false,
        configured: false,
        reason: 'Server verification key not configured.',
      },
      200
    );
  }

  let isAdminRequest = false;
  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return jsonHttpResponse({ error: 'Invalid authorization header' }, 401);
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return jsonHttpResponse({ error: 'Authorization token required' }, 401);
    }
    const authResult = await verifyAdminBearerToken(token, supabaseUrl, serviceRoleKey, fetchFn);
    if (!authResult.authorized) {
      return jsonHttpResponse({ error: authResult.error || 'Unauthorized' }, authResult.status);
    }
    isAdminRequest = true;
  }

  try {
    const inquiry = await fetchInquiryById(inquiryId, supabaseUrl, serviceRoleKey, fetchFn);
    if (!inquiry) {
      return jsonHttpResponse({ error: 'Inquiry not found' }, 404);
    }

    if (!isAdminRequest) {
      if (inquiry.created_at) {
        const createdMs = Date.parse(inquiry.created_at);
        if (Number.isFinite(createdMs) && now - createdMs > PUBLIC_INQUIRY_MAX_AGE_MS) {
          return jsonHttpResponse({ error: 'Inquiry notification window expired' }, 403);
        }
      }
      if (recordDedupe(dedupeMap, inquiryId, now)) {
        return jsonHttpResponse(
          { ok: true, sent: true, deduplicated: true, referenceId: generateInquiryReference(inquiryId, inquiry.created_at) },
          200
        );
      }
    }

    const recipientDigits = await fetchLinkedWhatsappNumber(supabaseUrl, serviceRoleKey, env, fetchFn);
    if (!recipientDigits) {
      return jsonHttpResponse(
        {
          ok: true,
          sent: false,
          configured: false,
          reason: 'No linked WhatsApp number configured in Site Settings.',
        },
        200
      );
    }

    const effectiveOrigin =
      env.PUBLIC_SITE_URL?.trim() ||
      (typeof body.originUrl === 'string' ? body.originUrl.trim() : '');

    const formattedMessage = formatProfessionalWhatsAppInquiryMessage(inquiry, {
      originUrl: effectiveOrigin,
    });

    const outcome = await dispatchToConfiguredProvider(
      env,
      recipientDigits,
      formattedMessage,
      inquiry,
      fetchFn
    );

    const recipientMasked = `***${recipientDigits.slice(-4)}`;
    return jsonHttpResponse(
      {
        ok: true,
        sent: outcome.sent,
        configured: outcome.configured,
        provider: outcome.provider,
        referenceId: generateInquiryReference(inquiry.id, inquiry.created_at),
        recipientMasked,
        ...(outcome.externalId ? { externalId: outcome.externalId } : {}),
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      },
      200
    );
  } catch (err) {
    console.error('[api/notifyInquiry] Unexpected error:', err);
    return jsonHttpResponse({ error: 'Failed to process WhatsApp notification' }, 500);
  }
}
