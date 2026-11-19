export type TimestampInput =
  | string
  | { seconds?: number; toDate?: () => Date }
  | null
  | undefined;

export interface InquiryNotificationPayload {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  inquiryType?: string | null;
  inquiry_type?: string | null;
  propertyName?: string | null;
  property_name?: string | null;
  message?: string | null;
  source?: string | null;
  createdAt?: TimestampInput;
  created_at?: TimestampInput;
}

export interface WhatsAppMessageFormatOptions {
  originUrl?: string | null;
  maxBodyChars?: number;
}

export interface ParsedInquiryDetails {
  category: string;
  source: string;
  subject: string;
  consultationFormat?: string;
  preferredSchedule?: string;
  publicationCategory?: string;
  narrative: string;
}

interface PriorityProfile {
  priority: string;
  slaAction: string;
}

const WHATSAPP_MAX_TOTAL_CHARS = 3900;
const WHATSAPP_MAX_BRIEF_CHARS = 1200;
const DIVIDER = '──────────────────────────';

const PRIORITY_MAP: Record<string, PriorityProfile> = {
  'Private Consultation': {
    priority: 'High Priority — Private Client Advisory',
    slaAction:
      'Assign a Senior Investment Advisor and confirm appointment availability via WhatsApp or email within 2 business hours.',
  },
  'NRB / International Purchase': {
    priority: 'High Priority — NRB & Cross-Border Desk',
    slaAction:
      'Coordinate a timezone-aligned virtual briefing and prepare NITA / foreign remittance onboarding guidance.',
  },
  'Virtual Tour Request': {
    priority: 'Standard Priority — Virtual Concierge',
    slaAction:
      'Schedule a guided live architectural walkthrough and share digital floor-plan documentation.',
  },
  'Domestic Investment': {
    priority: 'Standard Priority — Portfolio Acquisition',
    slaAction:
      'Share current residence availability, payment schedule, and invite the client for a private enclave tour.',
  },
  'Property Inquiry': {
    priority: 'Standard Priority — Residence Acquisition',
    slaAction:
      'Respond with residence specifications, floor plans, and private site-visit options.',
  },
  'Brochure Request': {
    priority: 'Information Dispatch — Dossier & Brochure',
    slaAction:
      'Deliver the requested dossier or whitepaper PDF via WhatsApp/email and offer an advisory follow-up.',
  },
};

const DEFAULT_PRIORITY: PriorityProfile = {
  priority: 'Standard Priority — Concierge Desk',
  slaAction:
    'Acknowledge receipt promptly via WhatsApp or email and route the inquiry to the relevant portfolio advisor.',
};

/**
 * Strips all non-digit characters from a phone number string.
 */
export function cleanWhatsAppDigits(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\D/g, '');
}

/**
 * Normalizes a client-entered phone number into international WhatsApp digits
 * suitable for `https://wa.me/<digits>`. Handles `00` international prefixes and
 * standard 11-digit Bangladeshi mobile numbers (`01XXXXXXXXX` -> `8801XXXXXXXXX`).
 */
