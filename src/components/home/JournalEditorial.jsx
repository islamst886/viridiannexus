import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Sparkles } from 'lucide-react';
import { JOURNAL_ARTICLES } from '../../data/journalArticles';

export default function JournalEditorial() {
  return (
    <section className="py-24 bg-white relative overflow-hidden border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-3">
              <Sparkles size={14} className="text-brand-primary" />
              <span>Thought Leadership & Insights</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight">
              The Viridian Journal
            </h2>
            <p className="text-sm sm:text-base text-brand-text/75 mt-2 max-w-2xl font-light">
              Essays on architectural innovation, urban master planning, and real estate investment intelligence in Bangladesh.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-primary/80 self-start md:self-end pb-1 border-b border-brand-primary/30">
            <span>Quarterly Research Edition</span>
          </div>
        </div>

        {/* 3 Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {JOURNAL_ARTICLES.map((art, idx) => (
            <motion.div
              key={art.slug || idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group flex flex-col justify-between bg-brand-neutral/40 rounded-2xl overflow-hidden border border-gray-100 hover:border-brand-primary/20 hover:shadow-lg transition-all duration-300"
            >
              <div>
                {/* Image Container (Display Only) */}
                <div className="relative h-56 overflow-hidden bg-brand-dark">
                  <img
                    src={art.heroImage}
                    alt={art.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 left-4 bg-brand-dark/90 text-brand-accent text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded">
                    {art.category}
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-6">
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3 font-medium">
                    <span>{art.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {art.readTime}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-xl text-brand-dark mb-3 leading-snug">
                    {art.title}
                  </h3>

                  <p className="text-xs text-brand-text/70 font-light leading-relaxed mb-4 line-clamp-3">
                    {art.summary}
                  </p>
                </div>
              </div>

              {/* Action Button (Disabled) */}
              <div className="px-6 pb-6 pt-2">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 cursor-not-allowed"
                >
                  <span>Read Full Publication</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-semibold tracking-normal uppercase">
                    Coming Soon
                  </span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
