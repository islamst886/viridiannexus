import React from 'react';
import { Phone, Mail, MapPin, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import WhatsAppIcon from '../WhatsAppIcon';

export default function HomeCta({ onOpenVipModal }) {
  return (
    <section className="py-28 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-dark text-white relative overflow-hidden">
      {/* Background Architectural Overlay */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-10 mix-blend-luminosity pointer-events-none" />

      {/* Decorative Gold Radial Glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10 text-center">
        
        {/* Top Prestige Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-brand-accent/30 backdrop-blur-md mb-6 shadow-xl">
          <Sparkles size={14} className="text-brand-accent" />
          <span className="text-xs uppercase tracking-[0.25em] text-brand-accent font-bold">
            Private Client Services
          </span>
        </div>

        {/* Grand Headline */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-serif text-white tracking-tight mb-6 leading-tight drop-shadow-md">
          Crafting Your Legacy <br />
          <span className="italic font-normal bg-gradient-to-r from-brand-accent via-white to-brand-accent bg-clip-text text-transparent">
            In Nature's Embrace
          </span>
        </h2>

        <p className="text-base sm:text-xl text-brand-neutral/90 font-light max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow">
          Acquire a home of quiet distinction in Jolshiri, Gulshan, or Banani. Connect with our dedicated advisory team for confidential dossiers and private site viewings.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <button
            onClick={() => onOpenVipModal('Corporate Private Client Advisory')}
            className="w-full sm:w-auto bg-brand-accent hover:bg-white text-brand-dark px-8 py-4 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-2xl hover:scale-105"
          >
            Schedule VIP Site Tour
          </button>

          <Link
            to="/projects"
            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-lg font-bold text-xs uppercase tracking-widest backdrop-blur-md border border-white/30 transition-all hover:scale-105"
          >
            Explore All Residences
          </Link>

          <a
            href="https://wa.me/8801700000000"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white px-6 py-4 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-lg hover:scale-105"
          >
            <WhatsAppIcon className="w-4 h-4 fill-current" />
            <span>Instant Concierge</span>
          </a>
        </div>

        {/* Micro contact credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-10 border-t border-white/15 text-xs text-white/80 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2">
            <Phone size={14} className="text-brand-accent" />
            <span>Direct Advisory: +880 1700-000000</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Mail size={14} className="text-brand-accent" />
            <span>concierge@viridiannexus.com</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <MapPin size={14} className="text-brand-accent" />
            <span>Gulshan & Jolshiri Ateliers</span>
          </div>
        </div>

      </div>
    </section>
  );
}
