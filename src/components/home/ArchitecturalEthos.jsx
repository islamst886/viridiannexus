import React from 'react';
import { Trees, VolumeX, Shield, Award, Sparkles, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const HALLMARKS = [
  {
    icon: Trees,
    title: 'Biophilic Living Canopies',
    desc: 'Integrated botanical facades and lush rooftop sky forests that naturally filter urban air and reduce ambient temperature by up to 3.5°C.'
  },
  {
    icon: VolumeX,
    title: 'Acoustic Sanctuary Engineering',
    desc: 'Saint-Gobain double-glazed Low-E acoustic curtain walls ensuring whisper-quiet interior solitude (<35 dB) amidst the vibrant capital.'
  },
  {
    icon: Shield,
    title: 'Single-Unit Floor Sanctum',
    desc: 'Zero shared walls, private biometric elevator vestibules, and 360-degree panoramic daylight and cross-ventilation.'
  },
  {
    icon: Award,
    title: 'BUET-Tested Structural Integrity',
    desc: 'Engineered with Grade 72.5 reinforced steel, deep cast-in-situ pilings, and full Zone-3 seismic compliance exceeding national standards.'
  }
];

export default function ArchitecturalEthos() {
  return (
    <section className="py-24 bg-white relative overflow-hidden border-t border-b border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Narrative & Hallmarks */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-3">
              <Sparkles size={14} className="text-brand-primary" />
              <span>The Viridian Distinction</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight leading-[1.15] mb-6">
              Where Biophilic Sanctuary <br className="hidden sm:inline" />
              <span className="italic text-brand-primary font-normal">Meets Precision Engineering</span>
            </h2>

            <p className="text-base sm:text-lg text-brand-text/80 leading-relaxed font-light mb-8">
              At Viridian Nexus, we challenge Dhaka's conventional high-density concrete developments. Guided by the philosophy of <em>"Homes Woven In Nature,"</em> every residence is envisioned as an ecological oasis—where clean geometry, organic timber, and cascading vertical vegetation coalesce with military-grade structural resilience.
            </p>

            {/* Hallmarks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
              {HALLMARKS.map((h, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-brand-neutral/50 border border-brand-primary/10 hover:border-brand-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                    <h.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-brand-dark mb-1">{h.title}</h3>
                    <p className="text-xs text-brand-text/70 leading-relaxed">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Credential Checkmarks */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-brand-dark/80 font-medium pt-4 border-t border-gray-100">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-brand-primary" />
                <span>100% Freehold Cleared Land Titles</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-brand-primary" />
                <span>RAJUK Approved Structural Master Plan</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-brand-primary" />
                <span>LEED Certified Sustainability Standard</span>
              </span>
            </div>
          </div>

          {/* Right Column: Visual Architecture Composition */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-brand-neutral">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80"
                alt="Viridian Biophilic Architecture"
                className="w-full h-[520px] object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent" />

              {/* Floating Architectural Callouts */}
              <div className="absolute top-6 right-6 bg-brand-dark/80 backdrop-blur-md px-3.5 py-2 rounded-lg border border-brand-accent/30 text-right">
                <div className="text-[10px] uppercase tracking-widest text-brand-accent font-bold">Clear Ceiling Height</div>
                <div className="text-lg font-serif font-bold text-white">11.5 Feet</div>
              </div>

              <div className="absolute bottom-6 left-6 right-6 bg-brand-dark/90 backdrop-blur-md p-6 rounded-xl border border-brand-accent/20 text-white">
                <p className="text-xs sm:text-sm italic font-serif text-brand-neutral/90 leading-relaxed mb-4">
                  "We do not merely erect buildings; we curate enduring sanctuaries where raw structural discipline seamlessly yields to living greenery."
                </p>
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <div>
                    <div className="text-xs font-bold text-brand-accent uppercase tracking-wider">Chief Architectural Counsel</div>
                    <div className="text-[11px] text-white/60">Viridian Nexus Design Atelier</div>
                  </div>
                  <Link
                    to="/legal"
                    className="text-[11px] text-brand-accent hover:underline uppercase font-bold tracking-wider"
                  >
                    View Approvals &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Small decorative backdrop card */}
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-brand-accent/20 rounded-2xl -z-10 blur-xl" />
          </div>

        </div>

      </div>
    </section>
  );
}
