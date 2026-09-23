import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc, addDoc, setDoc, serverTimestamp, runTransaction, getDocs, where } from 'firebase/firestore';
import { useGlobalState } from '../../context/GlobalState';
import AdminSidebar from '../../components/AdminSidebar';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ArrowRight, Loader2, X, ChevronRight, CheckCircle, FileText, Info, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';

const AdminCustomSelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 bg-white cursor-pointer flex justify-between items-center"
      >
        <span className={`truncate pr-4 ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronRight size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : 'rotate-0'}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="overflow-y-auto max-h-[250px] py-1">
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 text-gray-500 ${!value ? 'bg-brand-primary/10 font-bold' : ''}`}
            >
              {placeholder}
            </div>
            {options.map((opt) => (
              <div 
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 border-t border-gray-50 ${opt.value === value ? 'bg-brand-primary/10 text-brand-dark font-bold' : 'text-gray-700'}`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useGlobalState();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    valueCollected: 0
  });

  const [isModalOpen, setIsModalOpen] = useState(() => {
    const saved = sessionStorage.getItem('admin_booking_modal_open');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    sessionStorage.setItem('admin_booking_modal_open', JSON.stringify(isModalOpen));
  }, [isModalOpen]);

  useEffect(() => {
    // Fetch Bookings
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(data);
      
      // Calculate Stats
      let total = data.length;
      let active = data.filter(b => b.status === 'Active').length;
      let completed = data.filter(b => b.status === 'Completed').length;
      let cancelled = data.filter(b => b.status === 'Cancelled').length;
      let val = data.reduce((acc, curr) => acc + (Number(curr.totalPaid) || 0), 0);
      
      setStats({ total, active, completed, cancelled, valueCollected: val });
      setLoading(false);
    });

    // Fetch Properties for form
    const pSub = onSnapshot(collection(db, 'properties'), (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub(); pSub(); };
  }, []);

  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return '৳0';
    return '৳ ' + Math.round(Number(amount)).toLocaleString('en-IN');
  };

  const getStageColor = (stage) => {
    const colors = {
      'EOI': 'bg-gray-100 text-gray-800',
      'Token Paid': 'bg-blue-100 text-blue-800',
      'Agreement Signed': 'bg-indigo-100 text-indigo-800',
      'Down Payment Paid': 'bg-purple-100 text-purple-800',
      'Installments Running': 'bg-brand-primary/20 text-brand-dark',
      'Fully Paid': 'bg-green-100 text-green-800',
      'Handover': 'bg-emerald-100 text-emerald-800',
      'Completed': 'bg-teal-100 text-teal-800',
      'On Hold': 'bg-amber-100 text-amber-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  const filteredBookings = bookings.filter(b => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      const matchesStage = filterStage === 'All' || b.stage === filterStage;
      const matchesStatus = filterStatus === 'All' || b.status === filterStatus;
      return matchesStage && matchesStatus;
    }

    const cleanTerm = term.replace(/^id:\s*/i, '').trim();

    const matchesSearch = 
      (b.clientName?.toLowerCase().includes(term)) ||
      (b.clientEmail?.toLowerCase().includes(term)) ||
      (b.clientPhone?.toLowerCase().includes(term)) ||
      (b.bookingRef?.toLowerCase().includes(term)) ||
      (b.propertyName?.toLowerCase().includes(term)) ||
      (b.linkedUserId?.toLowerCase().includes(cleanTerm)) ||
      (b.clientId?.toLowerCase().includes(cleanTerm)) ||
      (b.clientNid?.toLowerCase().includes(cleanTerm)) ||
      (b.unitNumber?.toLowerCase().includes(cleanTerm));

    const matchesStage = filterStage === 'All' || b.stage === filterStage;
    const matchesStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchesSearch && matchesStage && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">Booking Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage client agreements and track installments</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            New Booking
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total Bookings', value: stats.total },
              { label: 'Active', value: stats.active, color: 'text-brand-primary' },
              { label: 'Completed', value: stats.completed, color: 'text-green-600' },
              { label: 'Cancelled', value: stats.cancelled, color: 'text-red-500' },
              { label: 'Value Collected', value: formatMoney(stats.valueCollected) },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 font-medium mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color || 'text-gray-900'}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 flex-1">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search client name, ID, email, phone, or ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
                >
                  <option value="All">All Stages</option>
                  <option value="EOI">EOI</option>
                  <option value="Token Paid">Token Paid</option>
                  <option value="Agreement Signed">Agreement Signed</option>
                  <option value="Down Payment Paid">Down Payment Paid</option>
                  <option value="Installments Running">Installments Running</option>
                  <option value="Fully Paid">Fully Paid</option>
                  <option value="Handover">Handover</option>
                </select>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-brand-primary" size={32} />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No bookings found</p>
                <p className="text-sm">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                    <th className="p-4 font-semibold">Ref & Client</th>
                    <th className="p-4 font-semibold">Property</th>
                    <th className="p-4 font-semibold">Stage</th>
                    <th className="p-4 font-semibold">Total Price</th>
                    <th className="p-4 font-semibold">Balance Due</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{b.bookingRef}</div>
                        <div className="text-sm text-gray-700 font-medium">{b.clientName}</div>
                        {(b.linkedUserId || b.clientId) && (
                          <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                            ID: {(b.linkedUserId || b.clientId).slice(0, 8).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{b.propertyName}</div>
                        <div className="text-sm text-gray-500">{b.unitType} {b.unitNumber && `- ${b.unitNumber}`}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStageColor(b.stage)}`}>
                          {b.stage}
                        </span>
                        {b.status !== 'Active' && (
                           <div className="mt-1 text-xs font-bold text-gray-400 uppercase">{b.status}</div>
                        )}
                      </td>
                      <td className="p-4 font-medium text-gray-900">
                        {formatMoney(b.totalPrice)}
                      </td>
                      <td className="p-4">
                        <span className={`font-semibold ${b.balanceDue > 0 ? 'text-brand-dark' : 'text-green-600'}`}>
                          {formatMoney(b.balanceDue)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-gray-400 group-hover:text-brand-primary transition-colors">
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </main>
      </div>

      {/* New Booking Modal */}
      {isModalOpen && (
        <NewBookingModal 
          onClose={() => setIsModalOpen(false)} 
          properties={properties} 
          adminName={userProfile?.displayName || 'Admin'}
          adminUid={userProfile?.uid}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// New Booking Modal Component
// ----------------------------------------------------------------------

function NewBookingModal({ onClose, properties, adminName, adminUid }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(() => {
    const saved = sessionStorage.getItem('admin_booking_step');
    return saved ? JSON.parse(saved) : 1;
  });
  
  const [form, setForm] = useState(() => {
    const saved = sessionStorage.getItem('admin_booking_form');
    return saved ? JSON.parse(saved) : {
      propertyId: '',
      inventoryId: '',
      unitType: '',
      unitNumber: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientNidType: 'NID',
      clientNid: '',
      clientAddress: '',
      linkedUserId: null,
      totalPrice: '',
      tokenAmount: '',
      downPaymentAmount: '',
      installmentPlan: 'Custom',
      installmentCount: '',
      installmentStartDate: '',
      installmentFrequency: 'Monthly',
      notes: ''
    };
  });

  useEffect(() => {
    sessionStorage.setItem('admin_booking_step', JSON.stringify(step));
  }, [step]);

  useEffect(() => {
    sessionStorage.setItem('admin_booking_form', JSON.stringify(form));
  }, [form]);

  const clearSessionData = () => {
    sessionStorage.removeItem('admin_booking_step');
    sessionStorage.removeItem('admin_booking_form');
    sessionStorage.removeItem('admin_booking_modal_open');
  };

  const [linkSearch, setLinkSearch] = useState('');
  const [linkResult, setLinkResult] = useState(null);
  const [searchingLink, setSearchingLink] = useState(false);

  const currentProperty = properties.find(p => p.id === form.propertyId);
  const unitOptions = currentProperty?.availableUnits || [];

  const handleLinkSearch = async () => {
    if (!linkSearch) return;
    setSearchingLink(true);
    setLinkResult(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', linkSearch));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        setLinkResult({ id: userDoc.id, ...userDoc.data() });
      } else {
        toast.info("No user found with that email.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to search user.");
    } finally {
      setSearchingLink(false);
    }
  };

  const confirmLink = () => {
    if (linkResult) {
      setForm(prev => ({
        ...prev,
        linkedUserId: linkResult.id,
        clientName: prev.clientName || linkResult.displayName,
        clientEmail: linkResult.email,
        clientPhone: prev.clientPhone || linkResult.phone,
        clientNidType: linkResult.nidType || prev.clientNidType || 'NID',
        clientNid: prev.clientNid || linkResult.nid || '',
        clientAddress: prev.clientAddress || linkResult.address || ''
      }));
      toast.success("Account linked successfully.");
    }
  };

  const nextStep = () => {
    // Validation
    if (step === 1) {
      if (!form.propertyId || !form.inventoryId) return toast.error("Please select a property and a specific unit.");
    }
    if (step === 2) {
      if (!form.linkedUserId) return toast.error("Linking a user account is mandatory.");
      if (!form.clientName || !form.clientEmail || !form.clientPhone) return toast.error("Client name, email, and phone are required.");
      if (!form.clientNid) return toast.error(`${form.clientNidType} number is required.`);
      if (!form.clientAddress) return toast.error("Current Address is required.");
    }
    if (step === 3) {
      if (!form.totalPrice || !form.tokenAmount) return toast.error("Total price and token amount are required.");
      if (Number(form.tokenAmount) > Number(form.totalPrice)) return toast.error("Token cannot exceed total price.");
      if (!form.downPaymentAmount) return toast.error("Down payment is required. Enter 0 if none.");
      
      if (!form.installmentCount) return toast.error("Total installments count is required.");
      if (!form.installmentStartDate) return toast.error("Installment start date is required.");
      if (!form.installmentFrequency) return toast.error("Installment frequency is required.");
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Generate sequential Booking Ref using a Transaction
      const counterRef = doc(db, 'meta', 'bookingCounter');
      
      const newBookingId = await runTransaction(db, async (transaction) => {
        // --- READS ---
        const counterDoc = await transaction.get(counterRef);
        
        const propertyRef = doc(db, 'properties', form.propertyId);
        const propertyDoc = await transaction.get(propertyRef);
        if (!propertyDoc.exists()) throw new Error("Property not found");

        // --- PROCESSING & WRITES ---
        let currentVal = 1;
        if (counterDoc.exists()) {
          currentVal = counterDoc.data().value + 1;
        }
        
        const year = new Date().getFullYear();
        const paddedNum = String(currentVal).padStart(4, '0');
        const bookingRef = `VN-${year}-${paddedNum}`;

        const propertyData = propertyDoc.data();
        let inventory = propertyData.inventory || [];
        const invIndex = inventory.findIndex(inv => inv.id === form.inventoryId);
        
        if (invIndex === -1) throw new Error("Selected unit not found in inventory.");
        if (inventory[invIndex].status !== 'Available') {
          throw new Error(`This unit is no longer available (Current status: ${inventory[invIndex].status}). Someone may have booked it just now.`);
        }
        
        // Perform Writes
        transaction.set(counterRef, { value: currentVal }, { merge: true });

        inventory[invIndex].status = 'Booked';
        transaction.update(propertyRef, { inventory });

        // 2. Create the main booking document
        const bookingRefDoc = doc(collection(db, 'bookings'));
        const bookingData = {
          clientName: form.clientName,
          clientEmail: form.clientEmail,
          clientPhone: form.clientPhone,
          clientNid: form.clientNid,
          clientAddress: form.clientAddress,
          linkedUserId: form.linkedUserId,
          
          propertyId: form.propertyId,
          propertyName: currentProperty.name,
          propertyLocation: currentProperty.location,
          inventoryId: form.inventoryId,
          unitType: inventory[invIndex].unitType || '',
          unitNumber: `Floor ${inventory[invIndex].floor || ''}, ${
            (inventory[invIndex].unitType || '').toLowerCase().includes((inventory[invIndex].unitName || '').toLowerCase()) 
            ? (inventory[invIndex].unitName || '') 
            : `Unit ${inventory[invIndex].unitName || ''}`
          }`,
          
          totalPrice: Number(form.totalPrice),
          tokenAmount: Number(form.tokenAmount),
          downPaymentAmount: Number(form.downPaymentAmount || 0),
          totalPaid: 0, 
          balanceDue: Number(form.totalPrice),
          installmentPlan: form.installmentPlan || 'Custom',
          
          stage: 'EOI',
          status: 'Active',
          cancellationReason: null,
          refundAmount: null,
          
          bookingRef,
          createdAt: serverTimestamp(),
          createdBy: adminUid,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid,
          internalNotes: form.notes || ''
        };
        transaction.set(bookingRefDoc, bookingData);

        // 3. Create the Activity Log
        const logRef = doc(collection(db, `bookings/${bookingRefDoc.id}/activityLog`));
        transaction.set(logRef, {
          action: "Booking created",
          detail: `Initial booking created by ${adminName}`,
          performedBy: adminName,
          performedAt: serverTimestamp()
        });

        return bookingRefDoc.id; // pass this out of transaction
      });

      // 4. Generate scheduled payments in subcollection (non-transactional is fine here)
      const tokenRef = doc(collection(db, `bookings/${newBookingId}/payments`));
      await setDoc(tokenRef, {
        type: 'Token',
        installmentNumber: null,
        scheduledDate: new Date(), // Due today
        paidDate: null, // Admin records it later
        scheduledAmount: Number(form.tokenAmount),
        receivedAmount: 0,
        paymentMode: 'Cash', // Default
        referenceNumber: '',
        status: 'Scheduled',
        note: '',
        recordedBy: adminUid,
        recordedAt: serverTimestamp()
      });

      if (Number(form.downPaymentAmount) > 0) {
        const dpRef = doc(collection(db, `bookings/${newBookingId}/payments`));
        await setDoc(dpRef, {
          type: 'Down Payment',
          installmentNumber: null,
          scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Due in 14 days approx
          paidDate: null,
          scheduledAmount: Number(form.downPaymentAmount),
          receivedAmount: 0,
          paymentMode: 'Cash',
          referenceNumber: '',
          status: 'Scheduled',
          note: '',
          recordedBy: adminUid,
          recordedAt: serverTimestamp()
        });
      }

      // Generate Installments if requested
      if (form.installmentCount && Number(form.installmentCount) > 0) {
        const count = Number(form.installmentCount);
        const amountRemaining = Number(form.totalPrice) - Number(form.tokenAmount) - Number(form.downPaymentAmount || 0);
        const instAmount = amountRemaining / count;
        
        let currentDate = form.installmentStartDate ? new Date(form.installmentStartDate) : new Date();
        
        for (let i = 1; i <= count; i++) {
          const instRef = doc(collection(db, `bookings/${newBookingId}/payments`));
          await setDoc(instRef, {
            type: 'Installment',
            installmentNumber: i,
            scheduledDate: new Date(currentDate),
            paidDate: null,
            scheduledAmount: instAmount,
            receivedAmount: 0,
            paymentMode: 'Cash',
            referenceNumber: '',
            status: 'Scheduled',
            note: '',
            recordedBy: adminUid,
            recordedAt: serverTimestamp()
          });

          // Advance date
          switch (form.installmentFrequency) {
            case 'Monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'Bi-Monthly':
              currentDate.setMonth(currentDate.getMonth() + 2);
              break;
            case 'Quarterly':
              currentDate.setMonth(currentDate.getMonth() + 3);
              break;
            case 'Tri-Annual':
              currentDate.setMonth(currentDate.getMonth() + 4);
              break;
            case 'Semi-Annual':
              currentDate.setMonth(currentDate.getMonth() + 6);
              break;
            case 'Annual':
              currentDate.setMonth(currentDate.getMonth() + 12);
              break;
            default:
              currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      }

      // If linked, notify user
      if (form.linkedUserId) {
        await addDoc(collection(db, `users/${form.linkedUserId}/notifications`), {
          text: `Your booking for ${currentProperty.name} has been confirmed.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      toast.success("Booking created successfully!");
      clearSessionData();
      onClose();
      navigate(`/admin/bookings/${newBookingId}`);

    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes("no longer available") || err.message.includes("not found"))) {
        toast.error(err.message);
      } else {
        toast.error(`Failed to create booking: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // Quick hack to import setDoc at the top since I used it inside function
  // Actually, I can just use addDoc for subcollection instead of setDoc(doc(collection...))
  // I will define it as addDoc

  const renderStepIndicators = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map(i => (
        <React.Fragment key={i}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= i ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            {step > i ? <CheckCircle size={16} /> : i}
          </div>
          {i < 4 && <div className={`w-12 h-1 ${step > i ? 'bg-brand-primary' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  const handleClose = () => {
    if (step > 1 || form.propertyId || form.clientName || form.clientEmail) {
      if (window.confirm("Are you sure you want to discard this booking? All unsaved data will be lost.")) {
        clearSessionData();
        onClose();
      }
    } else {
      clearSessionData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-bold font-serif text-gray-900">Create New Booking</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-8 overflow-y-auto flex-1">
          {renderStepIndicators()}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-bold border-b pb-2 mb-4">Select Property & Unit</h3>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Property *</label>
                <AdminCustomSelect 
                  value={form.propertyId}
                  onChange={(val) => setForm({...form, propertyId: val, unitType: ''})}
                  options={properties.map(p => ({ value: p.id, label: `${p.name} - ${p.location}` }))}
                  placeholder="Select Property"
                />
              </div>
              
              {currentProperty && currentProperty.inventory && currentProperty.inventory.length > 0 ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Select Specific Unit *</label>
                  <AdminCustomSelect 
                    value={form.inventoryId}
                    onChange={(val) => setForm({...form, inventoryId: val})}
                    options={currentProperty.inventory.filter(inv => inv.status === 'Available').map(inv => {
                      const isRedundant = inv.unitType.toLowerCase().includes(inv.unitName.toLowerCase());
                      return {
                        value: inv.id,
                        label: `Floor ${inv.floor} - ${isRedundant ? inv.unitType : `Unit ${inv.unitName} (${inv.unitType})`}`
                      };
                    })}
                    placeholder="Select an available unit..."
                  />
                </div>
              ) : currentProperty ? (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                  <p className="font-bold flex items-center gap-1"><X size={16} /> No Exact Inventory Defined</p>
                  <p className="mt-1">You must define specific units for this property in the Admin Panel before creating bookings.</p>
                </div>
              ) : null}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-bold border-b pb-2 mb-4">Client Information</h3>
              
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex flex-col gap-3">
                <div className="flex items-center gap-2 text-blue-800 font-bold">
                  <ShieldCheck size={20} /> Link User Account (Mandatory)
                </div>
                <p className="text-xs text-blue-700">A verified user account is required to grant the client access to the user dashboard.</p>
                
                {form.linkedUserId ? (
                  <div className="bg-white p-3 rounded border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{form.clientName}</p>
                      <p className="text-xs text-gray-500">{form.clientEmail}</p>
                    </div>
                    <button onClick={() => setForm({...form, linkedUserId: null})} className="text-red-500 text-xs font-bold hover:underline">Unlink</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      placeholder="Search user by exact email..." 
                      className="flex-1 p-2 border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={linkSearch}
                      onChange={e => setLinkSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLinkSearch()}
                    />
                    <button 
                      onClick={handleLinkSearch}
                      disabled={searchingLink || !linkSearch}
                      className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {searchingLink ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                )}
                
                {linkResult && !form.linkedUserId && (
                  <div className="mt-2 bg-white p-3 rounded border border-blue-100 flex items-center justify-between animate-in fade-in">
                    <div>
                      <p className="font-bold text-gray-900">{linkResult.displayName}</p>
                      <p className="text-xs text-gray-500">{linkResult.email}</p>
                    </div>
                    <button onClick={confirmLink} className="px-3 py-1 bg-green-100 text-green-700 font-bold rounded text-xs hover:bg-green-200">
                      Confirm Link
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Full Name *</label>
                  <input type="text" className="w-full p-3 border rounded-lg" value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Phone *</label>
                  <input type="text" className="w-full p-3 border rounded-lg" value={form.clientPhone} onChange={e => setForm({...form, clientPhone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email *</label>
                  <input type="email" className="w-full p-3 border rounded-lg" value={form.clientEmail} onChange={e => setForm({...form, clientEmail: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Identity Document *</label>
                  <div className="flex gap-2">
                    <select 
                      className="w-1/3 p-3 border rounded-lg bg-gray-50 font-bold"
                      value={form.clientNidType} 
                      onChange={e => setForm({...form, clientNidType: e.target.value})}
                    >
                      <option value="NID">NID</option>
                      <option value="Passport">Passport</option>
                    </select>
                    <input type="text" placeholder={`Enter ${form.clientNidType} Number`} className="w-2/3 p-3 border rounded-lg" value={form.clientNid} onChange={e => setForm({...form, clientNid: e.target.value})} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Current Address *</label>
                  <textarea className="w-full p-3 border rounded-lg" rows="2" value={form.clientAddress} onChange={e => setForm({...form, clientAddress: e.target.value})}></textarea>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-bold border-b pb-2 mb-4">Financial Agreement</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="flex items-center gap-1 text-sm font-bold text-gray-700 mb-2 relative group w-max">
                    Total Agreed Price (BDT) *
                    <Info size={14} className="text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-brand-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg text-left font-normal whitespace-normal">
                      The final, fully negotiated total price for this property unit.
                    </div>
                  </label>
                  <input type="number" className="w-full p-3 border rounded-lg bg-gray-50 font-bold text-lg" value={form.totalPrice} onChange={e => setForm({...form, totalPrice: e.target.value})} />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-bold text-gray-700 mb-2 relative group w-max">
                    Token Amount *
                    <Info size={14} className="text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-brand-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg text-left font-normal whitespace-normal">
                      The initial booking money or token advance paid by the client to reserve the unit.
                    </div>
                  </label>
                  <input type="number" className="w-full p-3 border rounded-lg" value={form.tokenAmount} onChange={e => setForm({...form, tokenAmount: e.target.value})} />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-bold text-gray-700 mb-2 relative group w-max">
                    Down Payment *
                    <Info size={14} className="text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-brand-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg text-left font-normal whitespace-normal">
                      The lump-sum amount (excluding token) required before standard installments begin. Enter 0 if none.
                    </div>
                  </label>
                  <input type="number" className="w-full p-3 border rounded-lg" value={form.downPaymentAmount} onChange={e => setForm({...form, downPaymentAmount: e.target.value})} />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Installment Schedule *</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Total Installments *</label>
                    <input type="number" placeholder="e.g. 24" className="w-full p-3 border rounded-lg text-sm" value={form.installmentCount} onChange={e => setForm({...form, installmentCount: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Start Date *</label>
                    <input type="date" className="w-full p-3 border rounded-lg text-sm" value={form.installmentStartDate} onChange={e => setForm({...form, installmentStartDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Frequency *</label>
                    <select className="w-full p-3 border rounded-lg text-sm" value={form.installmentFrequency} onChange={e => setForm({...form, installmentFrequency: e.target.value})}>
                      <option value="Monthly">Monthly</option>
                      <option value="Bi-Monthly">Bi-Monthly (Every 2 Months)</option>
                      <option value="Quarterly">Quarterly (Every 3 Months)</option>
                      <option value="Tri-Annual">Tri-Annual (Every 4 Months)</option>
                      <option value="Semi-Annual">Semi-Annual (Every 6 Months)</option>
                      <option value="Annual">Annual (Every 12 Months)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-bold border-b pb-2 mb-4">Review & Confirm</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-sm space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500">Property</p>
                    <p className="font-bold text-gray-900">{currentProperty?.name} - {form.unitType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Client</p>
                    <p className="font-bold text-gray-900">{form.clientName}</p>
                    <p className="text-gray-600">{form.clientPhone}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Price</p>
                    <p className="font-bold text-brand-dark text-lg">৳{Number(form.totalPrice).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Token Amount</p>
                    <p className="font-bold text-gray-900">৳{Number(form.tokenAmount).toLocaleString()}</p>
                  </div>
                </div>
                
                {form.installmentCount && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-gray-500">Auto-generating Installments:</p>
                    <p className="font-bold">{form.installmentCount} {form.installmentFrequency} payments</p>
                  </div>
                )}
                
                <div className="pt-4">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Internal Notes</label>
                  <textarea className="w-full p-3 border rounded-lg" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any special requests or terms..."></textarea>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="px-8 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">
              Back
            </button>
          ) : <div></div>}

          {step < 4 ? (
            <button onClick={nextStep} className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-dark transition-colors flex items-center gap-2">
              Next Step <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Confirm & Create Booking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
