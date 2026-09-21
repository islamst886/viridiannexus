import { Globe, FileSignature, Video } from 'lucide-react';

export default function NRB() {
  return (
    <div className="w-full bg-brand-neutral pb-24">
      <div className="bg-brand-dark pt-32 pb-20 px-4 text-center border-b-8 border-brand-accent">
        <h1 className="text-4xl md:text-6xl font-serif text-brand-neutral mb-6">NRB & International Portal</h1>
        <p className="text-xl text-brand-accent max-w-3xl mx-auto">
          A specialized financial and logistical gateway for global investors.
        </p>
      </div>

      <div className="container mx-auto px-4 max-w-5xl mt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <Globe className="text-brand-primary" size={40} />
              <h2 className="text-3xl font-serif text-brand-dark">The NITA Framework</h2>
            </div>
            <p className="text-brand-text mb-6 text-lg leading-relaxed">
              Foreign currency sent by Non-Resident Bangladeshis can be easily and legally converted through normal banking channels via authorized dealers using a NITA (Non-Resident Investors Taka Account).
            </p>
            <div className="bg-brand-primary/5 p-6 border-l-4 border-brand-primary">
              <p className="font-medium text-brand-dark">
                Purchasing real estate via legal inward remittance not only secures the initial investment but legally facilitates the future repatriation of capital gains, profits, and dividends.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-6">
              <FileSignature className="text-brand-primary" size={40} />
              <h2 className="text-3xl font-serif text-brand-dark">Remote Legal Execution</h2>
            </div>
            <p className="text-brand-text mb-6 text-lg leading-relaxed">
              Execute Power of Attorney (POA) documents remotely. Verified and attested by the Bangladesh High Commission or Embassy in your country of residence, allowing your nominated representative to manage property registration.
            </p>
          </div>
        </div>

        <div className="mt-20 bg-brand-dark text-brand-neutral p-10 text-center">
          <Video className="mx-auto mb-4 text-brand-accent" size={48} />
          <h3 className="text-2xl font-serif text-brand-accent mb-4">International Brokerage Concierge</h3>
          <p className="mb-8 max-w-2xl mx-auto">
            Schedule private virtual tours and video conferencing sessions tailored to international time zones. Our concierge team is ready to assist you.
          </p>
          <a href="/contact" className="inline-block bg-brand-accent text-brand-dark px-8 py-3 font-bold uppercase hover:bg-white transition-colors">
            Schedule a Virtual Tour
          </a>
        </div>
      </div>
    </div>
  );
}
