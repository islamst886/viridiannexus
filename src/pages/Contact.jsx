import { MapPin, Phone, Mail } from 'lucide-react';

export default function Contact() {
  return (
    <div className="w-full bg-brand-neutral">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
        {/* Left Side - Vision & Info */}
        <div className="bg-brand-dark text-brand-neutral p-12 lg:p-24 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-serif text-brand-accent mb-6">Corporate Profile</h1>
          <p className="text-lg opacity-90 mb-12 leading-relaxed">
            Viridian Nexus was founded on a singular vision: to elevate Bangladesh's real estate sector to uncompromising global standards. We are not standard contractors; we are visionary developers committed to architectural mastery and structural integrity.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <MapPin className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Corporate Office</h4>
                <p className="opacity-80">Level 8, Nexus Tower, Gulshan Avenue<br/>Dhaka 1212, Bangladesh</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <Phone className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Direct Lines</h4>
                <p className="opacity-80">Domestic: +880 96 0000 0000<br/>International: +1 (800) 123-4567</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="text-brand-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-brand-accent">Electronic Mail</h4>
                <p className="opacity-80">investors@viridiannexus.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="bg-white p-12 lg:p-24 flex flex-col justify-center">
          <h2 className="text-3xl font-serif text-brand-dark mb-2">Request an Executive Briefing</h2>
          <p className="text-brand-text mb-8">Secure your private consultation with our investment advisory team.</p>

          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Full Name</label>
                <input type="text" className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Phone / WhatsApp</label>
                <input type="tel" className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Email Address</label>
              <input type="email" className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2 uppercase tracking-wider">Inquiry Type</label>
              <select className="w-full border-b-2 border-brand-primary/20 p-2 focus:outline-none focus:border-brand-primary bg-transparent transition-colors">
                <option>Domestic Investment</option>
                <option>NRB / International Purchase</option>
                <option>Virtual Tour Request</option>
              </select>
            </div>

            <button type="button" className="w-full bg-brand-primary text-white py-4 font-bold uppercase tracking-widest hover:bg-brand-dark transition-colors mt-8">
              Submit Inquiry
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
