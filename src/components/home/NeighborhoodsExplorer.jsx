import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NEIGHBORHOODS = [
  {
    id: 'jolshiri',
    name: 'Jolshiri Abashon Smart City',
    tagline: 'The Green Master Plan by Bangladesh Army',
    highlights: ['48% Dedicated Green Spaces', '205-Acre Central Lake', '15 Min to Airport via Madani Ave'],
    description: "Dhaka's most visionary planned township. Featuring wide boulevards, international-standard golf courses, and an uncompromised ecological commitment.",
    image: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=80',
    queryLocation: 'Jolshiri',
    badge: 'Flagship Enclave'
  },
  {
    id: 'gulshan',
    name: 'Gulshan 2 Diplomatic Heartland',
    tagline: 'Dhaka’s Epicenter of Prestige & Global Embassies',
    highlights: ['Highest Security Tier', 'Walking to Lake Park & Private Clubs', 'Fine Dining Corridor'],
    description: 'The historic seat of elite Dhaka living. Unrivaled security, manicured lakeside parks, private member clubs, and prominent foreign embassies.',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
    queryLocation: 'Gulshan',
    badge: 'Ultra-Prime'
  },
  {
    id: 'banani',
    name: 'Banani Lakefront Boulevard',
    tagline: 'Cosmopolitan Vibrancy & Calming Waters',
    highlights: ['Direct Lakeside Terraces', 'Boutique Lifestyle & Cafes', 'Rapid Access to Baridhara'],
    description: 'Where cosmopolitan design meets serene waterfront promenades. Ideal for families and executives seeking seamless connectivity with leisure.',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
    queryLocation: 'Banani',
    badge: 'Waterfront'
  },
  {
    id: 'purbachal',
    name: 'Purbachal Expressway Corridor',
    tagline: 'The Future 300-Ft Megacity Gateway',
    highlights: ['300-Ft Iconic Expressway', 'Direct Eastern Bypass Access', 'High Capital Appreciation'],
    description: 'The expansive modern corridor linking the diplomatic district to the upcoming international trade and financial developments.',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
    queryLocation: 'Purbachal',
    badge: 'High-Yield'
  }
];

export default function NeighborhoodsExplorer() {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-brand-neutral relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-3">
            <Compass size={14} className="text-brand-primary" />
            <span>Strategic Geography</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight mb-4">
            Dhaka's Most Coveted Micro-Markets
          </h2>
          <p className="text-sm sm:text-base text-brand-text/75 font-light leading-relaxed">
            Every Viridian Nexus development is strategically situated in high-security, high-growth enclaves designed for superior quality of life and long-term capital preservation.
          </p>
        </div>

        {/* 4 Enclave Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {NEIGHBORHOODS.map((enclave, idx) => (
            <motion.div
              key={enclave.id}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="group relative rounded-2xl overflow-hidden shadow-xl bg-brand-dark min-h-[380px] flex flex-col justify-end p-8 border border-white/10"
            >
              {/* Background Image */}
              <img
                src={enclave.image}
                alt={enclave.name}
                className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-out"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/75 to-brand-dark/20 group-hover:via-brand-dark/80 transition-colors" />

              {/* Top Badge */}
              <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
                <span className="bg-brand-accent text-brand-dark text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm shadow-md">
                  {enclave.badge}
                </span>
              </div>

              {/* Content */}
              <div className="relative z-10 text-white">
                <span className="text-xs uppercase tracking-widest text-brand-accent font-bold block mb-1">
                  {enclave.tagline}
                </span>

                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-3 group-hover:text-brand-accent transition-colors">
                  {enclave.name}
                </h3>

                <p className="text-xs sm:text-sm text-brand-neutral/80 font-light mb-6 line-clamp-2 leading-relaxed">
                  {enclave.description}
                </p>

                {/* Highlights */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {enclave.highlights.map((h, i) => (
                    <span 
                      key={i} 
                      className="bg-white/10 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded border border-white/15 font-medium"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Card Action */}
                <div className="flex items-center justify-between pt-4 border-t border-white/15">
                  <button
                    onClick={() => navigate(`/projects?location=${encodeURIComponent(enclave.queryLocation)}`)}
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-accent hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Explore Enclave Residences</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
