import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, PlayCircle, ShieldCheck, MapPin, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  {
    id: 'jolshiri-oasis',
    badge: 'Flagship Biophilic Enclave',
    title: 'Homes Woven',
    titleHighlight: 'In Nature',
    subtitle: 'Viridian Jolshiri Exclusivity',
    location: 'Sector 15, Jolshiri Abashon, Dhaka',
    tagline: '48% Dedicated Ecological Sanctuary • 4 Master Suites • Private Sky Terraces',
    description: "Dhaka's definitive biophilic sanctuary, masterfully engineered within the Jolshiri master plan where lush living canopies seamlessly meet uncompromising luxury.",
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85',
    propertyId: 'the-sapphire-penthouse'
  },
  {
    id: 'sapphire-penthouse',
    badge: 'Single Residence Per Floor',
    title: 'The Pinnacle of',
    titleHighlight: 'Penthouse Living',
    subtitle: 'The Sapphire Penthouse',
    location: 'Road 83, Gulshan 2 Diplomatic Zone, Dhaka',
    tagline: '4,850 Sq.Ft. • Private Infinity Lap Pool • 3 Dedicated Basements',
    description: 'An elite vertical sanctuary featuring direct biometric elevator access into your private foyer, acoustic glass walls, and an expansive private rooftop lap pool.',
    image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2000&q=85',
    propertyId: 'the-sapphire-penthouse'
  },
  {
    id: 'banani-cascades',
    badge: 'Waterfront Architectural Masterpiece',
    title: 'Where Architecture',
    titleHighlight: 'Meets Water',
    subtitle: 'Banani Lakefront Terraces',
    location: 'Road 11 Waterfront, Banani, Dhaka',
    tagline: 'Panoramic Lake Vistas • Smart IoT Integration • Handover 2026',
    description: 'Harmonious waterfront living offering double-height living salons, European acoustic insulation, and serene panoramic lake vistas in the heart of Banani.',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=2000&q=85',
    propertyId: 'emerald-heights'
  }
];

