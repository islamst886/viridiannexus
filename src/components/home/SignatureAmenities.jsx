import React from 'react';
import { motion } from 'framer-motion';
import { 
  Waves, Dumbbell, ShieldCheck, ArrowUpCircle, 
  BatteryCharging, Baby, Briefcase, Zap, Sparkles 
} from 'lucide-react';

const AMENITIES = [
  {
    icon: Waves,
    title: 'Rooftop Infinity Lap Pools',
    category: 'Aquatics & Wellness',
    desc: 'Heated rooftop infinity pool and sunken jacuzzi lounge overlooking Dhaka’s skyline and the lush Jolshiri lake canopy.'
  },
  {
    icon: Dumbbell,
    title: 'Technogym Fitness Atelier',
    category: 'Athletics & Vitality',
    desc: 'State-of-the-art Italian Technogym cardio and strength equipment with panoramic views and dedicated private personal training.'
  },
  {
    icon: ShieldCheck,
    title: '3-Tier Biometric Security',
    category: 'Safety & Discretion',
    desc: 'Facial recognition access, 24/7 CCTV surveillance, smart license-plate readers, and continuous trained physical security command.'
  },
  {
    icon: ArrowUpCircle,
    title: 'Dual High-Speed Private Elevators',
    category: 'Exclusivity & Transit',
    desc: 'Mitsubishi high-speed elevators featuring touchless biometric call systems opening directly into private residence foyers.'
  },
  {
    icon: BatteryCharging,
    title: 'Dedicated Rapid EV Charging',
    category: 'Clean Mobility',
    desc: 'Private high-voltage EV rapid-charging stations at every basement parking bay supporting Tesla, Porsche, and Audi e-tron.'
  },
  {
    icon: Baby,
    title: 'Montessori Play Sanctuary',
    category: 'Family & Children',
    desc: 'Secure, non-toxic outdoor and indoor children’s exploratory zones surrounded by lush shaded landscape architecture.'
  },
  {
    icon: Briefcase,
    title: 'Executive Business Boardroom',
    category: 'Private Office',
    desc: 'Private soundproof conference suite equipped with high-speed satellite mesh WiFi and 4K video conferencing facilities.'
  },
  {
    icon: Zap,
    title: '100% Synchronous Standby Power',
    category: 'Uninterrupted Life',
    desc: 'Heavy-duty European Cummins sound-attenuated generators providing 100% full-capacity load support including all multi-split air conditioners.'
  }
];

export default function SignatureAmenities() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-3">
            <Sparkles size={14} className="text-brand-primary" />
            <span>Curated Privileges</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-serif text-brand-dark tracking-tight mb-4">
            Five-Star Residential Comforts
          </h2>
          <p className="text-sm sm:text-base text-brand-text/75 font-light leading-relaxed">
            Every Viridian Nexus residence is thoughtfully complemented by a collection of resort-grade wellness, fitness, and security facilities crafted for effortless living.
          </p>
        </div>

        {/* 8-Grid Amenities */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {AMENITIES.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className="group p-6 rounded-2xl bg-brand-neutral/60 border border-gray-100 hover:border-brand-primary/30 transition-all duration-300 hover:shadow-xl hover:bg-white flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors flex items-center justify-center mb-5 shadow-sm">
                  <item.icon size={24} />
                </div>
                
                <span className="text-[10px] uppercase tracking-widest text-brand-primary font-bold block mb-1">
                  {item.category}
                </span>

                <h3 className="font-serif font-bold text-lg text-brand-dark mb-2.5 group-hover:text-brand-primary transition-colors">
                  {item.title}
                </h3>

                <p className="text-xs text-brand-text/70 leading-relaxed font-light">
                  {item.desc}
                </p>
              </div>

              <div className="w-8 h-[2px] bg-brand-accent group-hover:w-full transition-all duration-500 mt-6" />
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}

