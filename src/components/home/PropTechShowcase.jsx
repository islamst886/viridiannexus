import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, Video, Layers, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PropTechShowcase() {
  return (
    <section className="py-24 bg-brand-dark text-brand-neutral relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-accent mb-3">
            <Sparkles size={14} className="text-brand-accent" />
            <span>Digital Innovation & Remote Transparency</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif text-white tracking-tight mb-4">
            Experience Your Sanctuary In Real-Time
          </h2>
          <p className="text-sm sm:text-base text-brand-neutral/80 font-light leading-relaxed">
            Whether residing in Dhaka, London, or New York, our proprietary PropTech suite provides 100% live visibility into your architectural investment.
          </p>
        </div>

        {/* 3 Showcase Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          
          {/* Card 1: 360 VR Tour */}
          <Link
            to="/virtual-tour"
            className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-brand-accent/40 transition-all duration-500 flex flex-col justify-between p-6 sm:p-8 hover:-translate-y-1.5 shadow-xl hover:shadow-2xl"
          >
            <div className="relative h-48 rounded-xl overflow-hidden mb-6 bg-brand-neutral/10">
              <img
                src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80"
                alt="360 Virtual Tour"
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-brand-dark/50 group-hover:bg-brand-dark/30 transition-colors flex items-center justify-center">
                <PlayCircle size={56} className="text-brand-accent opacity-90 group-hover:scale-110 transition-all drop-shadow-lg" />
              </div>
              <div className="absolute top-3 right-3 bg-brand-accent text-brand-dark text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">
                Interactive 3D
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-brand-accent font-bold block mb-1">
                Virtual Spatial Immersion
              </span>
              <h3 className="text-2xl font-serif font-bold text-white mb-2 group-hover:text-brand-accent transition-colors">
                360° Virtual Walkthroughs
              </h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light mb-6">
                Tour our signature duplexes and penthouses room-by-room. Inspect material finishes, natural lighting, and spatial layouts with full VR headset compatibility.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand-accent">
              <span>Launch Virtual Tour</span>
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Live Construction Cameras */}
          <Link
            to="/live-cameras"
            className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-brand-accent/40 transition-all duration-500 flex flex-col justify-between p-6 sm:p-8 hover:-translate-y-1.5 shadow-xl hover:shadow-2xl"
          >
            <div className="relative h-48 rounded-xl overflow-hidden mb-6 bg-brand-neutral/10">
              <img
                src="https://images.unsplash.com/photo-1541888087525-cebfd64c2924?auto=format&fit=crop&w=800&q=80"
                alt="Live Construction Telemetry"
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-brand-dark/40 group-hover:bg-brand-dark/20 transition-colors" />
              
              {/* Pulsing Live Beacon */}
              <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>24/7 Site Telemetry</span>
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <Video size={56} className="text-brand-accent opacity-90 group-hover:scale-110 transition-all drop-shadow-lg" />
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-brand-accent font-bold block mb-1">
                Zero-Hassle Overseeing
              </span>
              <h3 className="text-2xl font-serif font-bold text-white mb-2 group-hover:text-brand-accent transition-colors">
                Live Construction Feeds
              </h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light mb-6">
                Watch your investment take shape floor-by-floor. High-definition site camera feeds accessible anytime for total peace of mind for local and NRB owners.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand-accent">
              <span>View Live Cameras</span>
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Milestone Stage-Gates */}
          <Link
            to="/progress"
            className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-brand-accent/40 transition-all duration-500 flex flex-col justify-between p-6 sm:p-8 hover:-translate-y-1.5 shadow-xl hover:shadow-2xl"
          >
            <div className="relative h-48 rounded-xl overflow-hidden mb-6 bg-brand-neutral/10">
              <img
                src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80"
                alt="Milestone Progress Tracker"
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-brand-dark/40 group-hover:bg-brand-dark/20 transition-colors" />

              <div className="absolute top-3 right-3 bg-brand-primary text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">
                Real-Time Audits
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <Layers size={56} className="text-brand-accent opacity-90 group-hover:scale-110 transition-all drop-shadow-lg" />
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-brand-accent font-bold block mb-1">
                Engineering Governance
              </span>
              <h3 className="text-2xl font-serif font-bold text-white mb-2 group-hover:text-brand-accent transition-colors">
                Milestone Progress Logs
              </h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light mb-6">
                Audited stage gates from piling to concrete pouring, electrical installations, and final handover with official engineering quality sign-offs.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand-accent">
              <span>Inspect Construction Logs</span>
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>

      </div>
    </section>
  );
}
