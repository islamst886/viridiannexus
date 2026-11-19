import { useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../context/GlobalState';
import { getAccessToken } from '../supabase';
import { triggerInquiryWhatsAppDispatch } from '../utils/inquiryNotifications';
import {
  buildWhatsAppChatUrl,
  formatClientWhatsAppReplyDraft,
  formatProfessionalWhatsAppInquiryMessage,
  type InquiryNotificationPayload,
} from '../utils/inquiryWhatsApp';
import WhatsAppIcon from './WhatsAppIcon';

interface InquiryWhatsAppActionsProps {
  inquiry: InquiryNotificationPayload & { id: string };
}

const PROVIDER_LABELS: Record<string, string> = {
  meta_cloud_api: 'Meta WhatsApp Cloud API',
  twilio: 'Twilio WhatsApp',
  webhook: 'WhatsApp Webhook Gateway',
};

export default function InquiryWhatsAppActions({ inquiry }: InquiryWhatsAppActionsProps) {
  const { siteSettings } = useGlobalState();
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastDispatchNote, setLastDispatchNote] = useState<string | null>(null);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const formattedAlert = useMemo(
    () => formatProfessionalWhatsAppInquiryMessage(inquiry, { originUrl }),
    [inquiry, originUrl]
  );

  const clientReplyDraft = useMemo(() => formatClientWhatsAppReplyDraft(inquiry), [inquiry]);

  const linkedForwardUrl = useMemo(
    () => buildWhatsAppChatUrl(siteSettings?.whatsappNumber, formattedAlert),
    [siteSettings?.whatsappNumber, formattedAlert]
  );

  const clientReplyUrl = useMemo(
    () =>
      buildWhatsAppChatUrl(inquiry.phone, clientReplyDraft, {
        treatAsClientPhone: true,
      }),
    [inquiry.phone, clientReplyDraft]
  );

  const handleServerDispatch = async (): Promise<void> => {
    setSending(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Please sign in again to dispatch WhatsApp notifications.');
        return;
      }

      const result = await triggerInquiryWhatsAppDispatch(inquiry.id, {
        accessToken: token,
        timeoutMs: 10000,
      });

      if (result.sent) {
        const providerLabel = (result.provider && PROVIDER_LABELS[result.provider]) || 'WhatsApp API';
        const note = `Alert sent to linked WhatsApp (${result.recipientMasked || 'desk'}) via ${providerLabel}.`;
        setLastDispatchNote(note);
        toast.success(note);
        return;
      }

      if (!result.configured) {
        const note =
          result.reason ||
          'Automated WhatsApp API gateway is not yet configured on the server. Use "Forward via WhatsApp Web" or configure Meta Cloud API / Twilio / Webhook env vars.';
        setLastDispatchNote(note);
        toast.info(note);
        return;
      }

      const errMsg = result.error || result.reason || 'Failed to deliver WhatsApp notification.';
      setLastDispatchNote(errMsg);
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  const handleCopyBrief = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(formattedAlert);
      setCopied(true);
      toast.success('Structured WhatsApp executive brief copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Clipboard access unavailable in this browser.');
    }
  };

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#25D366]/10 text-[#128C7E] shrink-0 mt-0.5">
            <WhatsAppIcon size={18} />
          </div>
          <div>
            <h5 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              WhatsApp Concierge Notification
            </h5>
            <p className="text-xs text-gray-500 mt-0.5">
              {siteSettings?.whatsappNumber
                ? `Linked company account: +${siteSettings.whatsappNumber}`
                : 'No linked WhatsApp number configured in Site Settings yet.'}
            </p>
            {lastDispatchNote && (
              <p className="text-xs font-medium text-brand-primary mt-1">{lastDispatchNote}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleServerDispatch()}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Push to Linked WhatsApp
          </button>

          {linkedForwardUrl && (
            <a
              href={linkedForwardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors"
            >
              <WhatsAppIcon size={14} />
              Forward via WhatsApp Web
            </a>
          )}

          {clientReplyUrl && (
            <a
              href={clientReplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-[#128C7E]/30 text-[#128C7E] bg-[#25D366]/5 hover:bg-[#25D366]/15 transition-colors"
            >
              <WhatsAppIcon size={14} />
              Reply Client on WhatsApp
            </a>
          )}

          <button
            type="button"
            onClick={() => void handleCopyBrief()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Brief'}
          </button>

          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? 'Hide Alert Preview' : 'Preview Alert'}
          </button>
        </div>
      </div>

      {showPreview && (
        <pre className="mt-4 p-4 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
          {formattedAlert}
        </pre>
      )}
    </div>
  );
}