export function normalizeClientWhatsAppDigits(raw: unknown): string {
  let digits = cleanWhatsAppDigits(raw);
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (/^01[3-9]\d{8}$/.test(digits)) {
    digits = `88${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) {
    return '';
  }

  return digits;
}

function stripControlChars(input: string, preserveNewlines: boolean): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    const isCtrl = (code >= 0 && code <= 31) || code === 127;
    if (!isCtrl) {
      out += input[i];
    } else if (preserveNewlines && code === 10) {
      out += '\n';
    } else if (!preserveNewlines) {
      out += ' ';
    }
  }
  return out;
}

/**
 * Strips ASCII control characters and flattens whitespace for safe single-line WhatsApp fields.
 */
export function sanitizeSingleLine(value: unknown, maxLen = 180): string {
  if (typeof value !== 'string') return '';
  const cleaned = stripControlChars(value, false).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

/**
 * Sanitizes multi-line narrative copy while preserving intentional paragraph breaks
 * and blocking control-character injection.
 */
export function sanitizeNarrativeText(value: unknown, maxLen = WHATSAPP_MAX_BRIEF_CHARS): string {
  if (typeof value !== 'string') return '';
  const unified = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const normalized = stripControlChars(unified, true)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 35).trimEnd()}\n… [Full text in Admin Portal]`;
}

function resolveTimestampDate(rawDate?: TimestampInput): Date {
  if (!rawDate) return new Date();
  if (typeof rawDate === 'string') {
    const ms = Date.parse(rawDate);
    return Number.isFinite(ms) ? new Date(ms) : new Date();
  }
  if (typeof rawDate === 'object') {
    if (typeof rawDate.toDate === 'function') {
      const d = rawDate.toDate();
      if (d instanceof Date && Number.isFinite(d.getTime())) return d;
    }
    if (typeof rawDate.seconds === 'number' && Number.isFinite(rawDate.seconds)) {
      return new Date(rawDate.seconds * 1000);
    }
  }
  return new Date();
}

/**
 * Produces a concise deterministic executive inquiry reference code (e.g. `VN-INQ-8F2A1C`).
 */
export function generateInquiryReference(id?: string | null, createdAt?: TimestampInput): string {
  if (typeof id === 'string' && id.trim()) {
    const hex = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (hex.length >= 6) {
      return `VN-INQ-${hex.slice(0, 6)}`;
    }
  }

  const stamp = resolveTimestampDate(createdAt).getTime();
  return `VN-INQ-${Math.abs(stamp).toString(36).toUpperCase().slice(-6).padStart(6, '0')}`;
}

/**
 * Formats an ISO timestamp or Timestamp object into Bangladesh Standard Time (`Asia/Dhaka`),
 * falling back cleanly if the host runtime lacks timezone data.
 */
export function formatInquiryTimestampBST(rawDate?: TimestampInput): string {
  const date = resolveTimestampDate(rawDate);

  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${formatted} (BST)`;
  } catch {
    return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  }
}

function parseLabeledLines(lines: string[]): { fields: Record<string, string>; extraLines: string[] } {
  const fields: Record<string, string> = {};
  const extraLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 28) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      if (key && !key.includes(' ')) {
        fields[key] = val;
        continue;
      }
      if (key === 'target property' || key === 'preferred date' || key === 'client notes') {
        fields[key] = val;
        continue;
      }
    }
    extraLines.push(line);
  }

  return { fields, extraLines };
}

/**
 * Extracts structured metadata from raw inquiry records across all 4 portal entry points
 * (`Corporate Contact Page`, `VIP Consultation Modal`, `Property Details Page`, `Viridian Journal Page`).
 */
export function parseInquiryDetails(payload: InquiryNotificationPayload): ParsedInquiryDetails {
  const source = sanitizeSingleLine(payload.source, 100) || 'Corporate Website';
  const rawCategory = sanitizeSingleLine(payload.inquiryType ?? payload.inquiry_type, 100);
  const rawProperty = sanitizeSingleLine(payload.propertyName ?? payload.property_name, 160);
  const rawMessage = sanitizeNarrativeText(payload.message);

  let category = rawCategory || (source === 'Property Details Page' ? 'Property Inquiry' : 'General Inquiry');
  let subject = rawProperty || 'General Portfolio Inquiry';
  let consultationFormat: string | undefined;
  let preferredSchedule: string | undefined;
  let publicationCategory: string | undefined;
  let narrative = rawMessage;

  if (rawMessage.startsWith('[VIP Consultation Request]')) {
    const bodyLines = rawMessage.split('\n').slice(1);
    const { fields, extraLines } = parseLabeledLines(bodyLines);
    consultationFormat = sanitizeSingleLine(fields.type, 120) || undefined;
    subject = sanitizeSingleLine(fields['target property'], 160) || subject;
    preferredSchedule = sanitizeSingleLine(fields['preferred date'], 100) || undefined;
    const notesVal = fields['client notes'];
    const combinedNotes = [notesVal && notesVal !== 'None' ? notesVal : '', ...extraLines]
      .filter(Boolean)
      .join('\n');
    narrative = combinedNotes;
    if (!rawCategory) category = 'Private Consultation';
  } else if (rawMessage.startsWith('[Publication Dossier Request]')) {
    const bodyLines = rawMessage.split('\n').slice(1);
    const { fields, extraLines } = parseLabeledLines(bodyLines);
    subject = sanitizeSingleLine(fields.article, 160) || subject;
    publicationCategory = sanitizeSingleLine(fields.category, 100) || undefined;
    const notesVal = fields.notes;
    const combinedNotes = [notesVal, ...extraLines].filter(Boolean).join('\n');
    narrative = combinedNotes;
    if (!rawCategory) category = 'Brochure Request';
  }

  return {
    category,
    source,
    subject,
    consultationFormat,
    preferredSchedule,
    publicationCategory,
    narrative,
  };
}

/**
 * Resolves the advisory priority classification and recommended SLA response step.
 */
export function resolveInquiryPriority(category: string, source: string): PriorityProfile {
  if (PRIORITY_MAP[category]) {
    return PRIORITY_MAP[category];
  }
  if (source === 'VIP Consultation Modal') {
    return PRIORITY_MAP['Private Consultation'];
  }
  if (source === 'Viridian Journal Page') {
    return PRIORITY_MAP['Brochure Request'];
  }
  if (source === 'Property Details Page') {
    return PRIORITY_MAP['Property Inquiry'];
  }
  return DEFAULT_PRIORITY;
}

function getSafeAdminPortalUrl(originUrl?: string | null): string | null {
  if (!originUrl || typeof originUrl !== 'string') return null;
  try {
    const parsed = new URL(originUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return null;
    }
    return `${parsed.origin}/admin/messages`;
  } catch {
    return null;
  }
}

/**
 * Formats a client inquiry into an executive-grade, structured WhatsApp Business alert
 * suitable for immediate dispatch to Viridian Nexus Development Ltd.'s linked WhatsApp account.
 */
export function formatProfessionalWhatsAppInquiryMessage(
  payload: InquiryNotificationPayload,
  options: WhatsAppMessageFormatOptions = {}
): string {
  const details = parseInquiryDetails(payload);
  const priorityInfo = resolveInquiryPriority(details.category, details.source);
  const reference = generateInquiryReference(payload.id, payload.createdAt ?? payload.created_at);
  const receivedAt = formatInquiryTimestampBST(payload.createdAt ?? payload.created_at);

  const clientName = sanitizeSingleLine(payload.name, 120) || 'Prospective Client';
  const rawPhone = sanitizeSingleLine(payload.phone, 50);
  const clientEmail = sanitizeSingleLine(payload.email, 140) || 'Not provided';
  const clientWaDigits = normalizeClientWhatsAppDigits(rawPhone);
  const portalUrl = getSafeAdminPortalUrl(options.originUrl);

  const lines: string[] = [
    '*VIRIDIAN NEXUS DEVELOPMENT LTD.*',
    '_Executive Client Concierge — New Inquiry Alert_',
    DIVIDER,
    '',
    '*INQUIRY OVERVIEW*',
    `• Reference: *${reference}*`,
    `• Priority: ${priorityInfo.priority}`,
    `• Category: ${details.category}`,
    `• Origin: ${details.source}`,
    `• Received: ${receivedAt}`,
    '',
    '*PORTFOLIO & SUBJECT*',
    `• Subject: ${details.subject}`,
  ];

  if (details.consultationFormat) {
    lines.push(`• Consultation Format: ${details.consultationFormat}`);
  }
  if (details.preferredSchedule) {
    lines.push(`• Preferred Schedule: ${details.preferredSchedule}`);
  }
  if (details.publicationCategory) {
    lines.push(`• Editorial Pillar: ${details.publicationCategory}`);
  }

  lines.push(
    '',
    '*CLIENT PROFILE*',
    `• Name: ${clientName}`,
    `• Phone / WhatsApp: ${rawPhone || 'Not provided'}`,
    `• Email: ${clientEmail}`
  );

  if (clientWaDigits) {
    lines.push(`• Direct Client Reply: https://wa.me/${clientWaDigits}`);
  }

  lines.push(
    '',
    '*CLIENT BRIEF*',
    details.narrative || '_No additional remarks provided by client._',
    '',
    '*RECOMMENDED SLA ACTION*',
    priorityInfo.slaAction,
    '',
    DIVIDER,
    portalUrl
      ? `Admin Messages Desk: ${portalUrl}`
      : '_Manage status & advisor assignment in Admin Portal -> Messages._'
  );

  const fullText = lines.join('\n');
  const maxChars = options.maxBodyChars ?? WHATSAPP_MAX_TOTAL_CHARS;
  if (fullText.length <= maxChars) {
    return fullText;
  }

  const trimmedNarrative = sanitizeNarrativeText(
    details.narrative,
    Math.max(180, WHATSAPP_MAX_BRIEF_CHARS - (fullText.length - maxChars) - 40)
  );
  const fallbackIndex = lines.indexOf('*CLIENT BRIEF*');
  if (fallbackIndex !== -1 && fallbackIndex + 1 < lines.length) {
    lines[fallbackIndex + 1] = trimmedNarrative || '_See Admin Portal for full brief._';
  }
  return lines.join('\n').slice(0, maxChars);
}

