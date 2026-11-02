import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

const METRICS = [
  { value: '৳ 350+ Cr', label: 'Portfolio Pipeline', desc: 'Active high-value residences' },
  { value: '100%', label: 'On-Time Handover', desc: 'Zero milestone deviation' },
  { value: '48%', label: 'Green Space Footprint', desc: 'Ecological master plan dedication' },
  { value: '18+', label: 'Signature Landmarks', desc: 'Jolshiri, Gulshan & Banani' },
  { value: '500+', label: 'Discerning Families', desc: 'Living in bespoke sanctuaries' }
];

const ACCREDITATIONS = [
  {
    title: 'RAJUK Approved Master Builder',
    desc: 'Fully compliant with Dhaka Metropolitan Building Construction Acts and urban town planning codes.'
  },
  {
    title: 'REHAB Member in Good Standing',
    desc: 'Adhering to strict consumer protection codes and ethical real estate governance in Bangladesh.'
  },
  {
    title: 'BUET Structural Certification',
    desc: 'Comprehensive pile-integrity tests, seismic damping assessments, and concrete batch tests audited by BUET.'
  },
  {
    title: 'Jolshiri Army Master Plan Compliance',
    desc: 'Strategic residential alignment with Bangladesh Army ecological and high-security guidelines.'
  }
];

export default function InstitutionalProof() {
  return (
    <section className="py-24 bg-brand-dark text-white relative overflow-hidden">
      {/* Decorative radial gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        
        {/* Metric Counters Bar */}
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
              <div className="text-[11px] text-white/60 font-light">
                {m.desc}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Accreditations Section */}
        <div className="pt-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-[10px] uppercase tracking-[0.25em] text-brand-accent font-bold block mb-2">
              Corporate Governance & Trust
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
                  <span>Audited & Certified</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
