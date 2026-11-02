import React from 'react';
import { motion } from 'framer-motion';
import { Globe, FileSignature, DollarSign, Video, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const NRB_PILLARS = [
  {
    icon: Globe,
    title: 'The NITA Banking Framework',
    desc: 'Remit foreign currency through authorized banking channels. Legal inward remittance fully guarantees future repatriation of capital gains, profits, and rental proceeds abroad.'
  },
  {
    icon: FileSignature,
    title: 'Remote Legal POA Execution',
    desc: 'Execute Power of Attorney (POA) attested at the Bangladesh Embassy or High Commission in London, New York, Toronto, or Sydney—complete registration without flying to Dhaka.'
  },
  {
    icon: DollarSign,
    title: 'Guaranteed Rental & Asset Care',
    desc: 'Turnkey interior furnishing, tenant curation for multinational diplomats, and secure monthly rental transfers directly into your international account.'
  },
  {
    icon: Video,
    title: 'Global Time-Zone Concierge',
    desc: 'Tailored 1-on-1 private video presentations across EST, PST, GMT, and AEST time zones with full legal and architectural walkthroughs.'
  }
];

export default function NrbGateway({ onOpenVipModal }) {
  return (
    <section className="py-24 bg-gradient-to-b from-brand-dark via-brand-dark to-[#011c16] text-white relative overflow-hidden">
      {/* Background World Map Vector Grid */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F7E7CE_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-accent mb-3">
            <Sparkles size={14} className="text-brand-accent" />
            <span>International Investor Gateway</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif text-white tracking-tight mb-4">
            Bespoke Real Estate Advisory For Global NRBs
          </h2>
          <p className="text-sm sm:text-base text-brand-neutral/80 font-light leading-relaxed">
            Bridging international capital with Bangladesh's highest-appreciating luxury real estate. Fully compliant with Bangladesh Bank guidelines, NITA accounts, and embassy-attested documentation.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {NRB_PILLARS.map((p, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-brand-accent/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-brand-primary/20 text-brand-accent flex items-center justify-center mb-5">
                  <p.icon size={24} />
                </div>
                <h3 className="font-serif font-bold text-xl text-white mb-2">{p.title}</h3>
                <p className="text-xs text-white/70 leading-relaxed font-light">{p.desc}</p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-brand-accent font-bold uppercase tracking-wider">
                <ShieldCheck size={14} />
                <span>Fully Vetted Protocol</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Banner with Actions */}
        <div className="bg-brand-primary/40 rounded-2xl p-8 border border-brand-accent/30 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h4 className="font-serif text-2xl text-brand-accent mb-2">Connect With Our Overseas Client Desk</h4>
            <p className="text-xs sm:text-sm text-brand-neutral/85 font-light max-w-2xl">
              Receive our comprehensive NRB Investment Dossier, NITA opening procedure checklist, and tax exemption frameworks for foreign inward remittance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => onOpenVipModal('NRB Virtual Advisory Desk')}
              className="bg-brand-accent text-brand-dark hover:bg-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-lg"
            >
              Book Overseas Video Session
            </button>
            <Link
              to="/nrb"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white hover:text-brand-accent transition-colors"
            >
              <span>Explore NRB Guide</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}

