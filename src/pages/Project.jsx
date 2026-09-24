import React, { useState, useEffect } from 'react';
import { 
  MapPin, BedDouble, Bath, Ruler, Building, Calendar, CheckCircle, 
  Shield, Wifi, Car, Trees, Maximize, Home, Coffee, Info, Map, 
  LayoutDashboard, Heart, Waves, Dumbbell, Flower2, ArrowUpCircle, 
  UserCircle, Zap, Sun, Video, Flame, Droplets, Smile, Baby, 
  Briefcase, BatteryCharging, Navigation, Users, Dog, Trash, Film, FileText, Download, Loader2, Clock, ChevronLeft, ChevronRight, X, Image as ImageIcon
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGlobalState } from '../context/GlobalState';
import { formatPropertyPrice, formatPropertySpecs, parsePriceTk, formatPriceBangladeshi } from '../utils/propertyFormatting';
import { AVAILABLE_ICONS } from '../utils/iconLibrary';

const AMENITY_ICONS = {
  '24/7 Security': Shield,
  'Smart Home Ready': Wifi,
  'Dedicated Parking': Car,
  'Green Spaces': Trees,
  'Infinity Pool': Waves,
  'Fitness Center': Dumbbell,
  'Rooftop Garden': Flower2,
  'High-Speed Elevators': ArrowUpCircle,
  'Concierge Service': UserCircle,
  'Backup Generator': Zap,
  'Solar Power': Sun,
  'CCTV Surveillance': Video,
  'Fire Safety System': Flame,
  'Water Purification': Droplets,
  'Spa & Sauna': Smile,
  "Children's Play Area": Baby,
  'Business Lounge': Briefcase,
  'EV Charging Station': BatteryCharging,
  'Helipad': Navigation,
  "Servant's Quarters": Users,
  'Pet-Friendly Areas': Dog,
  'Waste Management': Trash,
  'Home Theater': Film,
  'Jacuzzi': Bath
};

