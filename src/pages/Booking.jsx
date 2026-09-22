import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle, ChevronRight, Loader2, Building2, User, CreditCard } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../context/GlobalState';

const STEPS = [
  { id: 1, label: 'Select Property', icon: Building2 },
  { id: 2, label: 'Your Details',   icon: User },
  { id: 3, label: 'Confirmation',   icon: CreditCard },
];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 16px',
  border: '1.5px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '14px',
  outline: 'none',
  background: '#fff',
  transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '6px',
};

const primaryBtn = {
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

const secondaryBtn = {
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

export default function Booking() {
  const { userProfile } = useGlobalState();
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  // Form state
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [form, setForm] = useState({
    firstName: userProfile?.displayName?.split(' ')[0] || '', 
    lastName: userProfile?.displayName?.split(' ').slice(1).join(' ') || '', 
    email: userProfile?.email || '', 
    phone: userProfile?.phone || '', 
    nid: '', 
    address: '',
  });
  const [errors, setErrors] = useState({});

  // Fetch projects from Firestore
  useEffect(() => {
    getDocs(collection(db, 'properties'))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProjects(data);
        if (data.length > 0) setSelectedProject(data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingProjects(false));
  }, []);

  const currentProject = projects.find(p => p.id === selectedProject);

  // Get unit options from the selected project
  const unitOptions = currentProject?.availableUnits?.length
    ? currentProject.availableUnits.map(u => `${u.name} – ${u.size}`)
    : ['Standard Unit'];

  useEffect(() => {
    if (unitOptions.length > 0) setSelectedUnit(unitOptions[0]);
  }, [selectedProject]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Step 1 validation
  const validateStep1 = () => {
    if (!selectedProject) { toast.error('Please select a project.'); return false; }
    if (!selectedUnit) { toast.error('Please select a unit.'); return false; }
    return true;
  };

  // Step 2 validation
  const validateStep2 = () => {
    const newErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'Required';
    if (!form.lastName.trim()) newErrors.lastName = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Valid email required';
    if (!form.phone.trim() || form.phone.length < 10) newErrors.phone = 'Valid phone required';
    if (!form.nid.trim()) newErrors.nid = 'NID/Passport required';
    if (!form.address.trim()) newErrors.address = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, 'bookingRequests'), {
        projectId: selectedProject,
        projectName: currentProject?.name || 'N/A',
        unitType: selectedUnit,
        clientName: `${form.firstName} ${form.lastName}`,
        clientEmail: form.email,
        clientPhone: form.phone,
        clientNid: form.nid,
        clientAddress: form.address,
        linkedUserId: userProfile?.uid || null,
        status: 'Pending Review',
        createdAt: serverTimestamp(),
      });
      setBookingRef(ref.id.slice(0, 8).toUpperCase());
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
            <a href="/projects" style={{ ...primaryBtn, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Browse More Projects</a>
            <a href="/" style={{ ...secondaryBtn, textAlign: 'center', textDecoration: 'none', display: 'block' }}>Back to Home</a>
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
              <React.Fragment key={s.id}>
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
              </React.Fragment>
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
                      onChange={e => setSelectedProject(e.target.value)}
                      style={{ ...inputStyle, appearance: 'auto' }}
                    >
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Select Unit Type</label>
                  <select
                    value={selectedUnit}
                    onChange={e => setSelectedUnit(e.target.value)}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

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

                <button onClick={handleNext} style={primaryBtn}>
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
                {[
                  { name: 'firstName', label: 'First Name', placeholder: 'John', span: false },
                  { name: 'lastName', label: 'Last Name', placeholder: 'Doe', span: false },
                  { name: 'email', label: 'Email Address', placeholder: 'john@example.com', type: 'email', span: true },
                  { name: 'phone', label: 'Phone Number', placeholder: '+880 1700 000000', span: true },
                  { name: 'nid', label: 'NID / Passport Number', placeholder: 'Your national ID or passport', span: true },
                  { name: 'address', label: 'Current Address', placeholder: 'House, Road, Area, City', span: true },
                ].map(field => (
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
                {[
                  ['Property', currentProject?.name || 'N/A'],
                  ['Unit', selectedUnit],
                  ['Applicant', `${form.firstName} ${form.lastName}`],
                  ['Email', form.email],
                  ['Phone', form.phone],
                  ['NID / Passport', form.nid],
                  ['Location', currentProject?.location || 'N/A'],
                ].map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #d1fae5', fontSize: '14px' }}>
                    <span style={{ color: '#15803d', fontWeight: '500' }}>{key}</span>
                    <span style={{ color: '#0a1628', fontWeight: '700' }}>{val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: '800', paddingTop: '8px' }}>
                  <span style={{ color: '#15803d' }}>Booking Token Amount</span>
                  <span style={{ color: '#0d6e4d', fontSize: '20px' }}>৳ 5,00,000</span>
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
