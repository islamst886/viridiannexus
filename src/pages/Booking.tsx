import { Fragment, useState, useEffect, type CSSProperties, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { CheckCircle, ChevronRight, Loader2, Building2, User, CreditCard, type LucideIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../context/GlobalState';

interface StepItem {
  id: number;
  label: string;
  icon: LucideIcon;
}

const STEPS: StepItem[] = [
  { id: 1, label: 'Select Property', icon: Building2 },
  { id: 2, label: 'Your Details', icon: User },
  { id: 3, label: 'Confirmation', icon: CreditCard },
];

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 16px',
  border: '1.5px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '14px',
  outline: 'none',
  background: '#fff',
  transition: 'border-color 0.2s',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '6px',
};

const primaryBtn: CSSProperties = {
  width: '100%',
  padding: '14px',
  background: '#0d6e4d',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '15px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'background 0.2s',
};

const secondaryBtn: CSSProperties = {
  padding: '14px 24px',
  background: '#f3f4f6',
  color: '#374151',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

interface BookingFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nid: string;
  address: string;
  parkingRequested: number;
}

type BookingTextField = 'firstName' | 'lastName' | 'email' | 'phone' | 'nid' | 'address';
type BookingErrors = Partial<Record<BookingTextField, string>>;

const STEP2_FIELDS: { name: BookingTextField; label: string; placeholder: string; type?: string; span: boolean }[] = [
  { name: 'firstName', label: 'First Name', placeholder: 'John', span: false },
  { name: 'lastName', label: 'Last Name', placeholder: 'Doe', span: false },
  { name: 'email', label: 'Email Address', placeholder: 'john@example.com', type: 'email', span: true },
  { name: 'phone', label: 'Phone Number', placeholder: '+880 1700 000000', span: true },
  { name: 'nid', label: 'NID / Passport Number', placeholder: 'Your national ID or passport', span: true },
  { name: 'address', label: 'Current Address', placeholder: 'House, Road, Area, City', span: true },
];

export default function Booking() {
  const { userProfile, authUser, properties, loadingProperties } = useGlobalState();
  const [step, setStep] = useState(1);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  // Form state
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [form, setForm] = useState<BookingFormState>({
    firstName: userProfile?.displayName?.split(' ')[0] || '',
    lastName: userProfile?.displayName?.split(' ').slice(1).join(' ') || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    nid: '',
    address: '',
    parkingRequested: 0,
  });
  const [errors, setErrors] = useState<BookingErrors>({});

  // Use properties from GlobalState (already fetched and cached)
  useEffect(() => {
    if (!loadingProperties && properties.length > 0) {
      setLoadingProjects(false);
      if (!selectedProject && properties[0]) setSelectedProject(properties[0].id);
    } else if (!loadingProperties) {
      setLoadingProjects(false);
    }
  }, [properties, loadingProperties, selectedProject]);

  const currentProject = properties.find(p => p.id === selectedProject);

  // Reflect live unit/parking availability from structured inventory when defined
  const hasStructuredInventory = Boolean(currentProject?.inventory && currentProject.inventory.length > 0);
  const availableInventoryUnits = hasStructuredInventory
    ? (currentProject?.inventory || []).filter(u => u.status === 'Available')
    : [];
  const isProjectSoldOut = hasStructuredInventory && availableInventoryUnits.length === 0;

  const availableUnitTypeSet = new Set(
    availableInventoryUnits.map(u => (u.unitType || '').trim()).filter(Boolean)
  );

  // Get unit options from the selected project
  const unitOptions: string[] = (() => {
    if (isProjectSoldOut) return [];
    const templates = currentProject?.availableUnits || [];
    if (templates.length > 0) {
      const allLabels = templates.map(u => `${u.name} – ${u.size}`);
      if (!hasStructuredInventory || availableUnitTypeSet.size === 0) {
        return allLabels;
      }
      const matched = templates
        .filter(u => {
          const nameLower = u.name.trim().toLowerCase();
          const dashLabel = `${u.name} – ${u.size}`.toLowerCase();
          const hyphenLabel = `${u.name} - ${u.size} sqft`.toLowerCase();
          const hyphenNoUnit = `${u.name} - ${u.size}`.toLowerCase();
          return Array.from(availableUnitTypeSet).some(t => {
            const tl = t.toLowerCase();
            return (
              tl === dashLabel ||
              tl === hyphenLabel ||
              tl === hyphenNoUnit ||
              (Boolean(nameLower) && tl.startsWith(nameLower))
            );
          });
        })
        .map(u => `${u.name} – ${u.size}`);
      return matched.length > 0 ? matched : Array.from(availableUnitTypeSet);
    }
    return availableUnitTypeSet.size > 0
      ? Array.from(availableUnitTypeSet)
      : ['Standard Unit'];
  })();

  const hasStructuredParking = Boolean(
    currentProject?.parkingInventory && currentProject.parkingInventory.length > 0
  );
  const availableParkingCount = hasStructuredParking
    ? (currentProject?.parkingInventory || []).filter(s => s.status === 'Available').length
    : Math.max(0, Number(currentProject?.parkingAvailable) || 0);

  const effectiveSelectedUnit =
    selectedUnit && unitOptions.includes(selectedUnit) ? selectedUnit : (unitOptions[0] || '');
  const maxParkingRequest = Math.min(5, availableParkingCount);
  const effectiveParkingRequested = Math.min(form.parkingRequested, maxParkingRequest);

  const handleProjectChange = (projectId: string): void => {
    setSelectedProject(projectId);
    setSelectedUnit('');
    setForm(prev => ({ ...prev, parkingRequested: 0 }));
  };

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    if (name === 'parkingRequested') {
      setForm(prev => ({ ...prev, parkingRequested: Math.min(maxParkingRequest, Math.max(0, Number(value) || 0)) }));
      return;
    }
    const fieldName = name as BookingTextField;
    setForm(prev => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) setErrors(prev => ({ ...prev, [fieldName]: '' }));
  };

  // Step 1 validation
  const validateStep1 = (): boolean => {
    if (!selectedProject) { toast.error('Please select a project.'); return false; }
    if (isProjectSoldOut) { toast.error('All units in this project are currently booked. Please select another project.'); return false; }
    if (!effectiveSelectedUnit) { toast.error('Please select an available unit.'); return false; }
    return true;
  };

  // Step 2 validation
  const validateStep2 = (): boolean => {
    const newErrors: BookingErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'Required';
    if (!form.lastName.trim()) newErrors.lastName = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Valid email required';
    if (!form.phone.trim() || form.phone.length < 10) newErrors.phone = 'Valid phone required';
    if (!form.nid.trim()) newErrors.nid = 'NID/Passport required';
    if (!form.address.trim()) newErrors.address = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (): void => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const { data: newRequest, error } = await supabase.from('booking_requests').insert({
        property_id: selectedProject,
        property_name: currentProject?.name || 'N/A',
        unit_type: effectiveSelectedUnit,
        client_name: `${form.firstName} ${form.lastName}`,
        client_email: form.email,
        client_phone: form.phone,
        linked_user_id: authUser?.id || null,
        message: `NID: ${form.nid} | Address: ${form.address} | Parking: ${effectiveParkingRequested}`,
        status: 'Pending Review',
      }).select().single();
      if (error) throw error;
      setBookingRef(String(newRequest?.id || '').slice(0, 8).toUpperCase());
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ──
  if (submitted) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '40px 24px' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '56px 40px', textAlign: 'center', maxWidth: '520px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={44} color="#16a34a" />
          </div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', color: '#0a1628', marginBottom: '12px' }}>Booking Submitted!</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
            Thank you, <strong>{form.firstName}</strong>! Your reservation request has been received. Our team will contact you within 24-48 hours.
          </p>
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', marginBottom: '28px' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Booking Reference</p>
            <p style={{ fontSize: '24px', fontWeight: '800', color: '#0d6e4d', letterSpacing: '0.15em' }}>#{bookingRef}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/projects" style={{ ...primaryBtn, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Browse More Projects</Link>
            <Link to="/" style={{ ...secondaryBtn, textAlign: 'center', textDecoration: 'none', display: 'block' }}>Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '60px 24px 80px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 5vw, 40px)', color: '#0a1628', marginBottom: '10px', fontWeight: '700' }}>
            Expression of Interest
          </h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Submit your request to book a property in three easy steps.</p>
        </div>

        {/* Progress Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '48px', position: 'relative' }}>
          {STEPS.map((s, idx) => {
            const isComplete = step > s.id;
            const isActive = step === s.id;
            return (
              <Fragment key={s.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: isComplete ? '#0d6e4d' : isActive ? '#0d6e4d' : '#fff',
                    border: isActive || isComplete ? '2px solid #0d6e4d' : '2px solid #e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isActive || isComplete ? '#fff' : '#9ca3af',
                    fontWeight: '700', fontSize: '16px',
                    transition: 'all 0.3s',
                    boxShadow: isActive ? '0 0 0 4px rgba(13,110,77,0.15)' : 'none',
                  }}>
                    {isComplete ? <CheckCircle size={22} /> : <s.icon size={20} />}
                  </div>
                  <span style={{ marginTop: '8px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: isActive || isComplete ? '#0d6e4d' : '#9ca3af', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: step > s.id ? '#0d6e4d' : '#e5e7eb', margin: '0 8px', marginBottom: '28px', transition: 'background 0.4s' }} />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '40px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>

          {/* ── Step 1: Select Property ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#0a1628', marginBottom: '28px', fontWeight: '700' }}>Select Property Unit</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Select Project</label>
                  {loadingProjects ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280', padding: '14px' }}>
                      <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading projects...
                    </div>
                  ) : (
                    <select
                      value={selectedProject}
                      onChange={e => handleProjectChange(e.target.value)}
                      style={{ ...inputStyle, appearance: 'auto' }}
                    >
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Select Unit Type</label>
                  {isProjectSoldOut ? (
                    <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
                      All units in this project are currently booked or reserved. Please choose another project.
                    </div>
                  ) : (
                    <select
                      value={effectiveSelectedUnit}
                      onChange={e => setSelectedUnit(e.target.value)}
                      style={{ ...inputStyle, appearance: 'auto' }}
                    >
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  )}
                </div>

                {!isProjectSoldOut && maxParkingRequest > 0 && (
                  <div>
                    <label style={labelStyle}>
                      Parking Required (Optional — {availableParkingCount} spot{availableParkingCount === 1 ? '' : 's'} available)
                    </label>
                    <select
                      name="parkingRequested"
                      value={effectiveParkingRequested}
                      onChange={handleFormChange}
                      style={{ ...inputStyle, appearance: 'auto' }}
                    >
                      <option value={0}>None</option>
                      {[...Array(maxParkingRequest)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1} Spot{i > 0 ? 's' : ''} {currentProject?.parkingPrice ? `(+ ৳${Number(currentProject.parkingPrice).toLocaleString()}/each)` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {currentProject && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                    <p style={{ fontWeight: '700', color: '#166534', marginBottom: '8px', fontSize: '14px' }}>{currentProject.name}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#15803d' }}>
                      {currentProject.location && <span>📍 {currentProject.location}</span>}
                      {currentProject.buildingType && <span>🏢 {currentProject.buildingType}</span>}
                      {currentProject.price && <span>💰 {currentProject.price}</span>}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleNext}
                  disabled={isProjectSoldOut || loadingProjects}
                  style={{ ...primaryBtn, opacity: isProjectSoldOut || loadingProjects ? 0.5 : 1, cursor: isProjectSoldOut || loadingProjects ? 'not-allowed' : 'pointer' }}
                >
                  Continue to Personal Details <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Personal Details ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#0a1628', marginBottom: '28px', fontWeight: '700' }}>Personal Details</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {STEP2_FIELDS.map(field => (
                  <div key={field.name} style={{ gridColumn: field.span ? '1 / -1' : 'auto' }}>
                    <label style={labelStyle}>{field.label}</label>
                    <input
                      type={field.type || 'text'}
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleFormChange}
                      placeholder={field.placeholder}
                      style={{ ...inputStyle, borderColor: errors[field.name] ? '#ef4444' : '#e5e7eb' }}
                    />
                    {errors[field.name] && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors[field.name]}</p>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                <button onClick={() => setStep(1)} style={secondaryBtn}>Back</button>
                <button onClick={handleNext} style={{ ...primaryBtn, flex: 1 }}>
                  Review &amp; Confirm <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#0a1628', marginBottom: '28px', fontWeight: '700' }}>Confirm Reservation</h2>

              {/* Summary Box */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '24px', marginBottom: '28px' }}>
                <h3 style={{ fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#166534', marginBottom: '16px' }}>Reservation Summary</h3>
                {([
                  ['Property', currentProject?.name || 'N/A'],
                  ['Unit', effectiveSelectedUnit],
                  ['Parking Spots', effectiveParkingRequested > 0 ? `${effectiveParkingRequested} Spot(s)` : 'None'],
                  ['Applicant', `${form.firstName} ${form.lastName}`],
                  ['Email', form.email],
                  ['Phone', form.phone],
                  ['NID / Passport', form.nid],
                  ['Location', currentProject?.location || 'N/A'],
                ] as const).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #d1fae5', fontSize: '14px' }}>
                    <span style={{ color: '#15803d', fontWeight: '500' }}>{key}</span>
                    <span style={{ color: '#0a1628', fontWeight: '700' }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', fontWeight: '700', paddingTop: '8px' }}>
                  <span style={{ color: '#15803d' }}>Initial Payment Option</span>
                  <span style={{ color: '#0d6e4d' }}>Down Payment upon Confirmation</span>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px', lineHeight: '1.6' }}>
                By submitting, you agree to our terms. Our sales team will contact you within 24-48 hours to finalize the booking and guide you through the payment process.
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep(2)} style={secondaryBtn}>Back</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ ...primaryBtn, flex: 1, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Submitting...</> : <>Submit Expression of Interest <CheckCircle size={18} /></>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