import { useParams, Navigate, Link, useLocation } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-white min-h-screen">
          <h1 className="text-2xl text-red-600 font-bold mb-4">React Crash Detected</h1>
          <p className="mb-4 text-gray-700">Please copy and paste this entire error message back to me so I can fix it instantly:</p>
          <pre className="bg-gray-100 p-4 rounded overflow-auto border border-gray-300 text-sm">
            {this.state.error && this.state.error.toString()}
            <br />
            <br />
            {this.state.info && this.state.info.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProjectContent() {
  const { toggleWishlist, wishlist, properties, loadingProperties, isLoggedIn, userProfile } = useGlobalState();
  const [activeFloorPlan, setActiveFloorPlan] = useState('Type A');
  const location = useLocation();

  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };

  const { id } = useParams();

  const projectData = properties.find(p => p.id === id) || null;
  const loading = loadingProperties;

  // Inquiry Form State
  const [inquiryData, setInquiryData] = useState({ name: '', phone: '', email: '', message: '' });
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleNextImage = (e) => {
    e?.stopPropagation();
    if (projectData?.images?.gallery) {
      setLightboxIndex((prev) => (prev + 1) % projectData.images.gallery.length);
    }
  };

  const handlePrevImage = (e) => {
    e?.stopPropagation();
    if (projectData?.images?.gallery) {
      setLightboxIndex((prev) => (prev - 1 + projectData.images.gallery.length) % projectData.images.gallery.length);
    }
  };

  useEffect(() => {
    if (isLoggedIn && userProfile) {
      setInquiryData(prev => ({
        ...prev,
        name: userProfile.displayName || '',
        phone: userProfile.phone || '',
        email: userProfile.email || ''
      }));
    }
  }, [isLoggedIn, userProfile]);

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    if (!inquiryData.name || !inquiryData.phone || !inquiryData.email || !inquiryData.message) {
      import('react-toastify').then(({ toast }) => toast.error("Please fill out all fields including a message."));
      return;
    }
    if (!agreedToPolicy) {
      import('react-toastify').then(({ toast }) => toast.error("You must agree to the privacy policy."));
      return;
    }
    setSubmittingInquiry(true);
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await addDoc(collection(db, 'inquiries'), {
        ...inquiryData,
        propertyId: projectData.id,
        propertyName: projectData.name,
        source: 'Property Details Page',
        status: 'Unread',
        createdAt: serverTimestamp()
      });
      import('react-toastify').then(({ toast }) => toast.success("Thank you! Our consultants will contact you shortly."));
      setInquiryData({ name: '', phone: '', email: '', message: '' });
    } catch (err) {
      console.error(err);
      import('react-toastify').then(({ toast }) => toast.error("Failed to submit inquiry. Please try again."));
    } finally {
      setSubmittingInquiry(false);
    }
  };

  useEffect(() => {
    // Scroll to top automatically handled by ScrollToTop component
  }, [id]);

  const displayStatus = React.useMemo(() => {
    if (!projectData) return '';
    if (projectData.inventory && projectData.inventory.length > 0) {
      const hasAvailable = projectData.inventory.some(inv => inv.status === 'Available');
      if (!hasAvailable) return 'Sold Out';
    }
    return projectData.status;
  }, [projectData]);

  const specs = React.useMemo(() => formatPropertySpecs(projectData), [projectData]);
  const priceStr = React.useMemo(() => formatPropertyPrice(projectData), [projectData]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-neutral"><div className="animate-spin text-brand-primary">Loading...</div></div>;
  }

  if (!projectData) {
    return <Navigate to="/" />;
  }

  const isSaved = wishlist.some(p => p.id === projectData.id);

  return (
    <div className="bg-brand-neutral min-h-screen pb-20">
      
      {/* 1. Premium Split Hero Header */}
      <section className="bg-brand-dark min-h-[60vh] md:min-h-[85vh] flex flex-col md:flex-row relative">
        
        {/* Left Content Area (Text & Specs) */}
        <div className="w-full md:w-1/2 flex flex-col justify-center p-6 md:p-12 lg:p-24 relative z-10 pt-28 md:pt-28">
          <div className="text-white w-full max-w-xl mx-auto md:ml-auto md:mr-0">
            <div className="flex flex-wrap gap-3 mb-6">
              <span className="inline-block bg-brand-primary text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-sm shadow-sm">
                {displayStatus}
              </span>
              {projectData.completionDate && (
                <span className="inline-flex items-center gap-1 bg-white/10 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-sm border border-white/20">
                  <Calendar size={14} /> Completion: {projectData.completionDate}
                </span>
              )}
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif mb-6 leading-tight text-white drop-shadow-sm">{projectData.name}</h1>
            
            <p className="flex items-center text-brand-accent text-lg mb-10 opacity-90">
              <MapPin className="mr-2" size={20} /> {projectData.location}
            </p>
            
            <div className="flex flex-wrap gap-6 text-sm font-bold uppercase tracking-wider text-brand-neutral/80 mb-12">
              <div className="flex items-center gap-2"><BedDouble size={20} className="text-brand-accent" /> {specs.beds} Beds</div>
              <div className="flex items-center gap-2"><Bath size={20} className="text-brand-accent" /> {specs.baths} Baths</div>
              <div className="flex items-center gap-2"><Ruler size={20} className="text-brand-accent" /> {specs.sqft} Sq.Ft</div>
            </div>

            <div className="bg-white/5 p-6 md:p-8 rounded-2xl border border-white/10 backdrop-blur-md">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Pricing</p>
              <div className="text-3xl md:text-4xl font-bold text-white mb-8 break-normal">{priceStr}</div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => toggleWishlist(projectData)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl transition-all font-bold shadow-lg ${isSaved ? 'bg-brand-accent text-brand-dark' : 'bg-brand-dark text-white hover:bg-brand-accent hover:text-brand-dark border border-white/20 hover:border-transparent'}`}
                >
                  <Heart size={20} className={isSaved ? "fill-current" : ""} />
                  {isSaved ? 'Saved' : 'Save Property'}
                </button>

                {projectData.brochureUrl ? (
                  <a 
                    href={projectData.brochureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-brand-primary text-white font-bold hover:bg-green-600 transition-colors shadow-lg"
                  >
                    <Download size={20} />
                    Brochure
                  </a>
                ) : (
                  <Link 
                    to={`/contact?property=${projectData.id}`}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-brand-dark text-brand-accent font-bold hover:bg-black transition-colors shadow-lg"
                  >
                    <FileText size={20} />
                    Request Brochure
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Image Area */}
        <div className="w-full md:w-1/2 h-[50vh] md:h-auto relative order-first md:order-last">
          <img 
            src={projectData.images?.hero || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80'} 
            alt={projectData.name} 
            className="absolute inset-0 w-full h-full object-cover object-center md:object-cover" 
          />
          {/* Subtle gradient to blend the edge smoothly into the dark background on desktop */}
          <div className="hidden md:block absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-brand-dark to-transparent"></div>
          {/* Subtle gradient to blend the edge on mobile */}
          <div className="md:hidden absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-dark to-transparent"></div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="container mx-auto px-4 max-w-7xl mt-12">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Left Column (Details) */}
          <div className="w-full lg:w-8/12 space-y-16">
            
            {/* 2. Technical Specifications */}
            <section>
              <h2 className="text-2xl font-serif text-brand-dark mb-6 flex items-center gap-2 border-b border-gray-200 pb-3">
                <Info className="text-brand-primary" /> Technical Details
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100 items-start">
                {projectData.location && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Address</span>
                    <span className="text-brand-dark font-semibold text-lg leading-tight">{projectData.location}</span>
                  </div>
                )}
                {projectData.buildingType && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Building Blueprint</span>
                    <span className="text-brand-dark font-semibold text-sm xl:text-lg break-all">{projectData.buildingType}</span>
                  </div>
                )}
                {projectData.landArea && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Land Area</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.landArea}</span>
                  </div>
                )}
                {projectData.architect && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Architect</span>
                    <span className="text-brand-dark font-semibold text-lg break-words whitespace-normal leading-tight">{projectData.architect}</span>
                  </div>
                )}
                {projectData.totalUnits && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Total Units</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.totalUnits}</span>
                  </div>
                )}
                {projectData.sqft && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Unit Size</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.sqft} SFT</span>
                  </div>
                )}
                {projectData.parkingAvailable && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Parking Available</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.parkingAvailable}</span>
                  </div>
                )}
                {projectData.unitsPerFloor && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Units Per Floor</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.unitsPerFloor}</span>
                  </div>
                )}
                {projectData.frontRoadSize && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Front Road</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.frontRoadSize}</span>
                  </div>
                )}
                {projectData.passengerLifts && (
                  <div className="flex flex-col">
                    <span className="text-brand-primary/60 text-xs font-bold uppercase tracking-wider mb-2">Passenger Lifts</span>
                    <span className="text-brand-dark font-semibold text-lg">{projectData.passengerLifts}</span>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Detailed Overview */}
            <section>
              <h2 className="text-2xl font-serif text-brand-dark mb-6 border-b border-gray-200 pb-3">Property Overview</h2>
              <div className="prose max-w-none text-brand-text/80 leading-relaxed space-y-4">
                {projectData.overview ? (
                  projectData.overview.split('\n').map((paragraph, idx) => (
                    paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
                  ))
                ) : (
                  <>
                    <p>
                      Experience the pinnacle of luxury living at <strong>{projectData.name}</strong>, a masterfully designed residential development located in the heart of {projectData.location}. Designed for those who appreciate exclusivity, this single-unit-per-floor concept guarantees absolute privacy and an undisturbed lifestyle.
                    </p>
                    <p>
                      Every unit is crafted to perfection, featuring imported marble flooring, floor-to-ceiling double-glazed windows, and an expansive layout that maximizes natural light and cross-ventilation. Step into a world where modern architecture meets ecological harmony, backed by the unparalleled security of the Jolshiri Abashon smart city infrastructure.
                    </p>
                  </>
                )}
              </div>
            </section>

            {/* Project Progress Widget */}
            {projectData.milestones && projectData.milestones.length > 0 && (
              <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-8 relative z-10">
                  <h2 className="text-2xl font-serif text-brand-dark flex items-center gap-2">
                    <Clock className="text-brand-primary" /> Construction Progress
                  </h2>
                  <Link to="/progress" className="text-sm font-bold text-brand-primary hover:text-brand-dark transition-colors uppercase tracking-wider">
                    Full Timeline →
                  </Link>
                </div>
                
                {(() => {
                  const total = projectData.milestones.length;
                  const completed = projectData.milestones.filter(m => m.status === 'completed').length;
                  const currentMilestone = projectData.milestones.find(m => m.status === 'current') 
                                        || [...projectData.milestones].reverse().find(m => m.status === 'completed')
                                        || projectData.milestones[0];
                  
                  // Calculate an overall percentage based on completed milestones, plus partial progress of current
                  const basePercentage = (completed / total) * 100;
                  const currentPartial = currentMilestone.status === 'current' ? ((currentMilestone.percentage || 0) / 100) * (100 / total) : 0;
                  const overallPercentage = Math.min(100, Math.round(basePercentage + currentPartial));

                  const images = currentMilestone.images || (currentMilestone.imageUrl ? [currentMilestone.imageUrl] : []);
                  const displayImage = images[0];

                  return (
                    <div className="relative z-10">
                      <div className="flex flex-col md:flex-row gap-6">
                        {displayImage && (
                          <div className="w-full md:w-1/3 h-48 rounded-xl overflow-hidden shrink-0 border border-gray-100 shadow-sm">
                            <img src={displayImage} alt="Current Phase" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                          </div>
                        )}
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full">
                              {currentMilestone.status === 'completed' ? 'Latest Completed' : currentMilestone.status === 'current' ? 'Current Phase' : 'Upcoming Phase'}
                            </span>
                            <span className="text-sm font-bold text-gray-500">{currentMilestone.date}</span>
                          </div>
                          <h3 className="text-2xl font-bold text-brand-dark mb-2">{currentMilestone.title}</h3>
                          <p className="text-gray-600 text-sm line-clamp-3 mb-6 leading-relaxed">{currentMilestone.description}</p>
                          
                          <div className="mt-auto bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex justify-between text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">
                              <span>Overall Project Status</span>
                              <span className="text-brand-primary">{overallPercentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div className="bg-brand-primary h-2 rounded-full transition-all duration-1000 relative" style={{ width: `${overallPercentage}%` }}>
                                {currentMilestone.status === 'current' && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Floor Plan / Layout Section */}
            {projectData.images?.floorPlan && (
              <section className="mb-12">
                <h2 className="text-2xl font-serif text-brand-dark mb-6 border-b border-gray-200 pb-3 flex items-center gap-2">
                  <LayoutDashboard className="text-brand-primary" size={24} /> Project Layouts & Floor Plans
                </h2>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative w-full overflow-hidden rounded-xl bg-gray-50 flex justify-center p-4">
                    <img 
                      src={projectData.images.floorPlan} 
                      alt="Floor Plan" 
                      className="w-full max-w-4xl object-contain rounded-lg hover:scale-[1.02] transition-transform duration-500 cursor-pointer"
                      onClick={() => {
                        // Open in new tab or add to lightbox if needed. For now, simple open in new tab.
                        window.open(projectData.images.floorPlan, '_blank');
                      }}
                    />
                    <div className="absolute bottom-4 right-4 bg-brand-dark/80 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm shadow-md pointer-events-none flex items-center gap-2">
                      <Maximize size={14} /> Click to expand
                    </div>
                  </div>
                  <div className="mt-6 flex gap-4 text-sm text-gray-500 justify-center">
                    <div className="flex items-center gap-1"><CheckCircle size={16} className="text-brand-primary" /> Intelligently Designed Spaces</div>
                    <div className="flex items-center gap-1"><CheckCircle size={16} className="text-brand-primary" /> Maximum Natural Light & Ventilation</div>
                  </div>
                </div>
              </section>
            )}

            {/* Image Gallery Section */}
            {projectData.images?.gallery && projectData.images.gallery.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-serif text-brand-dark mb-6 border-b border-gray-200 pb-3 flex items-center gap-2">
                  <ImageIcon className="text-brand-primary" size={24} /> Project Gallery
                </h2>
                
                {/* Premium Collage Layout */}
                <div className="grid grid-cols-4 md:grid-rows-2 gap-2 md:gap-3 md:h-[450px] lg:h-[550px] rounded-2xl overflow-hidden">
                  {projectData.images.gallery.slice(0, 5).map((imgUrl, idx) => {
                    const total = Math.min(projectData.images.gallery.length, 5);
                    const extraCount = projectData.images.gallery.length - 5;
                    const isLast = idx === 4;
                    
                    let desktop = '';
                    if (total === 1) desktop = 'md:col-span-4 md:row-span-2';
                    else if (total === 2) desktop = 'md:col-span-2 md:row-span-2';
                    else if (total === 3) {
                      if (idx === 0) desktop = 'md:col-span-2 md:row-span-2';
                      else desktop = 'md:col-span-2 md:row-span-1';
                    }
                    else if (total === 4) {
                      if (idx === 0) desktop = 'md:col-span-2 md:row-span-2';
                      else if (idx === 1) desktop = 'md:col-span-2 md:row-span-1';
                      else desktop = 'md:col-span-1 md:row-span-1';
                    }
                    else {
                      if (idx === 0) desktop = 'md:col-span-2 md:row-span-2';
                      else desktop = 'md:col-span-1 md:row-span-1';
                    }
                    
                    const mobile = idx === 0 ? 'col-span-4 row-span-2 h-[250px] md:h-auto' : 'hidden md:block';

                    return (
                      <div 
                        key={idx}
                        onClick={() => openLightbox(idx)}
                        className={`${mobile} ${desktop} relative group cursor-pointer overflow-hidden bg-gray-100`}
                      >
                        <img 
                          src={imgUrl} 
                          alt={`Gallery Image ${idx + 1}`} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        />
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                          {isLast && extraCount > 0 ? (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="text-white font-bold text-lg md:text-xl">+{extraCount} Photos</span>
                            </div>
                          ) : (
                            <Maximize className="text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" size={32} />
                          )}
                        </div>

                        {/* Mobile 'View All' Button (only on first image if multiple exist) */}
                        {idx === 0 && projectData.images.gallery.length > 1 && (
                          <div className="md:hidden absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow font-bold text-sm text-brand-dark flex items-center gap-2">
                            <ImageIcon size={16} /> View all {projectData.images.gallery.length} photos
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Video Tour Section (if uploaded) */}
            {projectData.images?.video && (
              <section>
                <h2 className="text-2xl font-serif text-brand-dark mb-6 border-b border-gray-200 pb-3">Property Video Tour</h2>
                <div className="rounded-xl overflow-hidden shadow-lg border border-gray-100 relative pt-[56.25%]">
                  {projectData.images.video.includes('youtube') || projectData.images.video.includes('youtu.be') ? (
                    <iframe 
                      src={getEmbedUrl(projectData.images.video)} 
                      title="Property Video Tour" 
                      className="absolute top-0 left-0 w-full h-full border-0 bg-black" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen 
                    />
                  ) : (
                    <video src={projectData.images.video} controls className="absolute top-0 left-0 w-full h-full object-cover bg-black" />
                  )}
                </div>
              </section>
            )}

            {/* 3.5 Available Units Section */}
            {projectData.availableUnits && projectData.availableUnits.length > 0 && (
              <section>
                <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-3">
                  <div>
                    <h2 className="text-2xl font-serif text-brand-dark">Available Units</h2>
                    <p className="text-sm text-gray-500 mt-1">Choose the perfect space for your lifestyle</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projectData.availableUnits.map((unit, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-lg transition-all hover:-translate-y-1">
                      <h4 className="text-xl font-serif font-bold text-brand-primary mb-4">{unit.name}</h4>
                      <ul className="space-y-3 text-sm text-brand-text/80 font-medium">
                        <li className="flex justify-between border-b border-gray-50 pb-2"><span>Size</span> <span className="text-brand-dark font-bold">{unit.size} SFT</span></li>
                        <li className="flex justify-between border-b border-gray-50 pb-2"><span>Bedrooms</span> <span className="text-brand-dark font-bold">{unit.beds}</span></li>
                        <li className="flex justify-between border-b border-gray-50 pb-2"><span>Bathrooms</span> <span className="text-brand-dark font-bold">{unit.baths}</span></li>
                        <li className="flex justify-between border-b border-gray-50 pb-2"><span>Balcony</span> <span className="text-brand-dark font-bold">{unit.balconies}</span></li>
                        {unit.price && (
                           <li className="flex justify-between pb-1">
                             <span>Price</span> 
                             <span className="text-brand-primary font-bold">
                               {(() => {
                                  const p = parsePriceTk(unit.price);
                                  return p ? `৳ ${formatPriceBangladeshi(p)}` : unit.price;
                               })()}
                             </span>
                           </li>
                        )}
                        {!unit.price && (
                           <li className="flex justify-between pb-1"><span>Price</span> <span className="text-brand-primary font-bold">On Request</span></li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Amenities Grid */}
            <section>
              <h2 className="text-2xl font-serif text-brand-dark mb-6 border-b border-gray-200 pb-3">Premium Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Render hardcoded amenities */}
                {(projectData.amenities && projectData.amenities.length > 0 ? projectData.amenities : [
                  '24/7 Security', 'Smart Home Ready', 'Dedicated Parking', 'Green Spaces'
                ]).map((amenityName, idx) => {
                  const IconComponent = AMENITY_ICONS[amenityName] || CheckCircle;
                  return (
                    <div key={`hardcoded-${idx}`} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mb-3">
                        <IconComponent size={24} />
                      </div>
                      <span className="text-sm font-semibold text-brand-dark">{amenityName}</span>
                    </div>
                  );
                })}
                
                {/* Render custom amenities */}
                {projectData.customAmenities && projectData.customAmenities.map((amenity, idx) => {
                  const IconComponent = AVAILABLE_ICONS[amenity.icon] || CheckCircle;
                  return (
                    <div key={`custom-${idx}`} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-md transition-shadow border-brand-accent/30">
                      <div className="w-12 h-12 bg-brand-accent/20 text-brand-primary rounded-full flex items-center justify-center mb-3">
                        <IconComponent size={24} />
                      </div>
                      <span className="text-sm font-semibold text-brand-dark">{amenity.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 5. Floor Plans Viewer */}
            {projectData.images?.floorPlans && Object.keys(projectData.images.floorPlans).length > 0 && (
              <section>
                <h2 className="text-2xl font-serif text-brand-dark mb-6 flex items-center gap-2 border-b border-gray-200 pb-3">
                  <LayoutDashboard className="text-brand-primary" /> Floor Plans
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex border-b border-gray-100 bg-gray-50">
                    {Object.keys(projectData.images.floorPlans).map((plan) => (
                      <button
                        key={plan}
                        onClick={() => setActiveFloorPlan(plan)}
                        className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wider transition-colors ${activeFloorPlan === plan ? 'bg-white text-brand-primary border-t-2 border-brand-primary' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                  <div className="p-8 bg-gray-100 flex justify-center items-center min-h-[400px]">
                    <img 
                      src={projectData.images.floorPlans[activeFloorPlan]} 
                      alt={`Floor plan ${activeFloorPlan}`} 
                      className="max-w-full h-auto rounded shadow-lg"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 6. Location Map & Landmarks */}
            {projectData.images?.map && (
              <section>
                <h2 className="text-2xl font-serif text-brand-dark mb-6 flex items-center gap-2 border-b border-gray-200 pb-3">
                  <Map className="text-brand-primary" /> Location & Connectivity
                </h2>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-2/3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                    <div className="relative h-80 rounded-lg overflow-hidden bg-gray-200">
                      <img src={projectData.images.map} alt="Map Location" className="w-full h-full object-cover" />
                      <a 
                        href={projectData.googleMapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(projectData.location || projectData.name)}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="absolute inset-0 bg-brand-dark/20 hover:bg-brand-dark/40 transition-colors flex items-center justify-center group cursor-pointer"
                        title="Open in Google Maps"
                      >
                        <div className="bg-white px-4 py-2 rounded shadow-lg text-brand-primary font-bold flex items-center gap-2 group-hover:scale-105 transition-transform">
                          <MapPin size={18} /> View on Google Maps
                        </div>
                      </a>
                    </div>
                  </div>

                  {projectData.landmarks && (
                    <div className="w-full md:w-1/3 bg-brand-dark text-white rounded-xl p-6 shadow-lg">
                      <h4 className="text-lg font-serif text-brand-accent mb-6 border-b border-white/20 pb-3">Nearby Landmarks</h4>
                      <ul className="space-y-5">
                        {projectData.landmarks.split(',').map((landmark, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <CheckCircle size={18} className="text-brand-accent mt-0.5 shrink-0" />
                            <span className="opacity-90 leading-tight">{landmark.trim()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Column (Sticky Sidebar) */}
          <div className="w-full lg:w-4/12 relative">
            <div className="sticky top-28 bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-serif text-brand-dark mb-2">Contact Us</h3>
                <p className="text-sm text-brand-text/70 italic">Let us guide you to the extraordinary</p>
              </div>
              <p className="text-sm text-brand-text/80 mb-6 text-center">Share your details and our team will reach out to help you find your perfect home in {projectData.name}.</p>
              
              {!isLoggedIn && (
                <div className="bg-brand-primary/10 border border-brand-primary/20 p-4 mb-6 rounded text-xs text-brand-dark text-center">
                  <span className="font-semibold text-brand-primary">Have an account? </span>
                  <Link to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} className="font-bold text-brand-primary hover:underline underline-offset-2">
                    Sign in
                  </Link>
                  <span> to automatically link this inquiry to your profile.</span>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleInquirySubmit}>
                <div>
                  <input type="text" required value={inquiryData.name} onChange={(e) => setInquiryData(p => ({...p, name: e.target.value}))} readOnly={isLoggedIn} className={`w-full p-4 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary transition-colors text-sm ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`} placeholder="Full Name*" />
                </div>
                <div>
                  <input type="tel" required value={inquiryData.phone} onChange={(e) => setInquiryData(p => ({...p, phone: e.target.value}))} readOnly={isLoggedIn} className={`w-full p-4 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary transition-colors text-sm ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`} placeholder="Phone Number*" />
                </div>
                <div>
                  <input type="email" required value={inquiryData.email} onChange={(e) => setInquiryData(p => ({...p, email: e.target.value}))} readOnly={isLoggedIn} className={`w-full p-4 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary transition-colors text-sm ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`} placeholder="Email Address*" />
                </div>
                <div>
                  <textarea rows="4" required value={inquiryData.message} onChange={(e) => setInquiryData(p => ({...p, message: e.target.value}))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand-primary transition-colors text-sm resize-none" placeholder="Message*" />
                </div>
                
                <button type="submit" disabled={submittingInquiry} className="w-full bg-brand-primary flex items-center justify-center gap-2 text-white font-bold py-4 rounded hover:bg-brand-dark transition-colors shadow-lg mt-2 disabled:opacity-70">
                  {submittingInquiry && <Loader2 className="animate-spin" size={20} />}
                  {submittingInquiry ? 'Sending...' : 'Send A Message'}
                </button>

                <div className="mt-6 flex items-start gap-3 text-xs text-gray-500 leading-relaxed">
                  <input 
                    type="checkbox" 
                    id="privacy-policy" 
                    checked={agreedToPolicy}
                    onChange={(e) => setAgreedToPolicy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 shrink-0 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary focus:ring-2 cursor-pointer accent-brand-primary"
                  />
                  <label htmlFor="privacy-policy" className="cursor-pointer">
                    By submitting this form, you agree to our <Link to="/legal" target="_blank" className="text-brand-primary font-bold hover:underline">privacy policy</Link>. Your personal information will be kept safe and secure, and we'll only use it to contact you about your inquiry.
                  </label>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
      
      {/* Full-screen Lightbox */}
      <AnimatePresence>
        {lightboxOpen && projectData.images?.gallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md"
            onClick={closeLightbox}
          >
            <div className="absolute top-6 right-6 z-10">
              <button 
                onClick={closeLightbox}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
              >
                <X size={28} />
              </button>
            </div>
            
            <button
              onClick={handlePrevImage}
              className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 backdrop-blur-sm transition-colors z-10"
            >
              <ChevronLeft size={36} />
            </button>
            
            <motion.div 
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-5xl max-h-[85vh] px-4 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={projectData.images.gallery[lightboxIndex]} 
                alt={`Gallery ${lightboxIndex + 1}`} 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
            
            <button
              onClick={handleNextImage}
              className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 backdrop-blur-sm transition-colors z-10"
            >
              <ChevronRight size={36} />
            </button>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white font-medium tracking-widest text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
              {lightboxIndex + 1} / {projectData.images.gallery.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Project() {
  return (
    <ErrorBoundary>
      <ProjectContent />
    </ErrorBoundary>
  );
}
