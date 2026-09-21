import { Scale, FileText, Lock, Clock } from 'lucide-react';

export default function Legal() {
  return (
    <div className="w-full bg-brand-neutral pb-24">
      <div className="bg-brand-dark pt-32 pb-20 px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-serif text-brand-accent mb-6">Legal Compliance & Protection</h1>
        <p className="text-xl text-brand-neutral max-w-3xl mx-auto opacity-90">
          Radical transparency as our core standard. Your capital is protected by exhaustive legal frameworks.
        </p>
      </div>

      <div className="container mx-auto px-4 -mt-10">
        <div className="bg-white p-10 md:p-16 shadow-xl border-t-4 border-brand-primary max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-serif text-brand-dark mb-6 flex items-center gap-3">
                <Scale className="text-brand-primary" /> Regulatory Approvals
              </h2>
              <p className="text-brand-text mb-4">
                Viridian Nexus holds formal registration as a recognized developer with the Ministry of Housing and Public Works.
              </p>
              <ul className="space-y-4">
                <li className="bg-brand-neutral p-4 border-l-4 border-brand-accent">
                  <strong>RAJUK Approval:</strong> Complete planning and zoning clearance.
                </li>
                <li className="bg-brand-neutral p-4 border-l-4 border-brand-accent">
                  <strong>DoE Certification:</strong> Environmental Clearance Certificate acquired.
                </li>
              </ul>
            </div>
          </div>
          
          <div className="my-12 h-px bg-brand-primary/20 w-full" />

          <h2 className="text-3xl font-serif text-brand-dark mb-8 text-center">2010 Act Buyer Protections</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 border border-brand-primary/10">
              <Lock className="text-brand-primary mb-4" size={32} />
              <h3 className="text-xl font-bold text-brand-dark mb-2">Escrow Funding Compliance</h3>
              <p className="text-sm text-brand-text">All collected funds are strictly utilized for the designated Jolshiri site, legally preventing project insolvency.</p>
            </div>
            <div className="p-6 border border-brand-primary/10">
              <FileText className="text-brand-primary mb-4" size={32} />
              <h3 className="text-xl font-bold text-brand-dark mb-2">No Unilateral Changes</h3>
              <p className="text-sm text-brand-text">The 2,860 sq. ft. design and spatial layout will not be altered without explicit, written buyer consent.</p>
            </div>
            <div className="p-6 border border-brand-primary/10">
              <ShieldAlert className="text-brand-primary mb-4" size={32} />
              <h3 className="text-xl font-bold text-brand-dark mb-2">Mortgage Restrictions</h3>
              <p className="text-sm text-brand-text">Post sale-agreement (Bayanama), the developer cannot legally place a bank mortgage over your flat without your express consent.</p>
            </div>
            <div className="p-6 border border-brand-primary/10">
              <Clock className="text-brand-primary mb-4" size={32} />
              <h3 className="text-xl font-bold text-brand-dark mb-2">Timely Handover Guarantee</h3>
              <p className="text-sm text-brand-text">Strict adherence to handover dates, with upfront acceptance of statutory penalties (15% compensation) for arbitrary delays.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Temporary inline import for ShieldAlert since it was missed
import { ShieldAlert } from 'lucide-react';
