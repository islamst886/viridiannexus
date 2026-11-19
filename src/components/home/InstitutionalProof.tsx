import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MetricItem {
  value: string;
  label: string;
  desc: string;
}

interface AccreditationItem {
  title: string;
  desc: string;
}

const METRICS: MetricItem[] = [
  { value: '৳ 30+ Cr', label: 'Portfolio Pipeline', desc: 'Active high-value residences' },
  { value: '100%', label: 'On-Time Handover', desc: 'Zero milestone deviation' },
  { value: '48%', label: 'Green Space Footprint', desc: 'Ecological master plan dedication' },
  { value: '18+', label: 'Signature Landmarks', desc: 'Jolshiri, Gulshan & Banani' },
  { value: '500+', label: 'Discerning Families', desc: 'Living in bespoke sanctuaries' },
];

const ACCREDITATIONS: AccreditationItem[] = [
  {
    title: 'RAJUK Enlisted Developer',
    desc: 'Officially enlisted with Rajdhani Unnayan Kartripakkha (RAJUK) in strict compliance with statutory corporate developer registration.',
  },
  {
    title: 'Cantt. Board Enlisted',
    desc: 'Officially enlisted with the Cantonment Board (Cantt. Board), upholding disciplined civic, regulatory, and engineering protocols.',
  },
  {
    title: 'Bangladesh Army Approved',
    desc: 'Sanctioned and governed under Bangladesh Army planning, security, and developmental oversight across master-planned enclaves.',
  },
  {
    title: 'BNBC 2020 & Structural Integrity',
    desc: 'Comprehensive BUET-audited concrete and pile-integrity tests with strict adherence to Bangladesh National Building Code standards.',
  },
];

export default function InstitutionalProof() {
  return (
    <section className="py-24 bg-brand-dark text-white relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pb-20 border-b border-white/10 text-center">
          {METRICS.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="p-4"
            >
              <div className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-brand-accent mb-2">
                {m.value}
              </div>
              <div className="text-xs uppercase tracking-widest font-bold text-white mb-1">
                {m.label}
              </div>
              <div className="text-[11px] text-white/60 font-light">{m.desc}</div>
            </motion.div>
          ))}
        </div>

        <div className="pt-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-[10px] uppercase tracking-[0.25em] text-brand-accent font-bold block mb-2">
              Corporate Governance &amp; Trust
            </span>
            <h3 className="font-serif text-3xl sm:text-4xl text-white">
              Uncompromising Regulatory Standards
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ACCREDITATIONS.map((acc, idx) => (
              <div
                key={idx}
                className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:border-brand-accent/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-brand-primary/20 text-brand-accent flex items-center justify-center mb-4">
                    <ShieldCheck size={20} />
                  </div>
                  <h4 className="font-serif font-bold text-lg text-white mb-2">{acc.title}</h4>
                  <p className="text-xs text-white/70 leading-relaxed font-light">{acc.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-brand-accent uppercase font-bold tracking-wider">
                  <CheckCircle2 size={13} />
                  <span>Audited &amp; Certified</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/leadership"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-brand-dark border border-brand-accent/35 text-xs font-bold uppercase tracking-widest transition-all"
            >
              <span>Executive Message &amp; Leadership Profile</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
