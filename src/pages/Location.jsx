import { motion } from 'framer-motion';
import { Leaf, Navigation, Map } from 'lucide-react';

export default function Location() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="bg-brand-dark py-24 text-center px-4">
        <h1 className="text-4xl md:text-6xl font-serif text-brand-accent mb-6">The Jolshiri Abashon Smart City</h1>
        <p className="text-xl text-brand-neutral max-w-3xl mx-auto">
          Not merely an isolated apartment, but a holistic lifestyle secured within the visionary master plan of the Bangladesh Army.
        </p>
      </section>

      <section className="py-24 bg-brand-neutral">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-serif text-brand-dark mb-8">Green Urbanism</h2>
              <div className="space-y-6 text-lg text-brand-text">
                <p>
                  We present a stark, refreshing contrast to the concrete density of mainstream Dhaka. Jolshiri features an unparalleled <span className="font-bold text-brand-primary">48% land dedication to open, ecological spaces</span>.
                </p>
                <ul className="space-y-4 mt-6">
                  <li className="flex items-center gap-3">
                    <Leaf className="text-brand-primary" /> 205-Acre Central Lake & Walkways
                  </li>
                  <li className="flex items-center gap-3">
                    <Leaf className="text-brand-primary" /> International-Standard Golf Course
                  </li>
                  <li className="flex items-center gap-3">
                    <Leaf className="text-brand-primary" /> Expansive Jolshiri Central Park
                  </li>
                </ul>
              </div>
            </div>
            <div className="relative h-[400px] bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <img 
                src="https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=800&q=80" 
                alt="Green Urbanism" 
                className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-multiply" 
              />
              <div className="relative z-10 text-center">
                 <h3 className="text-2xl font-serif text-brand-dark bg-white/90 p-4 inline-block">48% Green Space</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white border-t border-brand-primary/10">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <Navigation size={48} className="mx-auto mb-6 text-brand-primary" />
          <h2 className="text-3xl md:text-5xl font-serif text-brand-dark mb-8">Strategic Connectivity</h2>
          <p className="text-lg text-brand-text mb-12">
            Situated at the center of the eastern fringe of the Dhaka Metropolitan Development Plan (DMDP) area.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="bg-brand-neutral p-8 border border-brand-primary/10">
              <h4 className="font-serif text-xl text-brand-primary mb-2">Rapid Transit</h4>
              <p className="text-brand-text">A mere 7 kilometers (an 8-minute drive) from the Kuril Flyover via the expansive 300-feet RAJUK Purbachal Link Road.</p>
            </div>
            <div className="bg-brand-neutral p-8 border border-brand-primary/10">
              <h4 className="font-serif text-xl text-brand-primary mb-2">Global Access</h4>
              <p className="text-brand-text">Unprecedented rapid accessibility from the Hazrat Shahjalal International Airport and the American Embassy.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
