import { motion } from 'framer-motion';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

export default function Project() {
  return (
    <div className="w-full bg-brand-neutral pb-24">
      {/* Header */}
      <div className="bg-brand-dark pt-32 pb-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-serif text-brand-accent mb-6">Architectural & Lifestyle Specifications</h1>
        <p className="text-xl text-brand-neutral max-w-3xl mx-auto opacity-90">
          An open-concept 2,860 sq. ft. layout designed for absolute privacy, featuring a dedicated study, service entry, and sprawling master suites.
        </p>
      </div>

      {/* Amenities Matrix */}
      <div className="container mx-auto px-4 -mt-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Smart Home Integration",
              items: ["Automated Climate Control", "Ambient Lighting Presets", "Biometric Security Systems", "Remote Access Control"]
            },
            {
              title: "Recreation & Wellness",
              items: ["Rooftop Infinity Swimming Pool", "Fully Equipped Gymnasium", "Cedar Wood Sauna", "Grand Community Hall"]
            },
            {
              title: "Core Infrastructure",
              items: ["Full Power Backup (Generators)", "Advanced Fire-Fighting Systems", "9 Dedicated Parking Spaces", "High-Speed Elevators"]
            }
          ].map((pillar, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white shadow-xl p-8 border-t-4 border-brand-primary"
            >
              <h3 className="text-2xl font-serif text-brand-dark mb-6">{pillar.title}</h3>
              <ul className="space-y-4">
                {pillar.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="text-brand-primary shrink-0" size={24} />
                    <span className="text-brand-text font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Structural Integrity - BNBC 2020 */}
      <div className="container mx-auto px-4 mt-32 max-w-5xl">
        <div className="bg-brand-primary text-brand-neutral p-10 md:p-16 border-l-8 border-brand-accent relative overflow-hidden">
          <ShieldAlert size={120} className="absolute -right-10 -bottom-10 opacity-10" />
          <h2 className="text-3xl md:text-5xl font-serif mb-8 text-brand-accent">Structural Integrity & BNBC 2020</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="mb-6 leading-relaxed">
                Dhaka lies in Seismic Zone 2 with a basic seismic coefficient (Z) of 0.20 according to the Bangladesh National Building Code (BNBC) 2020. We treat structural safety not as a feature, but as our primary mandate.
              </p>
              <p className="leading-relaxed">
                Our foundation is backed by extensive soil testing and geotechnical engineering. We invite elite buyers and their consulting structural engineers to review our compliance data.
              </p>
            </div>
            <div className="bg-brand-dark/20 p-6 rounded-sm">
              <h4 className="text-xl font-serif text-brand-accent mb-4">Engineering Specifications</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-accent rounded-full"></div> RC Shear Wall System</li>
                <li className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-accent rounded-full"></div> High-Yield Strength Rebar</li>
                <li className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-accent rounded-full"></div> Mathematical Optimization for Seismic Resistance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