export default function HeroShowcase({ onOpenVipModal }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const slide = HERO_SLIDES[current];

  return (
    <section 
      className="relative min-h-[85vh] lg:min-h-[90vh] flex items-center justify-center overflow-hidden bg-brand-dark"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Slides with AnimatePresence */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
            className="absolute inset-0"
          >
            <img
              src={slide.image}
              alt={slide.subtitle}
              className="w-full h-full object-cover object-center"
            />
            {/* Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/75 to-brand-dark/50" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-brand-dark/30 to-brand-dark/80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-primary/20 via-transparent to-brand-dark/60 mix-blend-multiply" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Decorative Gold Border Line at Top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-accent/40 to-transparent z-10" />

      {/* Left/Right Floating Carousel Navigation Arrows */}
      <button
        onClick={() => setCurrent((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
        aria-label="Previous Slide"
        className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-brand-dark/60 hover:bg-brand-primary text-white border border-white/20 items-center justify-center transition-all hover:scale-110 backdrop-blur-md shadow-2xl"
      >
        <ChevronLeft size={24} />
      </button>

      <button
        onClick={() => setCurrent((prev) => (prev + 1) % HERO_SLIDES.length)}
        aria-label="Next Slide"
        className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-brand-dark/60 hover:bg-brand-primary text-white border border-white/20 items-center justify-center transition-all hover:scale-110 backdrop-blur-md shadow-2xl"
      >
        <ChevronRight size={24} />
      </button>

      {/* Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-16 sm:pb-20 max-w-7xl">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Top Prestige Pill */}
          <motion.div
            key={`badge-${current}`}
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-dark/70 border border-brand-accent/40 backdrop-blur-md mb-6 shadow-xl"
          >
            <Sparkles size={14} className="text-brand-accent" />
            <span className="text-xs uppercase tracking-[0.25em] text-brand-accent font-bold">
              {slide.badge}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/60" />
            <span className="text-[11px] uppercase tracking-wider text-white/80 font-medium">
              RAJUK Approved
            </span>
          </motion.div>

          {/* Main Hero Headline */}
          <motion.h1
            key={`title-${current}`}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-white tracking-tight leading-[1.08] mb-6 drop-shadow-2xl"
          >
            {slide.title} <br className="hidden sm:inline" />
            <span className="italic font-normal bg-gradient-to-r from-brand-accent via-white to-brand-accent bg-clip-text text-transparent">
              {slide.titleHighlight}
            </span>
          </motion.h1>

          {/* Subtitle & Location */}
          <motion.div
            key={`sub-${current}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-brand-accent text-sm md:text-base font-medium mb-4"
          >
            <span className="tracking-widest uppercase font-bold text-xs sm:text-sm">
              {slide.subtitle}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/40 hidden sm:inline-block" />
            <span className="inline-flex items-center gap-1.5 text-white/90 text-xs sm:text-sm font-light">
              <MapPin size={15} className="text-brand-accent" />
              {slide.location}
            </span>
          </motion.div>

          {/* Narrative Body */}
          <motion.p
            key={`desc-${current}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base sm:text-lg md:text-xl text-brand-neutral/85 font-light max-w-2xl mx-auto leading-relaxed mb-8 drop-shadow text-pretty"
          >
            {slide.description}
          </motion.p>

          {/* Slide Indicator Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8">
            {HERO_SLIDES.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setCurrent(idx)}
                className={`flex items-center gap-2 py-1.5 px-3.5 rounded-full text-xs transition-all ${
                  idx === current
                    ? 'bg-brand-accent/25 text-brand-accent border border-brand-accent/60 backdrop-blur-md shadow-md'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                <span className="font-bold text-[10px] tracking-wider">0{idx + 1}</span>
                <span className="font-serif font-medium">{item.subtitle}</span>
              </button>
            ))}
          </div>

          {/* VIP Action Buttons */}
          <motion.div
            key={`cta-${current}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-12"
          >
            <Link
              to="/projects"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-primary/90 text-white px-8 py-4 rounded-lg font-bold text-sm uppercase tracking-widest shadow-2xl hover:shadow-brand-primary/40 hover:-translate-y-0.5 transition-all group border border-brand-accent/30"
            >
              <span>Explore Residences</span>
              <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform text-brand-accent" />
            </Link>

            <button
              onClick={() => onOpenVipModal(slide.subtitle)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-lg font-bold text-sm uppercase tracking-widest backdrop-blur-md border border-white/25 hover:border-brand-accent hover:-translate-y-0.5 transition-all shadow-xl"
            >
              <ShieldCheck size={18} className="text-brand-accent" />
              <span>Schedule Private Tour</span>
            </button>

            <Link
              to="/virtual-tour"
              className="inline-flex items-center gap-2 text-brand-accent hover:text-white text-xs uppercase tracking-widest font-bold py-2 px-3 rounded transition-colors group"
            >
              <PlayCircle size={18} className="text-brand-accent group-hover:scale-110 transition-transform" />
              <span>360° Virtual Walkthrough</span>
            </Link>
          </motion.div>

          {/* Hero Feature Ticker / Live Trust Metrics */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-6 border-t border-white/10"
          >
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 text-left">
              <div className="text-xs uppercase tracking-widest text-brand-accent/90 font-bold">Dedicated Green</div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">48% Canopy</div>
              <div className="text-[11px] text-white/60">Biophilic Jolshiri Plan</div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 text-left">
              <div className="text-xs uppercase tracking-widest text-brand-accent/90 font-bold">Portfolio Value</div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">৳ 350+ Cr</div>
              <div className="text-[11px] text-white/60">Managed & Developed</div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 text-left">
              <div className="text-xs uppercase tracking-widest text-brand-accent/90 font-bold">Exclusivity</div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">1 Per Floor</div>
              <div className="text-[11px] text-white/60">Private Foyer Vestibule</div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 text-left">
              <div className="text-xs uppercase tracking-widest text-brand-accent/90 font-bold">Delivery Record</div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">100% On-Time</div>
              <div className="text-[11px] text-white/60">Escrow & Legal Security</div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
