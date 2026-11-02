import React from 'react';
import { motion } from 'framer-motion';
import { Star, Sparkles } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Barrister Rafiqul Islam',
    role: 'Corporate Counsel & Senior Advocate',
    residence: 'Owner, The Sapphire Penthouse, Gulshan 2',
    quote: 'The level of craftsmanship is extraordinary. What sets Viridian Nexus apart from other developers in Bangladesh is their uncompromising commitment to acoustic isolation and materials. The after-sales concierge service is truly international standard.',
    rating: 5,
    tag: 'Verified Homeowner'
  },
  {
    name: 'Dr. Samina Chowdhury',
    role: 'Cardiothoracic Consultant, Evercare Hospital',
    residence: 'Resident, Viridian Jolshiri Verdant Heights',
    quote: 'Coming home to Jolshiri feels like an immediate escape into an ecological sanctuary. The 48% green space is not a marketing gimmick; the air quality, lake breezes, and silence inside the apartment provide immense peace for my family after long hospital shifts.',
    rating: 5,
    tag: 'Verified Homeowner'
  },
  {
    name: 'Tariq Al-Mansoor',
    role: 'NRB Tech Executive, Silicon Valley & London',
    residence: 'Investor, Banani Cascades & Jolshiri Sky Villa',
    quote: 'As an NRB living 8,000 miles away, investing in Dhaka was previously daunting. Viridian Nexus made the entire process effortless via NITA banking channels, remote embassy-attested POA, and their 24/7 live construction feeds. Complete financial and legal transparency.',
    rating: 5,
    tag: 'NRB Investor'
  }
];

export default function ClientTestimonials() {

  return (
    <section className="py-24 bg-brand-neutral relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-3">
            <Sparkles size={14} className="text-brand-primary" />
            <span>The Discerning Circle</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight mb-4">
            Endorsements From Our Residents
          </h2>
          <p className="text-sm sm:text-base text-brand-text/75 font-light leading-relaxed">
            From prominent corporate leaders and medical specialists to expatriate investors, discover why our clients trust Viridian Nexus with their most treasured living spaces.
          </p>
        </div>

        {/* 3 Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {TESTIMONIALS.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* 5 Stars */}
                <div className="flex items-center gap-1 text-amber-500 mb-6">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                  <span className="ml-2 text-xs font-bold text-brand-dark">5.0</span>
                </div>

                {/* Quote Text */}
                <p className="text-brand-text/80 italic text-sm leading-relaxed mb-6 font-light">
                  "{t.quote}"
                </p>
              </div>

              {/* Author & Residence */}
              <div className="pt-6 border-t border-gray-100 flex items-start justify-between">
                <div>
                  <h4 className="font-serif font-bold text-brand-dark text-base">{t.name}</h4>
                  <p className="text-xs text-brand-primary font-medium mt-0.5">{t.role}</p>
                  <p className="text-[11px] text-gray-500 mt-1 font-light">{t.residence}</p>
                </div>

                <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded shrink-0">
                  {t.tag}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