/**
 * Generates compact single-line Meta WhatsApp Cloud API template body parameters (`{{1}}`..`{{7}}`),
 * complying with Meta's restriction against newlines/tabs inside template parameters.
 */
export function buildInquiryTemplateParameters(payload: InquiryNotificationPayload): string[] {
  const details = parseInquiryDetails(payload);
  const reference = generateInquiryReference(payload.id, payload.createdAt ?? payload.created_at);
  const clientName = sanitizeSingleLine(payload.name, 100) || 'Prospective Client';
  const clientPhone = sanitizeSingleLine(payload.phone, 40) || 'Not provided';
  const clientEmail = sanitizeSingleLine(payload.email, 120) || 'Not provided';
  const briefSnippet =
    sanitizeSingleLine(details.narrative, 280) || 'No additional remarks provided.';

  return [
    reference,
    `${details.category} (${details.source})`,
    clientName,
    clientPhone,
    clientEmail,
    details.subject,
    briefSnippet,
  ];
}

/**
 * Composes an executive acknowledgment message for an admin replying directly to a client on WhatsApp.
 */
export function formatClientWhatsAppReplyDraft(payload: InquiryNotificationPayload): string {
  const details = parseInquiryDetails(payload);
  const reference = generateInquiryReference(payload.id, payload.createdAt ?? payload.created_at);
  const clientName = sanitizeSingleLine(payload.name, 100) || 'Valued Guest';

  return [
    `Dear ${clientName},`,
    '',
    `Thank you for reaching out to Viridian Nexus Development Ltd. regarding ${details.subject} (Ref: ${reference}).`,
    '',
    'A Senior Investment Advisor from our Client Concierge Desk has received your inquiry and would be pleased to assist you personally. Could you please let us know a convenient time for a brief call or private consultation?',
    '',
    'Warm regards,',
    'Client Advisory Desk',
    'Viridian Nexus Development Ltd.',
  ].join('\n');
}

/**
 * Builds a validated `https://wa.me/<digits>` URL with an optional pre-filled message.
 */
export function buildWhatsAppChatUrl(
  rawNumber: unknown,
  prefillMessage?: string,
  options: { treatAsClientPhone?: boolean } = {}
): string | null {
  const digits = options.treatAsClientPhone
    ? normalizeClientWhatsAppDigits(rawNumber)
    : cleanWhatsAppDigits(rawNumber);

  if (!digits || digits.length < 8 || digits.length > 15) {
    return null;
  }

  if (!prefillMessage) {
    return `https://wa.me/${digits}`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(prefillMessage)}`;
}
