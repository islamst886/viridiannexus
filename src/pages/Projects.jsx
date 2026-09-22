import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { usePropertyTypes } from '../hooks/usePropertyTypes';
import { useGlobalState } from '../context/GlobalState';

// Parse a price string like "৳ 7,50,00,000" → 75000000 (number)
function parsePriceTk(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const PRICE_RANGES = [
  { label: 'Under 1 Crore', min: 0, max: 10000000 },
  { label: '1 – 3 Crore', min: 10000000, max: 30000000 },
  { label: '3 – 5 Crore', min: 30000000, max: 50000000 },
  { label: '5 – 10 Crore', min: 50000000, max: 100000000 },
  { label: 'Above 10 Crore', min: 100000000, max: Infinity },
];

const badgeColor = (status) => {
  if (status === 'On Sale') return '#16a34a';
  if (status === 'Under Construction') return '#ea580c';
  if (status === 'Ready') return '#2563eb';
  if (status === 'Sold Out') return '#dc2626';
  return '#0d6e4d';
};

const STATUSES = ['Under Construction', 'On Sale', 'Ready', 'Sold Out', 'Upcoming'];

const sidebarStyle = {
  background: '#fff',
  borderRadius: '12px',
  boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
  border: '1px solid #e5e7eb',
  padding: '24px',
};

const sectionHeadingStyle = {
  fontSize: '11px', fontWeight: '800', letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#374151',
  marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6',
  margin: '0 0 12px 0',
};

const checkRowStyle = {
  display: 'flex', alignItems: 'center', gap: '10px',
  cursor: 'pointer', marginBottom: '10px',
};

// ─── FilterContent is defined OUTSIDE the parent so React never recreates it ───
function FilterContent({
  searchTerm, setSearchTerm,
  communities, selectedCommunities, toggleCommunity,
  propertyTypes,
  selectedTypes, toggleType,
  selectedStatus, toggleStatus,
  selectedPriceRanges, togglePriceRange,
  clearAll,
}) {
  const hasActiveFilters = selectedCommunities.length > 0 || selectedStatus.length > 0 || selectedPriceRanges.length > 0 || selectedTypes.length > 0 || searchTerm;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search
          size={15}
          style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
        />
        <input
          type="text"
          placeholder="Search by name or location..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            paddingLeft: '36px', paddingRight: '12px', paddingTop: '10px', paddingBottom: '10px',
            border: '1px solid #e5e7eb', borderRadius: '8px',
            fontSize: '13px', outline: 'none', background: '#f9fafb',
          }}
        />
      </div>

      {/* Communities */}
      {communities.length > 0 && (
        <div>
          <p style={sectionHeadingStyle}>Communities</p>
          {communities.map(c => (
            <label key={c} style={checkRowStyle}>
              <input
                type="checkbox"
                checked={selectedCommunities.includes(c)}
                onChange={() => toggleCommunity(c)}
                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#0d6e4d' }}
              />
              <span style={{ fontSize: '13px', color: '#4b5563' }}>{c}</span>
            </label>
          ))}
        </div>
      )}

      {/* Property Type */}
      <div>
        <p style={sectionHeadingStyle}>Property Type</p>
        {propertyTypes.map(t => (
          <label key={t} style={checkRowStyle}>
            <input
              type="checkbox"
              checked={selectedTypes.includes(t)}
              onChange={() => toggleType(t)}
              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#0d6e4d' }}
            />
            <span style={{ fontSize: '13px', color: '#4b5563' }}>{t}</span>
          </label>
        ))}
      </div>

      {/* Price Range */}
      <div>
        <p style={sectionHeadingStyle}>Price Range</p>
        {PRICE_RANGES.map(r => (
          <label key={r.label} style={checkRowStyle}>
            <input
              type="checkbox"
              checked={selectedPriceRanges.includes(r.label)}
              onChange={() => togglePriceRange(r.label)}
              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#0d6e4d' }}
            />
            <span style={{ fontSize: '13px', color: '#4b5563' }}>{r.label}</span>
          </label>
        ))}
      </div>

      {/* Project Status */}
      <div>
        <p style={sectionHeadingStyle}>Project Status</p>
        {STATUSES.map(s => (
          <label key={s} style={checkRowStyle}>
            <input
              type="checkbox"
              checked={selectedStatus.includes(s)}
              onChange={() => toggleStatus(s)}
              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#0d6e4d' }}
            />
            <span style={{ fontSize: '13px', color: '#4b5563' }}>{s}</span>
          </label>
        ))}
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          style={{
            width: '100%', padding: '9px', fontSize: '13px', fontWeight: '700',
            color: '#ef4444', background: '#fff1f2', border: '1px solid #fecaca',
            borderRadius: '8px', cursor: 'pointer',
          }}
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}

