import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { useGlobalState } from '../../context/GlobalState';
import AdminSidebar from '../../components/AdminSidebar';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ArrowRight, Loader2, X, ChevronRight, ChevronDown, CheckCircle, FileText, Info, ShieldCheck } from 'lucide-react';
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
  
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (propName) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [propName]: !prev[propName]
    }));
  };

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
    const fetchBookings = async () => {
      const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (data) {
        const mapped = data.map(d => ({
          id: d.id,
          bookingRef: d.booking_ref,
          clientName: d.client_name,
          clientEmail: d.client_email,
          clientPhone: d.client_phone,
          clientNid: d.client_nid,
          linkedUserId: d.linked_user_id,
          clientId: d.client_id,
          propertyName: d.property_name,
          unitType: d.unit_type,
          unitNumber: d.unit_number,
          stage: d.stage,
          status: d.status,
          totalPrice: d.total_price,
          totalPaid: d.total_paid,
          balanceDue: d.balance_due
        }));
        setBookings(mapped);

        // Calculate Stats
        let total = mapped.length;
        let active = mapped.filter(b => b.status === 'Active').length;
        let completed = mapped.filter(b => b.status === 'Completed').length;
        let cancelled = mapped.filter(b => b.status === 'Cancelled').length;
        let val = mapped.reduce((acc, curr) => acc + (Number(curr.totalPaid) || 0), 0);
        
        setStats({ total, active, completed, cancelled, valueCollected: val });
      }
      setLoading(false);
    };

    fetchBookings();

    const sub = supabase.channel('bookings_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe();

    // Fetch Properties
    const fetchProperties = async () => {
      const { data } = await supabase.from('properties').select('*');
      if (data) {
        setProperties(data.map(d => ({
          id: d.id,
          name: d.name,
          location: d.location,
          inventory: d.inventory,
          availableUnits: d.available_units,
          parkingPrice: d.parking_price,
          parkingInventory: d.parking_inventory
        })));
      }
    };
    fetchProperties();

    return () => supabase.removeChannel(sub);
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

  const groupedBookings = filteredBookings.reduce((groups, booking) => {
    const propName = booking.propertyName || 'Unknown Property';
    if (!groups[propName]) groups[propName] = [];
    groups[propName].push(booking);
    return groups;
  }, {});

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
                  {Object.entries(groupedBookings).map(([propName, propertyBookings]) => (
                    <React.Fragment key={propName}>
                      <tr 
                        className="bg-brand-primary/5 border-y border-brand-primary/10 cursor-pointer hover:bg-brand-primary/10 transition-colors"
                        onClick={() => toggleGroup(propName)}
                      >
                        <td colSpan="6" className="p-4">
                          <div className="flex justify-between items-center w-full">
                            <div className="font-serif font-bold text-brand-dark text-lg flex items-center gap-2">
                              {propName}
                              <span className="bg-white px-2 py-0.5 rounded-full text-xs text-brand-primary border border-brand-primary/20">
                                {propertyBookings.length} {propertyBookings.length === 1 ? 'Booking' : 'Bookings'}
                              </span>
                            </div>
                            <ChevronDown className={`text-brand-primary transition-transform ${collapsedGroups[propName] ? '' : 'rotate-180'}`} size={20} />
                          </div>
                        </td>
                      </tr>
                      {!collapsedGroups[propName] && propertyBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                          <td className="p-4 pl-6">
                            <div className="font-semibold text-gray-900">{b.bookingRef}</div>
                            <div className="text-sm text-gray-700 font-medium">{b.clientName}</div>
                            {(b.linkedUserId || b.clientId) && (
                              <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                                ID: {(b.linkedUserId || b.clientId).slice(0, 8).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium text-gray-900">{b.unitType}</div>
                            {b.unitNumber && <div className="text-sm text-gray-500">Unit: {b.unitNumber}</div>}
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
                    </React.Fragment>
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
      parkingSpotIds: [],
      totalPrice: '',
      tokenAmount: '',
      downPaymentAmount: '',
      installmentPlan: 'Custom',
      installmentCount: '',
      installmentStartDate: '',
      installmentFrequency: 'Monthly',
      pricingAdjustment: '',
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
      const { data, error } = await supabase.from('profiles').select('*').eq('email', linkSearch);
      if (error) throw error;
      if (data && data.length > 0) {
        const userDoc = data[0];
        setLinkResult({ 
          id: userDoc.id, 
          displayName: userDoc.display_name,
          email: userDoc.email,
          phone: userDoc.phone,
          nidType: userDoc.nid_type,
          nid: userDoc.nid,
          address: userDoc.address
        });
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

  useEffect(() => {
    if (form.propertyId && form.inventoryId) {
      const prop = properties.find(p => p.id === form.propertyId);
      if (prop) {
        const inv = prop.inventory?.find(i => i.id === form.inventoryId);
        const baseType = prop.availableUnits?.find(u => inv?.unitType?.startsWith(u.name));
        const baseUnitPrice = Number(baseType?.price || 0);
        
        const parkingPricePerSpot = Number(prop.parkingPrice || 0);
        const parkingQty = (form.parkingSpotIds || []).length;
        const totalParkingPrice = parkingPricePerSpot * parkingQty;
        
        const adjustment = Number(form.pricingAdjustment || 0);
        
        const newTotal = baseUnitPrice + totalParkingPrice + adjustment;
        
        if (Number(form.totalPrice) !== newTotal) {
           setForm(prev => ({...prev, totalPrice: newTotal}));
        }
      }
    }
  }, [form.propertyId, form.inventoryId, form.parkingSpotIds, form.pricingAdjustment, properties]);

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
      // Create Booking Reference
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const bookingRef = `VN-${year}-${randNum}`;

      const propertyData = properties.find(p => p.id === form.propertyId);
      if (!propertyData) throw new Error("Property not found");

      let inventory = propertyData.inventory || [];
      const invIndex = inventory.findIndex(inv => inv.id === form.inventoryId);
      
      if (invIndex === -1) throw new Error("Selected unit not found in inventory.");
      if (inventory[invIndex].status !== 'Available') {
        throw new Error(`This unit is no longer available (Current status: ${inventory[invIndex].status}). Someone may have booked it just now.`);
      }
      
      let parkingInventory = propertyData.parkingInventory || [];
      const selectedSpotIds = form.parkingSpotIds || [];
      
      for (const spotId of selectedSpotIds) {
        const spotIdx = parkingInventory.findIndex(s => s.id === spotId);
        if (spotIdx === -1) throw new Error(`Parking spot ${spotId} not found.`);
        if (parkingInventory[spotIdx].status !== 'Available') {
          throw new Error(`Parking spot "${parkingInventory[spotIdx].label}" is no longer available. Please select a different spot.`);
        }
      }
      
      // We do Sequential Updates instead of Transaction since we do not have an RPC here
      // 1. Create Booking
      const selectedSpots = (propertyData.parkingInventory || []).filter(s => (form.parkingSpotIds || []).includes(s.id));
      const parkingDisplayStr = selectedSpots.map(s => `${s.label}${s.level ? ` (${s.level})` : ''}`).join(', ') || null;
      
      const { data: newBooking, error: bookingError } = await supabase.from('bookings').insert({
        client_name: form.clientName,
        client_email: form.clientEmail,
        client_phone: form.clientPhone,
        client_nid: form.clientNid,
        client_address: form.clientAddress,
        linked_user_id: form.linkedUserId,
        
        property_id: form.propertyId,
        property_name: currentProperty.name,
        property_location: currentProperty.location,
        inventory_id: form.inventoryId,
        unit_type: inventory[invIndex].unitType || '',
        unit_number: `Floor ${inventory[invIndex].floor || ''}, ${
          (inventory[invIndex].unitType || '').toLowerCase().includes((inventory[invIndex].unitName || '').toLowerCase()) 
          ? (inventory[invIndex].unitName || '') 
          : `Unit ${inventory[invIndex].unitName || ''}`
        }`,
        parking_spot_ids: form.parkingSpotIds || [],
        parking_included: parkingDisplayStr,
        
        total_price: Number(form.totalPrice),
        token_amount: Number(form.tokenAmount),
        down_payment_amount: Number(form.downPaymentAmount || 0),
        total_paid: 0, 
        balance_due: Number(form.totalPrice),
        installment_plan: form.installmentPlan || 'Custom',
        
        stage: 'EOI',
        status: 'Active',
        
        booking_ref: bookingRef,
        created_by: adminUid,
        last_updated_by: adminUid,
        internal_notes: form.notes || ''
      }).select().single();

      if (bookingError) throw bookingError;
      const newBookingId = newBooking.id;

      // 2. Update Property Inventory (Optimistic without RPC)
      inventory[invIndex].status = 'Booked';
      for (const spotId of selectedSpotIds) {
        const spotIdx = parkingInventory.findIndex(s => s.id === spotId);
        parkingInventory[spotIdx].status = 'Assigned';
        parkingInventory[spotIdx].assignedBookingId = newBookingId;
      }
      await supabase.from('properties').update({ inventory, parking_inventory: parkingInventory }).eq('id', form.propertyId);

      // 3. Activity Log
      await supabase.from('booking_activity_log').insert({
        booking_id: newBookingId,
        action: "Booking created",
        detail: `Initial booking created by ${adminName}`,
        performed_by: adminName
      });

      // 4. Generate scheduled payments
      await supabase.from('booking_payments').insert({
        booking_id: newBookingId,
        type: 'Token',
        scheduled_date: new Date().toISOString(),
        scheduled_amount: Number(form.tokenAmount),
        received_amount: 0,
        payment_mode: 'Cash',
        status: 'Scheduled',
        recorded_by: adminUid
      });

      if (Number(form.downPaymentAmount) > 0) {
        await supabase.from('booking_payments').insert({
          booking_id: newBookingId,
          type: 'Down Payment',
          scheduled_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          scheduled_amount: Number(form.downPaymentAmount),
          received_amount: 0,
          payment_mode: 'Cash',
          status: 'Scheduled',
          recorded_by: adminUid
        });
      }

      // Generate Installments if requested
      if (form.installmentCount && Number(form.installmentCount) > 0) {
        const count = Number(form.installmentCount);
        const amountRemaining = Number(form.totalPrice) - Number(form.tokenAmount) - Number(form.downPaymentAmount || 0);
        const baseInstAmount = Math.round((amountRemaining / count) / 10) * 10;
        let currentDate = form.installmentStartDate ? new Date(form.installmentStartDate) : new Date();
        
        for (let i = 1; i <= count; i++) {
          const currentInstAmount = (i === count) 
            ? (amountRemaining - (baseInstAmount * (count - 1))) 
            : baseInstAmount;
            
          await supabase.from('booking_payments').insert({
            booking_id: newBookingId,
            type: 'Installment',
            installment_number: i,
            scheduled_date: new Date(currentDate).toISOString(),
            scheduled_amount: currentInstAmount,
            received_amount: 0,
            payment_mode: 'Cash',
            status: 'Scheduled',
            recorded_by: adminUid
          });

          // Advance date
          switch (form.installmentFrequency) {
            case 'Monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
            case 'Bi-Monthly': currentDate.setMonth(currentDate.getMonth() + 2); break;
            case 'Quarterly': currentDate.setMonth(currentDate.getMonth() + 3); break;
            case 'Tri-Annual': currentDate.setMonth(currentDate.getMonth() + 4); break;
            case 'Semi-Annual': currentDate.setMonth(currentDate.getMonth() + 6); break;
            case 'Annual': currentDate.setMonth(currentDate.getMonth() + 12); break;
            default: currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      }

      // If linked, notify user
      if (form.linkedUserId) {
        await supabase.from('notifications').insert({
          user_id: form.linkedUserId,
          text: `Your booking for ${currentProperty.name} has been confirmed.`,
          read: false
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

        <div className="p-8 overflow-y-auto flex-1 min-h-[450px]">
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

              {currentProperty && (currentProperty.parkingInventory || []).length > 0 && (() => {
                const availableSpots = (currentProperty.parkingInventory || []).filter(s => s.status === 'Available');
                const assignedSpots = (currentProperty.parkingInventory || []).filter(s => s.status === 'Assigned');
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-gray-700">Assign Parking Spot(s)</label>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{availableSpots.length} of {(currentProperty.parkingInventory || []).length} Available</span>
                    </div>
                    {availableSpots.length === 0 ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-bold">All parking spots are currently assigned to other clients.</div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        {availableSpots.map(spot => {
                          const isChecked = (form.parkingSpotIds || []).includes(spot.id);
                          return (
                            <label key={spot.id} className={`flex items-center gap-4 p-3 cursor-pointer border-b last:border-0 transition-colors ${isChecked ? 'bg-brand-primary/10 border-brand-primary/20' : 'hover:bg-gray-50'}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = form.parkingSpotIds || [];
                                  setForm({...form, parkingSpotIds: e.target.checked ? [...current, spot.id] : current.filter(id => id !== spot.id)});
                                }}
                                className="w-4 h-4 text-brand-primary rounded accent-brand-primary"
                              />
                              <div className="flex-1">
                                <span className="font-bold text-sm text-gray-900">{spot.label}</span>
                                {(spot.level || spot.zone) && <span className="text-xs text-gray-500 ml-2">{[spot.level, spot.zone].filter(Boolean).join(' · ')}</span>}
                              </div>
                              <span className="text-xs font-mono text-gray-400">{spot.id}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {(form.parkingSpotIds || []).length > 0 && (
                      <p className="mt-2 text-xs text-brand-primary font-bold">✓ {(form.parkingSpotIds || []).length} spot(s) selected — will be locked to this client atomically.</p>
                    )}
                    {assignedSpots.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600">🔒 {assignedSpots.length} spot(s) already assigned to other bookings are hidden.</p>
                    )}
                  </div>
                );
              })()}
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
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-4 tracking-wider">Pricing Breakdown</h4>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Base Unit Price</span>
                    <span className="font-bold">৳ {Number(currentProperty?.availableUnits?.find(u => currentProperty?.inventory?.find(i => i.id === form.inventoryId)?.unitType?.startsWith(u.name))?.price || 0).toLocaleString('en-IN')}</span>
                  </div>
                  {(form.parkingSpotIds || []).length > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Parking ({(form.parkingSpotIds || []).length} spot{(form.parkingSpotIds || []).length > 1 ? 's' : ''} @ ৳ {Number(currentProperty?.parkingPrice || 0).toLocaleString('en-IN')})</span>
                      <span className="font-bold">৳ {(Number(currentProperty?.parkingPrice || 0) * (form.parkingSpotIds || []).length).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Pricing Adjustment (Discount / Markup)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">৳</span>
                    <input 
                      type="number" 
                      placeholder="e.g. -500000 for discount, or 200000 for markup"
                      className="w-full pl-8 p-3 border border-gray-300 rounded-lg text-sm bg-white" 
                      value={form.pricingAdjustment} 
                      onChange={e => setForm({...form, pricingAdjustment: e.target.value})} 
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Use negative values for discounts.</p>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-300">
                  <span className="font-bold text-gray-900">Total Agreed Price</span>
                  <span className="text-2xl font-bold text-brand-primary">৳ {Number(form.totalPrice || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
