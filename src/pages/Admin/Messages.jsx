import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Trash2, Mail, MailOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';
import AdminSidebar from '../../components/AdminSidebar';

export default function AdminMessages() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInquiries(data);
    } catch (error) {
      toast.error("Failed to fetch messages");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (inquiry) => {
    try {
      const newStatus = inquiry.status === 'Unread' ? 'Read' : 'Unread';
      await updateDoc(doc(db, 'inquiries', inquiry.id), { status: newStatus });
      setInquiries(prev => prev.map(msg => msg.id === inquiry.id ? { ...msg, status: newStatus } : msg));
      toast.success(`Marked as ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      try {
        await deleteDoc(doc(db, 'inquiries', id));
        setInquiries(prev => prev.filter(msg => msg.id !== id));
        toast.success("Message deleted");
      } catch (error) {
        toast.error("Failed to delete message");
      }
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />

      <div className="flex-1 p-10">
        <div className="mb-10">
          <h1 className="text-3xl font-serif text-brand-dark mb-2">Inbox & Inquiries</h1>
          <p className="text-gray-500">Manage all client communications securely in one place.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading messages...</div>
        ) : inquiries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
            <Mail className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">No messages yet.</p>
            <p className="text-sm text-gray-400">When clients contact you, their inquiries will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className={`transition-colors ${inquiry.status === 'Unread' ? 'bg-indigo-50/30' : 'bg-white hover:bg-gray-50'}`}>
                  
                  {/* Summary Row */}
                  <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(inquiry.id)}>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="shrink-0">
                        {inquiry.status === 'Unread' ? (
                          <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center">
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
                          <h4 className={`text-sm ${inquiry.status === 'Unread' ? 'font-bold text-brand-dark' : 'font-medium text-gray-700'}`}>{inquiry.name}</h4>
                          <p className="text-xs text-gray-500">{inquiry.source || 'General Inquiry'}</p>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-700 font-medium">
                            {inquiry.propertyName ? (
                              <span className="text-brand-primary font-bold">Property: {inquiry.propertyName}</span>
                            ) : (
                              <span>Topic: {inquiry.inquiryType || 'General'}</span>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {inquiry.message}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 shrink-0 pl-4">
                      {inquiry.createdAt?.seconds && (
                        <span className="text-xs text-gray-400 font-medium mr-4">
                          {new Date(inquiry.createdAt.seconds * 1000).toLocaleDateString()}
                        </span>
                      )}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleStatus(inquiry); }}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${inquiry.status === 'Unread' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {inquiry.status === 'Unread' ? 'Mark Read' : 'Mark Unread'}
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(inquiry.id); }}
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
                              <a href={`tel:${inquiry.phone}`} className="text-sm font-bold text-brand-primary hover:underline">{inquiry.phone}</a>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-400 font-medium">Email Address</span>
                              <a href={`mailto:${inquiry.email}`} className="text-sm font-bold text-brand-primary hover:underline">{inquiry.email}</a>
                            </div>
                            {inquiry.createdAt?.seconds && (
                              <div>
                                <span className="block text-xs text-gray-400 font-medium">Date Sent</span>
                                <span className="text-sm text-gray-700">{new Date(inquiry.createdAt.seconds * 1000).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
