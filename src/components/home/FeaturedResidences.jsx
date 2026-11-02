import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Heart, BedDouble, Bath, Ruler, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPropertyPrice, formatPropertySpecs } from '../../utils/propertyFormatting';

const CURATED_FALLBACK_RESIDENCES = [
  {
    id: 'the-sapphire-penthouse',
    name: 'The Sapphire Penthouse',
    location: 'Road 83, Gulshan 2 Diplomatic Zone, Dhaka',
    price: '৳ 5,50,00,000',
    type: 'Penthouse',
    propertyType: ['Penthouse', 'Smart Home'],
    status: 'Ready',
    beds: 4,
    baths: 5,
    sqft: '4,850',
    exclusivity: 'Single Unit Per Floor • Private Infinity Pool',
    images: {
      hero: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
    }
  },
  {
    id: 'viridian-jolshiri-exclusivity',
    name: 'Viridian Jolshiri Verdant Heights',
    location: 'Sector 15, Jolshiri Abashon Smart City, Dhaka',
    price: '৳ 3,40,00,000',
    type: 'Luxury Apartment',
    propertyType: ['Luxury Apartment', 'Smart Home'],
    status: 'Under Construction',
    beds: 4,
    baths: 4,
    sqft: '3,250',
    exclusivity: '48% Green Canopy • Army Master Plan',
    images: {
      hero: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80'
    }
  },
  {
    id: 'banani-cascades-lakefront',
    name: 'Banani Cascades Lakefront Terraces',
    location: 'Road 11 Waterfront, Banani, Dhaka',
    price: '৳ 4,10,00,000',
    type: 'Smart Home',
    propertyType: ['Smart Home', 'Penthouse'],
    status: 'Ready',
    beds: 3,
    baths: 4,
    sqft: '2,950',
    exclusivity: 'Panoramic Lakefront • Double-Height Balconies',
    images: {
      hero: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    }
  },
  {
    id: 'oasis-towers-jolshiri',
    name: 'Oasis Sky Duplexes',
    location: 'Sector 3, Jolshiri Abashon, Dhaka',
    price: '৳ 2,90,00,000',
    type: 'Duplex',
    propertyType: ['Duplex', 'Luxury Apartment'],
    status: 'Under Construction',
    beds: 4,
    baths: 4,
    sqft: '3,100',
    exclusivity: 'Private Terrace Foyer • Golf Course View',
    images: {
      hero: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
    }
  },
  {
    id: 'baridhara-imperial-suite',
    name: 'Baridhara Diplomatic Haven',
    location: 'Baridhara Diplomatic Enclave, Dhaka',
    price: '৳ 8,80,00,000',
    type: 'Penthouse',
    propertyType: ['Penthouse', 'Villa'],
    status: 'Ready',
    beds: 5,
    baths: 6,
    sqft: '6,200',
    exclusivity: 'Ultra-High Security • Heated Jacuzzi',
    images: {
      hero: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
    }
  },
  {
    id: 'purbachal-green-villas',
    name: 'Purbachal Eco-Lake Residence',
    location: 'Sector 4, Purbachal Express Corridor, Dhaka',
    price: '৳ 3,75,00,000',
    type: 'Luxury Apartment',
    propertyType: ['Luxury Apartment', 'Villa'],
    status: 'Upcoming',
    beds: 4,
    baths: 4,
    sqft: '3,400',
    exclusivity: 'Zero Carbon Footprint • Botanical Gardens',
    images: {
      hero: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80'
    }
  }
];