export default function Projects() {
  const [searchParams] = useSearchParams();
  const { types: propertyTypes } = usePropertyTypes();
  const { properties, loadingProperties: loading } = useGlobalState();
  const [searchTerm, setSearchTerm] = useState('');
  // Pre-seed from homepage query params
  const [selectedCommunities, setSelectedCommunities] = useState(() => {
    const loc = searchParams.get('location');
    return loc ? [loc] : [];
  });
  const [selectedStatus, setSelectedStatus] = useState(() => {
    const st = searchParams.get('status');
    return st ? [st] : [];
  });
  const [selectedPriceRanges, setSelectedPriceRanges] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(() => {
    const t = searchParams.get('type');
    return t ? [t] : [];
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const communities = useMemo(() =>
    [...new Set(properties.map(p => p.location).filter(Boolean))], [properties]);

  const toggleCommunity = useCallback(c =>
    setSelectedCommunities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]), []);

  const toggleStatus = useCallback(s =>
    setSelectedStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]), []);

  const togglePriceRange = useCallback(label =>
    setSelectedPriceRanges(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]), []);

  const toggleType = useCallback(t =>
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]), []);

  const clearAll = useCallback(() => {
    setSelectedCommunities([]); setSelectedStatus([]);
    setSelectedPriceRanges([]); setSelectedTypes([]); setSearchTerm('');
  }, []);

  const filtered = useMemo(() => {
    const activePriceRanges = PRICE_RANGES.filter(r => selectedPriceRanges.includes(r.label));
    return properties.filter(p => {
      const search = !searchTerm ||
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchTerm.toLowerCase());
      const com    = selectedCommunities.length === 0 || selectedCommunities.includes(p.location);
      const status = selectedStatus.length === 0 || selectedStatus.includes(p.status);
      const type   = selectedTypes.length === 0 || selectedTypes.includes(p.propertyType);
      const price  = activePriceRanges.length === 0 || (() => {
        const val = parsePriceTk(p.price);
        if (val === null) return true;
        return activePriceRanges.some(r => val >= r.min && val < r.max);
      })();
      return search && com && status && type && price;
    });
  }, [properties, searchTerm, selectedCommunities, selectedStatus, selectedTypes, selectedPriceRanges]);

  const filterProps = {
    searchTerm, setSearchTerm,
    communities, selectedCommunities, toggleCommunity,
    propertyTypes,
    selectedTypes, toggleType,
    selectedStatus, toggleStatus,
    selectedPriceRanges, togglePriceRange,
    clearAll,
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #0d6e4d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#6b7280' }}>Loading properties...</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>

      {/* Hero */}
      <div style={{ background: '#0a1628', padding: '56px 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 5vw, 46px)', color: '#c9a84c', marginBottom: '12px', fontWeight: '700' }}>
          Discover Your Next Home
        </h1>
        <p style={{ color: '#c9d1d9', fontSize: '16px', maxWidth: '540px', margin: '0 auto', lineHeight: '1.7' }}>
          Search and filter our exclusive collection of masterfully designed properties.
        </p>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '36px 24px' }}>

        {/* ── Mobile: filter bar ── */}
        <div className="mobile-bar">
          <span style={{ fontWeight: '700', color: '#111827', fontSize: '14px' }}>
            Showing {filtered.length} of {properties.length} projects
          </span>
          <button
            onClick={() => setMobileFiltersOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0d6e4d', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
        </div>

        {/* ── Mobile: drawer modal ── */}
        {mobileFiltersOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setMobileFiltersOpen(false)} />
            <div style={{ position: 'relative', width: '82%', maxWidth: '360px', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '4px 0 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                <h2 style={{ fontWeight: '800', fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111827' }}>Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={16} color="#374151" />
                </button>
              </div>
              <div style={{ padding: '22px' }}>
                <FilterContent {...filterProps} />
              </div>
            </div>
          </div>
        )}

        {/* ── Desktop: sidebar + grid ── */}
        <div className="page-layout">

          {/* Sidebar */}
          <div className="sidebar-col">
            <div style={{ ...sidebarStyle, position: 'sticky', top: '96px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#111827', margin: 0 }}>Filters</h3>
                <span style={{ fontSize: '11px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '999px' }}>{filtered.length} results</span>
              </div>
              <FilterContent {...filterProps} />
            </div>
          </div>

          {/* Grid */}
          <div className="grid-col">
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
              Showing <strong style={{ color: '#111827' }}>{filtered.length}</strong> of <strong style={{ color: '#111827' }}>{properties.length}</strong> projects
            </p>

            {filtered.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '56px 24px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                <Search size={44} color="#d1d5db" style={{ margin: '0 auto 14px' }} />
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#111827', marginBottom: '6px' }}>No Projects Found</h3>
                <p style={{ color: '#6b7280', marginBottom: '18px' }}>Try adjusting your filters or search term.</p>
                <button onClick={clearAll} style={{ background: '#0d6e4d', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="property-grid">
                {filtered.map(property => (
                  <Link
                    to={`/property/${property.id}`}
                    key={property.id}
                    className="property-card"
                    style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb', transition: 'transform 0.22s ease, box-shadow 0.22s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.07)'; }}
                  >
                    <div style={{ position: 'relative', height: '210px', overflow: 'hidden', background: '#e5e7eb', flexShrink: 0 }}>
                      <img
                        src={property.images?.hero || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'}
                        alt={property.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease', display: 'block' }}
                      />
                      <span style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: badgeColor(property.status), color: '#fff',
                        fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase',
                        padding: '4px 10px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }}>
                        {property.status || 'Upcoming'}
                      </span>
                    </div>

                    <div style={{ padding: '16px 18px 18px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '7px' }}>
                        <MapPin size={12} color="#16a34a" />
                        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a' }}>
                          {property.location}
                        </span>
                      </div>

                      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: '700', color: '#111827', marginBottom: '4px', lineHeight: '1.3' }}>
                        {property.name}
                      </h3>

                      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                        {property.buildingType ? `Building Type: ${property.buildingType}` : 'Residential Property'}
                      </p>

                      {property.price && (
                        <p style={{ fontSize: '13px', fontWeight: '700', color: '#0d6e4d', marginBottom: '12px' }}>
                          {property.price}
                        </p>
                      )}

                      <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>{property.location}</span>
                        <ChevronRight size={17} color="#9ca3af" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .mobile-bar {
          display: none;
          justify-content: space-between;
          align-items: center;
          background: #fff;
          padding: 14px 18px;
          border-radius: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          margin-bottom: 24px;
          border: 1px solid #e5e7eb;
        }
        .page-layout {
          display: flex;
          gap: 28px;
          align-items: flex-start;
        }
        .sidebar-col {
          width: 260px;
          flex-shrink: 0;
        }
        .grid-col {
          flex: 1;
          min-width: 0;
        }
        .property-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 22px;
        }
        @media (max-width: 1023px) {
          .sidebar-col { display: none; }
          .mobile-bar { display: flex; }
        }
        @media (max-width: 640px) {
          .property-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
