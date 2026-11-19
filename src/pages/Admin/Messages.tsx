import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import InquiryWhatsAppActions from '../../components/InquiryWhatsAppActions';
import { useGlobalState } from '../../context/GlobalState';
import { BellRing, CheckCheck, ChevronDown, ChevronUp, Mail, MailOpen, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';
import { sanitizeMailtoHref, sanitizeTelHref } from '../../utils/urlHelpers';

interface FirebaseTimestampLike {
  seconds: number;
}

interface InquiryRow {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  status?: string | null;
  source?: string | null;
  inquiry_type?: string | null;
  inquiryType?: string | null;
  property_name?: string | null;
  propertyName?: string | null;
  created_at?: string | null;
  createdAt?: string | FirebaseTimestampLike | null;
}

function getInquiryDate(inquiry: InquiryRow): Date | null {
  const raw = inquiry.created_at ?? inquiry.createdAt;
  if (!raw) return null;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    return new Date(raw.seconds * 1000);
  }
  return null;
}

async function fetchInquiriesList(): Promise<InquiryRow[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as InquiryRow[]) || [];
}

export default function AdminMessages() {
  const { refreshUnreadInquiriesCount } = useGlobalState();
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Unread' | 'Read'>('All');

  useEffect(() => {
    let active = true;

    const loadMessages = (): void => {
      void fetchInquiriesList()
        .then((rows) => {
          if (active) {
            setInquiries(rows);
          }
        })
        .catch((error) => {
          toast.error('Failed to fetch messages');
          console.error(error);
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
      void refreshUnreadInquiriesCount();
    };

    loadMessages();

    const sub = supabase
      .channel('admin_messages_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(sub);
    };
  }, [refreshUnreadInquiriesCount]);

  const unreadCount = useMemo(
    () => inquiries.filter((i) => i.status === 'Unread').length,
    [inquiries]
  );

  const readCount = inquiries.length - unreadCount;

  const filteredInquiries = useMemo(() => {
    if (statusFilter === 'Unread') {
      return inquiries.filter((i) => i.status === 'Unread');
    }
    if (statusFilter === 'Read') {
      return inquiries.filter((i) => i.status !== 'Unread');
    }
    return inquiries;
  }, [inquiries, statusFilter]);

  const updateInquiryStatus = async (inquiryId: string, newStatus: 'Read' | 'Unread'): Promise<boolean> => {
    const { error } = await supabase
      .from('inquiries')
      .update({ status: newStatus })
      .eq('id', inquiryId);
    if (error) {
      throw error;
    }
    setInquiries((prev) =>
      prev.map((msg) => (msg.id === inquiryId ? { ...msg, status: newStatus } : msg))
    );
    void refreshUnreadInquiriesCount();
    return true;
  };

  const toggleStatus = async (inquiry: InquiryRow): Promise<void> => {
    try {
      const newStatus = inquiry.status === 'Unread' ? 'Read' : 'Unread';
      await updateInquiryStatus(inquiry.id, newStatus);
      toast.success(`Marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleMarkAllRead = async (): Promise<void> => {
    const unreadIds = inquiries.filter((i) => i.status === 'Unread').map((i) => i.id);
    if (unreadIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('inquiries')
        .update({ status: 'Read' })
        .in('id', unreadIds);
      if (error) throw error;
      setInquiries((prev) => prev.map((msg) => ({ ...msg, status: 'Read' })));
      void refreshUnreadInquiriesCount();
      toast.success(`Marked ${unreadIds.length} message(s) as read`);
    } catch {
      toast.error('Failed to mark all messages as read');
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        const { error } = await supabase.from('inquiries').delete().eq('id', id);
        if (error) throw error;
        setInquiries((prev) => prev.filter((msg) => msg.id !== id));
        void refreshUnreadInquiriesCount();
        toast.success('Message deleted');
      } catch {
        toast.error('Failed to delete message');
      }
    }
  };

  const toggleExpand = (inquiry: InquiryRow): void => {
    const isOpening = expandedId !== inquiry.id;
    setExpandedId(isOpening ? inquiry.id : null);
    if (isOpening && inquiry.status === 'Unread') {
      void updateInquiryStatus(inquiry.id, 'Read').catch((err) => {
        console.error('[Messages] Auto mark read error:', err);
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />

      <div className="flex-1 p-10">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-3xl font-serif text-brand-dark">Inbox &amp; Inquiries</h1>
              {!loading && (
                unreadCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/25">
                    <BellRing size={14} />
                    {unreadCount} Unread
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCheck size={14} />
                    All caught up
                  </span>
                )
              )}
            </div>
            <p className="text-gray-500">Manage all client communications securely in one place.</p>
          </div>

          {!loading && inquiries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setStatusFilter('All')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${statusFilter === 'All' ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  All ({inquiries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Unread')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${statusFilter === 'Unread' ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Read')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${statusFilter === 'Read' ? 'bg-brand-dark text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Read ({readCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => { void handleMarkAllRead(); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors shadow-sm"
                >
                  <CheckCheck size={14} />
                  Mark All Read
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading messages...</div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
            <Mail className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">No messages yet.</p>
            <p className="text-sm text-gray-400">When clients contact you, their inquiries will appear here.</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <MailOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-600 font-bold">No {statusFilter.toLowerCase()} messages.</p>
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className="mt-3 text-xs font-bold text-brand-primary hover:underline"
            >
              Show all messages
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredInquiries.map((inquiry) => {
                const createdDate = getInquiryDate(inquiry);
                const inquiryTopic = inquiry.inquiry_type || inquiry.inquiryType || 'General';
                const propertyName = inquiry.property_name || inquiry.propertyName;
                const safePhoneHref = sanitizeTelHref(inquiry.phone);
                const safeEmailHref = sanitizeMailtoHref(inquiry.email);
                const isUnread = inquiry.status === 'Unread';

                return (
                  <div
                    key={inquiry.id}
                    className={`border-l-4 transition-colors ${isUnread ? 'border-l-brand-primary bg-brand-primary/[0.04] hover:bg-brand-primary/[0.08]' : 'border-l-transparent bg-white hover:bg-gray-50'}`}
                  >

                    {/* Summary Row */}
                    <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(inquiry)}>
                      <div className="flex items-center gap-4 flex-1">
                        <div className="shrink-0">
                          {isUnread ? (
                            <div
                              className="w-10 h-10 bg-brand-primary/15 text-brand-primary rounded-full flex items-center justify-center"
                              title="Unread message"
                            >
                              <Mail size={20} />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
                              <MailOpen size={20} />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 w-full gap-4 items-center">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`text-sm ${isUnread ? 'font-bold text-brand-dark' : 'font-medium text-gray-700'}`}>{inquiry.name}</h4>
                              {isUnread && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/25">
                                  Unread
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{inquiry.source || 'General Inquiry'}</p>
                          </div>

                          <div>
                            <div className="text-sm text-gray-700 font-medium flex flex-col gap-1">
                              <span>Topic: <span className="font-bold">{inquiryTopic}</span></span>
                              {propertyName && (
                                <span className="text-brand-primary text-xs">Property: <span className="font-bold">{propertyName}</span></span>
                              )}
                            </div>
                          </div>

                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {inquiry.message}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 pl-4">
                        {createdDate && (
                          <span className="text-xs text-gray-400 font-medium mr-4">
                            {createdDate.toLocaleDateString()}
                          </span>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); void toggleStatus(inquiry); }}
                          className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${isUnread ? 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {isUnread ? 'Mark Read' : 'Mark Unread'}
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); void handleDelete(inquiry.id); }}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>

                        <div className="text-gray-400">
                          {expandedId === inquiry.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedId === inquiry.id && (
                      <div className="bg-gray-50 p-6 border-t border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="md:col-span-2">
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Message</h5>
                            <div className="bg-white p-4 rounded border border-gray-200 text-gray-700 text-sm whitespace-pre-wrap leading-relaxed shadow-inner">
                              {inquiry.message}
                            </div>
                          </div>

                          <div>
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Contact Details</h5>
                            <div className="bg-white p-4 rounded border border-gray-200 space-y-3">
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">Name</span>
                                <span className="text-sm font-bold text-gray-800">{inquiry.name}</span>
                              </div>
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">Phone Number</span>
                                {safePhoneHref ? (
                                  <a href={safePhoneHref} className="text-sm font-bold text-brand-primary hover:underline">{inquiry.phone}</a>
                                ) : (
                                  <span className="text-sm font-bold text-gray-800">{inquiry.phone || 'N/A'}</span>
                                )}
                              </div>
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">Email Address</span>
                                {safeEmailHref ? (
                                  <a href={safeEmailHref} className="text-sm font-bold text-brand-primary hover:underline">{inquiry.email}</a>
                                ) : (
                                  <span className="text-sm font-bold text-gray-800">{inquiry.email || 'N/A'}</span>
                                )}
                              </div>
                              {createdDate && (
                                <div>
                                  <span className="block text-xs text-gray-400 font-medium">Date Sent</span>
                                  <span className="text-sm text-gray-700">{createdDate.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <InquiryWhatsAppActions inquiry={inquiry} />
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