export default function FeaturedResidences({ properties = [], loading = false, wishlist = [], toggleWishlist, onOpenVipModal }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  // Merge real properties or fallback to curated list if empty
  const allList = properties.length > 0 ? properties : CURATED_FALLBACK_RESIDENCES;

  const filteredProperties = allList.filter(item => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Ready') return item.status === 'Ready';
    if (activeFilter === 'Under Construction') return item.status === 'Under Construction' || item.status === 'Ongoing';
    if (activeFilter === 'Penthouse') {
      const typeStr = Array.isArray(item.propertyType) ? item.propertyType.join(' ') : (item.type || '');
      return typeStr.toLowerCase().includes('penthouse') || item.name.toLowerCase().includes('penthouse');
    }
    if (activeFilter === 'Smart Home') {
      const typeStr = Array.isArray(item.propertyType) ? item.propertyType.join(' ') : (item.type || '');
      return typeStr.toLowerCase().includes('smart') || (item.tags || []).includes('Smart');
    }
    return true;
  });

  return (
    <section className="pt-4 pb-24 bg-brand-neutral relative overflow-hidden">
      {/* Decorative Background Accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-2">
              <Sparkles size={14} className="text-brand-primary" />
              <span>The Viridian Portfolio</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight">
              Signature Architectural Landmarks
            </h2>
            <p className="text-sm sm:text-base text-brand-text/75 mt-2 max-w-2xl font-light">
              Each residence is a testament to biophilic design, elite engineering, and individual privacy. Explore our current portfolio across Dhaka's most prestigious enclaves.
            </p>
          </div>

          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-primary hover:text-brand-dark transition-colors self-start md:self-end pb-1 border-b-2 border-brand-primary"
          >
            <span>View Full Portfolio ({allList.length})</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {[
            { id: 'All', label: 'All Residences' },
            { id: 'Ready', label: 'Ready to Move' },
            { id: 'Under Construction', label: 'Under Construction' },
            { id: 'Penthouse', label: 'Penthouses & Duplexes' },
            { id: 'Smart Home', label: 'Smart Homes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`text-xs font-bold uppercase tracking-wider py-2 px-5 rounded-full whitespace-nowrap transition-all ${
                activeFilter === tab.id
                  ? 'bg-brand-dark text-brand-accent shadow-md'
                  : 'bg-white text-brand-text/80 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid of Residences */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-brand-primary gap-4">
            <Loader2 size={40} className="animate-spin" />
            <span className="text-xs uppercase tracking-widest font-bold">Curating Residences...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((project, idx) => {
              const isSaved = wishlist.some(p => p.id === project.id);
              const specs = formatPropertySpecs(project);
              const priceStr = formatPropertyPrice(project);
              const imageUrl = project.images?.hero || project.image || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80';

              const statusColor = 
                project.status === 'Ready' ? 'bg-emerald-700 text-white' :
                project.status === 'Under Construction' ? 'bg-amber-600 text-white' :
                'bg-brand-primary text-white';

              return (
                <motion.div
                  key={project.id || idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden group border border-gray-100 flex flex-col transform hover:-translate-y-1.5"
                >
                  {/* Image Container with Badges */}
                  <div 
                    onClick={() => navigate(`/property/${project.id}`)}
                    className="relative h-72 overflow-hidden cursor-pointer bg-brand-dark"
                  >
                    <img
                      src={imageUrl}
                      alt={project.name}
                      className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-out"
                    />

                    {/* Gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-transparent to-black/30" />

                    {/* Top Status & Exclusivity Badges */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm shadow-md ${statusColor}`}>
                        {project.status || 'Exclusive'}
                      </span>
                      {project.exclusivity && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-brand-dark/90 text-brand-accent backdrop-blur-md border border-brand-accent/20">
                          {project.exclusivity}
                        </span>
                      )}
                    </div>

                    {/* Wishlist Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(project);
                      }}
                      aria-label="Save to Wishlist"
                      className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-all hover:scale-110 ${
                        isSaved
                          ? 'bg-brand-primary text-white'
                          : 'bg-white/80 text-brand-dark hover:text-brand-primary hover:bg-white'
                      }`}
                    >
                      <Heart size={18} className={isSaved ? 'fill-current' : ''} />
                    </button>

                    {/* Bottom Price Pill within Image */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <div className="bg-brand-dark/90 backdrop-blur-md px-3 py-1.5 rounded border border-white/10">
                        <span className="text-[10px] uppercase tracking-wider text-brand-accent/80 block font-bold">
                          Acquisition Price
                        </span>
                        <span className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                          {priceStr}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/90 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded">
                        {Array.isArray(project.propertyType) ? project.propertyType[0] : (project.type || 'Residence')}
                      </div>
                    </div>
                  </div>

                  {/* Property Details */}
                  <div className="p-6 flex flex-col flex-grow justify-between">
                    <div>
                      <h3 
                        onClick={() => navigate(`/property/${project.id}`)}
                        className="text-xl sm:text-2xl font-serif text-brand-dark mb-1.5 group-hover:text-brand-primary transition-colors cursor-pointer line-clamp-1"
                      >
                        {project.name}
                      </h3>

                      <p className="text-xs text-brand-text/70 flex items-center gap-1.5 mb-5 font-medium line-clamp-1">
                        <MapPin size={14} className="text-brand-primary shrink-0" />
                        <span>{project.location}</span>
                      </p>

                      {/* Specs Row */}
                      <div className="grid grid-cols-3 gap-2 border-t border-b border-gray-100 py-3 mb-5 text-center text-brand-dark">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <BedDouble size={14} className="text-brand-primary" /> Beds
                          </span>
                          <span className="font-serif font-bold text-sm text-brand-dark mt-0.5">
                            {specs.beds || project.beds || '3-4'}
                          </span>
                        </div>

                        <div className="flex flex-col items-center border-x border-gray-100">
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <Bath size={14} className="text-brand-primary" /> Baths
                          </span>
                          <span className="font-serif font-bold text-sm text-brand-dark mt-0.5">
                            {specs.baths || project.baths || '4'}
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <Ruler size={14} className="text-brand-primary" /> Sq.Ft.
                          </span>
                          <span className="font-serif font-bold text-sm text-brand-dark mt-0.5">
                            {specs.sqft || project.sqft || '3,200'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => navigate(`/property/${project.id}`)}
                        className="flex-1 bg-brand-primary hover:bg-brand-dark text-white py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Explore</span>
                        <ArrowRight size={14} />
                      </button>

                      <button
                        onClick={() => onOpenVipModal(project.name)}
                        className="bg-brand-neutral hover:bg-brand-accent/20 text-brand-dark py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border border-brand-primary/20 hover:border-brand-primary transition-all"
                      >
                        VIP Inquire
                      </button>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Bottom Banner */}
        <div className="mt-16 bg-white rounded-2xl p-8 border border-brand-accent/30 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
              <ShieldCheck size={30} />
            </div>
            <div>
              <h4 className="font-serif text-xl text-brand-dark">Looking for a Bespoke Custom Penthouse or Land Ownership?</h4>
              <p className="text-xs sm:text-sm text-brand-text/70 mt-1">Our private acquisition team curates unlisted off-market penthouses and prime plots across Dhaka.</p>
            </div>
          </div>
          <button
            onClick={() => onOpenVipModal('Off-Market Bespoke Penthouse')}
            className="whitespace-nowrap bg-brand-dark hover:bg-brand-primary text-brand-accent hover:text-white px-6 py-3 rounded-lg text-xs uppercase tracking-widest font-bold transition-all shadow"
          >
            Request Private Dossier
          </button>
        </div>

      </div>
    </section>
  );
}
