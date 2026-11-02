import React, { useState } from 'react';
import { Search, MapPin, Building2, SlidersHorizontal, ArrowRight, Sparkles, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QUICK_TAGS = [
  { label: 'Jolshiri Smart City', key: 'location', value: 'Jolshiri Abashon' },
  { label: 'Gulshan Diplomatic', key: 'location', value: 'Gulshan 2' },
  { label: 'Penthouses', key: 'type', value: 'Penthouse' },
  { label: 'Ready to Move', key: 'status', value: 'Ready' },
  { label: 'Under Construction', key: 'status', value: 'Under Construction' },
];

const PRICE_TIERS = [
  { value: '', label: 'Any Investment Tier' },
  { value: 'Under 1 Crore', label: 'Under ৳ 1 Crore' },
  { value: '1 – 3 Crore', label: '৳ 1 – 3 Crore' },
  { value: '3 – 5 Crore', label: '৳ 3 – 5 Crore' },
  { value: '5 – 10 Crore', label: '৳ 5 – 10 Crore' },
  { value: 'Above 10 Crore', label: 'Above ৳ 10 Crore' },
];

export default function ConciergeSearch({ locations = [], propertyTypes = [], _statuses = [] }) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [status, setStatus] = useState('');
  const [priceTier, setPriceTier] = useState('');

  // Dropdown open state: 'location' | 'type' | 'price' | null
  const [openDropdown, setOpenDropdown] = useState(null);

  // Fallback defaults if database hasn't loaded locations yet
  const displayLocations = locations.length > 0 ? locations : [
    'Jolshiri Abashon, Dhaka',
    'Gulshan 2, Dhaka',
    'Banani, Dhaka',
    'Baridhara Diplomatic Enclave',
    'Purbachal, Dhaka'
  ];

  const displayTypes = propertyTypes.length > 0 ? propertyTypes : [
    'Penthouse',
    'Luxury Apartment',
    'Smart Home',
    'Duplex',
    'Villa'
  ];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (propertyType) params.set('type', propertyType);
    if (status) params.set('status', status);
    else if (selectedCategory === 'Ready') params.set('status', 'Ready');
    else if (selectedCategory === 'Ongoing') params.set('status', 'Under Construction');
    else if (selectedCategory === 'Penthouse') params.set('type', 'Penthouse');
    
    if (priceTier) params.set('price', priceTier);

    navigate(`/projects?${params.toString()}`);
  };

  const handleQuickTag = (tag) => {
    const params = new URLSearchParams();
    params.set(tag.key, tag.value);
    navigate(`/projects?${params.toString()}`);
  };

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  return (
    <section className="relative z-20 py-8 sm:py-12 max-w-6xl mx-auto w-full px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 transform hover:shadow-brand-primary/10 transition-all">
        
        {/* Category Tabs Header */}
        <div className="bg-brand-neutral border-b border-gray-200/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 rounded-t-2xl">
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'All', label: 'All Residences' },
              { id: 'Ready', label: 'Ready to Move' },
              { id: 'Ongoing', label: 'Under Construction' },
              { id: 'Penthouse', label: 'Penthouses & Duplexes' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedCategory(tab.id);
                  if (tab.id === 'Ready') setStatus('Ready');
                  else if (tab.id === 'Ongoing') setStatus('Under Construction');
                  else if (tab.id === 'Penthouse') setPropertyType('Penthouse');
                  else {
                    setStatus('');
                    setPropertyType('');
                  }
                }}
                className={`text-xs font-bold uppercase tracking-wider py-1.5 px-3.5 rounded-full transition-all ${
                  selectedCategory === tab.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-dark/70 hover:text-brand-primary hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-brand-dark/60 font-medium">
            <Sparkles size={13} className="text-brand-primary" />
            <span>Curated Architectural Portfolio</span>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          
          {/* 1. Location Dropdown */}
          <div className="w-full relative">
            <label className="block text-[11px] font-bold text-brand-primary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <MapPin size={13} />
              <span>Location / Enclave</span>
            </label>
            
            <button
              type="button"
              onClick={() => toggleDropdown('location')}
              className={`w-full py-2.5 px-3.5 border rounded-xl text-left flex items-center justify-between transition-all outline-none text-sm font-medium ${
                openDropdown === 'location'
                  ? 'border-brand-primary ring-2 ring-brand-primary/10 bg-white shadow-sm'
                  : 'border-gray-200 bg-brand-neutral/40 hover:bg-white hover:border-brand-primary/60 text-brand-dark'
              }`}
            >
              <span className={`truncate pr-2 ${location ? 'text-brand-primary font-bold' : 'text-brand-dark/80'}`}>
                {location || 'All Locations in Dhaka'}
              </span>
              <ChevronDown 
                size={16} 
                className={`shrink-0 transition-transform duration-200 ${
                  openDropdown === 'location' ? 'rotate-180 text-brand-primary' : 'text-gray-400 group-hover:text-brand-primary'
                }`} 
              />
            </button>

            {openDropdown === 'location' && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        setLocation('');
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-xs sm:text-sm ${
                        !location 
                          ? 'bg-brand-primary/10 text-brand-primary font-bold' 
                          : 'text-brand-dark/80 hover:bg-brand-neutral/80 hover:text-brand-primary'
                      }`}
                    >
                      <span>All Locations in Dhaka</span>
                      {!location && <Check size={15} className="text-brand-primary shrink-0" />}
                    </button>
                    {displayLocations.map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setLocation(loc);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-xs sm:text-sm ${
                          location === loc 
                            ? 'bg-brand-primary/10 text-brand-primary font-bold' 
                            : 'text-brand-dark/80 hover:bg-brand-neutral/80 hover:text-brand-primary'
                        }`}
                      >
                        <span className="truncate pr-2">{loc}</span>
                        {location === loc && <Check size={15} className="text-brand-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2. Property Typology Dropdown */}
          <div className="w-full sm:border-l sm:border-gray-200/80 sm:pl-4 relative">
            <label className="block text-[11px] font-bold text-brand-primary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} />
              <span>Property Typology</span>
            </label>
            
            <button
              type="button"
              onClick={() => toggleDropdown('type')}
              className={`w-full py-2.5 px-3.5 border rounded-xl text-left flex items-center justify-between transition-all outline-none text-sm font-medium ${
                openDropdown === 'type'
                  ? 'border-brand-primary ring-2 ring-brand-primary/10 bg-white shadow-sm'
                  : 'border-gray-200 bg-brand-neutral/40 hover:bg-white hover:border-brand-primary/60 text-brand-dark'
              }`}
            >
              <span className={`truncate pr-2 ${propertyType ? 'text-brand-primary font-bold' : 'text-brand-dark/80'}`}>
                {propertyType || 'All Residence Types'}
              </span>
              <ChevronDown 
                size={16} 
                className={`shrink-0 transition-transform duration-200 ${
                  openDropdown === 'type' ? 'rotate-180 text-brand-primary' : 'text-gray-400 group-hover:text-brand-primary'
                }`} 
              />
            </button>

            {openDropdown === 'type' && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        setPropertyType('');
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-xs sm:text-sm ${
                        !propertyType 
                          ? 'bg-brand-primary/10 text-brand-primary font-bold' 
                          : 'text-brand-dark/80 hover:bg-brand-neutral/80 hover:text-brand-primary'
                      }`}
                    >
                      <span>All Residence Types</span>
                      {!propertyType && <Check size={15} className="text-brand-primary shrink-0" />}
                    </button>
                    {displayTypes.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setPropertyType(t);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-xs sm:text-sm ${
                          propertyType === t 
                            ? 'bg-brand-primary/10 text-brand-primary font-bold' 
                            : 'text-brand-dark/80 hover:bg-brand-neutral/80 hover:text-brand-primary'
                        }`}
                      >
                        <span className="truncate pr-2">{t}</span>
                        {propertyType === t && <Check size={15} className="text-brand-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Investment Tier Dropdown */}
          <div className="w-full lg:border-l lg:border-gray-200/80 lg:pl-4 relative">
            <label className="block text-[11px] font-bold text-brand-primary uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <SlidersHorizontal size={13} />
              <span>Investment Tier</span>
            </label>
            
            <button
              type="button"
              onClick={() => toggleDropdown('price')}
              className={`w-full py-2.5 px-3.5 border rounded-xl text-left flex items-center justify-between transition-all outline-none text-sm font-medium ${
                openDropdown === 'price'
                  ? 'border-brand-primary ring-2 ring-brand-primary/10 bg-white shadow-sm'
                  : 'border-gray-200 bg-brand-neutral/40 hover:bg-white hover:border-brand-primary/60 text-brand-dark'
              }`}
            >
              <span className={`truncate pr-2 ${priceTier ? 'text-brand-primary font-bold' : 'text-brand-dark/80'}`}>
                {PRICE_TIERS.find(t => t.value === priceTier)?.label || 'Any Investment Tier'}
              </span>
              <ChevronDown 
                size={16} 
                className={`shrink-0 transition-transform duration-200 ${
                  openDropdown === 'price' ? 'rotate-180 text-brand-primary' : 'text-gray-400 group-hover:text-brand-primary'
                }`} 
              />
            </button>

            {openDropdown === 'price' && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-50">
                    {PRICE_TIERS.map(tier => (
                      <button
                        key={tier.label}
                        type="button"
                        onClick={() => {
                          setPriceTier(tier.value);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-xs sm:text-sm ${
                          priceTier === tier.value 
                            ? 'bg-brand-primary/10 text-brand-primary font-bold' 
                            : 'text-brand-dark/80 hover:bg-brand-neutral/80 hover:text-brand-primary'
                        }`}
                      >
                        <span className="truncate pr-2">{tier.label}</span>
                        {priceTier === tier.value && <Check size={15} className="text-brand-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Search CTA */}
          <div className="w-full lg:pl-2">
            <button
              onClick={handleSearch}
              className="w-full bg-brand-primary hover:bg-brand-dark text-white py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 group"
            >
              <Search size={16} />
              <span>Search Residences</span>
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform text-brand-accent" />
            </button>
          </div>

        </div>

        {/* Quick Discovery Tags */}
        <div className="bg-brand-neutral/60 px-4 sm:px-6 py-2.5 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs text-brand-dark/70 rounded-b-2xl">
          <span className="font-bold uppercase tracking-wider text-[10px] text-brand-primary">
            Quick Discovery:
          </span>
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag.label}
              onClick={() => handleQuickTag(tag)}
              className="bg-white hover:bg-brand-primary hover:text-white px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 transition-colors shadow-2xs"
            >
              #{tag.label}
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}
