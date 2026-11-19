import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Quote,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandMotto from '../components/BrandMotto';

interface LeadershipPillar {
  icon: typeof ShieldCheck;
  title: string;
  desc: string;
}

const LEADERSHIP_PILLARS: LeadershipPillar[] = [
  {
    icon: Clock,
    title: 'Punctual Project Delivery',
    desc: 'Every development follows a disciplined construction schedule so families and investors receive their residences strictly on time.',
  },
  {
    icon: ShieldCheck,
    title: 'Promise & Specification Fidelity',
    desc: 'From structural engineering to interior finishes, we deliver every architectural detail exactly as committed in our client agreements.',
  },
  {
    icon: Award,
    title: 'Dedicated Client Stewardship',
    desc: 'Personalized guidance, transparent milestone reporting, and long-term asset care form the foundation of our client relationships.',
  },
];

export default function Leadership() {
  return (
    <div className="w-full bg-brand-neutral pb-24">
      {/* Executive Header */}
      <section className="relative bg-brand-dark text-white pt-24 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden border-b-4 border-brand-accent/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto max-w-6xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-brand-accent/40 backdrop-blur-md mb-6">
            <Building2 size={14} className="text-brand-accent" />
            <span className="text-xs uppercase tracking-[0.25em] text-brand-accent font-bold">
              Executive Leadership
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight leading-tight mb-5">
            Chairman &amp;{' '}
            <span className="italic font-normal text-brand-accent">Managing Director</span>
          </h1>

          <p className="text-base sm:text-lg text-brand-neutral/85 max-w-2xl mx-auto font-light leading-relaxed">
            Guiding Viridian Nexus Development Ltd. with principled stewardship, architectural
            precision, and an unwavering commitment to on-time excellence.
          </p>
        </div>
      </section>

      {/* Main Profile & Executive Statement */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl -mt-14 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Executive Portrait & Credentials */}
          <div className="lg:col-span-4 bg-white rounded-2xl shadow-xl border border-brand-primary/15 overflow-hidden">
            <div className="bg-gradient-to-b from-brand-neutral to-white px-6 pt-8 pb-6 flex justify-center border-b border-brand-primary/10">
              <div className="relative p-1.5 rounded-xl bg-gradient-to-br from-brand-accent via-white to-brand-primary/30 shadow-lg border border-brand-primary/15">
                <img
                  src="/md-portrait.jpg"
                  alt="Md. Saiful Islam Bhuiyan — Chairman & Managing Director of Viridian Nexus Development Ltd."
                  className="w-48 sm:w-52 h-auto rounded-lg object-cover object-top bg-white"
                />
              </div>
            </div>

            <div className="p-6 sm:p-7">
              <h2 className="text-2xl font-serif font-bold text-brand-dark leading-snug">
                Md. Saiful Islam Bhuiyan
              </h2>
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-brand-primary mt-1.5">
                Chairman &amp; Managing Director
              </p>
              <p className="text-sm text-brand-text/75 mt-1">
                Viridian Nexus Development Ltd.
              </p>

              <div className="mt-6 pt-5 border-t border-gray-100 space-y-3.5 text-xs text-brand-text/85">
                <div className="flex items-start gap-2.5">
                  <Building2 size={16} className="text-brand-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-brand-dark uppercase tracking-wider text-[10px]">
                      Development Focus
                    </span>
                    <span>Biophilic &amp; Ecological Luxury Residences</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Compass size={16} className="text-brand-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-brand-dark uppercase tracking-wider text-[10px]">
                      Architectural Ethos
                    </span>
                    <span>Low-Density, Nature-Integrated Urban Sanctuaries</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-brand-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-brand-dark uppercase tracking-wider text-[10px]">
                      Regulatory Governance
                    </span>
                    <span>Authorized &amp; Approved by the Bangladesh Army • BNBC 2020 Compliant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Executive Message */}
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-xl border border-brand-primary/15 p-8 sm:p-11">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-brand-primary mb-3">
              <Quote size={15} className="text-brand-primary" />
              <span>Executive Statement</span>
            </div>

            <h3 className="text-2xl sm:text-4xl font-serif text-brand-dark tracking-tight leading-snug mb-4">
              A Commitment Built on{' '}
              <span className="italic font-normal text-brand-primary">
                Integrity &amp; Timely Delivery
              </span>
            </h3>

            <div className="mb-6">
              <BrandMotto size="section" tone="emerald" />
            </div>

            <div className="space-y-5 text-base text-brand-text/85 leading-relaxed font-light">
              <p className="font-medium text-brand-dark">
                Welcome to Viridian Nexus Development Ltd.
              </p>

              <p>
                Our founding mission is straightforward yet uncompromising: to craft distinguished
                residential sanctuaries where tranquil natural ecology seamlessly meets enduring
                structural excellence. Governed under Bangladesh Army developmental oversight and
                engineered in accordance with BNBC 2020 standards, every project in our portfolio
                embodies meticulous planning, refined architectural craft, and lasting livability.
              </p>

              <p>
                As we introduce successive flagship enclaves and expand our residential footprint,
                our standard never wavers—creating serene, low-density living environments built for
                generations of discerning homeowners and investors.
              </p>

              <blockquote className="my-6 p-5 sm:p-6 bg-brand-neutral rounded-xl border-l-4 border-brand-primary text-brand-dark font-normal">
                "At Viridian Nexus Development Ltd., our foremost commitment is taking diligent care
                of our clients by fulfilling every promise we make and completing every project
                strictly on time. This is our enduring hallmark."
              </blockquote>
            </div>

            {/* Evergreen Governance Strip */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-xl bg-brand-neutral/70 border border-brand-primary/15">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-brand-primary">
                  Corporate Philosophy
                </div>
                <div className="font-serif font-bold text-brand-dark mt-1">
                  Homes Woven in Nature
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-brand-primary">
                  Enlistment &amp; Standards
                </div>
                <div className="text-sm font-medium text-brand-dark mt-1">
                  RAJUK &amp; Cantt. Board Enlisted &bull; Bangladesh Army Approved
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-brand-primary">
                  Our Hallmark
                </div>
                <div className="text-sm font-medium text-brand-dark mt-1">
                  On-Time Handover &amp; Client Care
                </div>
              </div>
            </div>

            {/* Signature & Action */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <div className="font-serif text-xl font-bold text-brand-dark">
                  Md. Saiful Islam Bhuiyan
                </div>
                <div className="text-xs uppercase tracking-wider font-semibold text-brand-primary mt-0.5">
                  Chairman &amp; Managing Director — Viridian Nexus Development Ltd.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  <span>Explore Portfolio</span>
                  <ArrowRight size={15} />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 border border-brand-primary/30 hover:border-brand-primary text-brand-dark px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <span>Private Advisory</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Core Leadership Commitments */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {LEADERSHIP_PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="bg-white p-7 rounded-2xl border border-brand-primary/10 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-4">
                <pillar.icon size={22} />
              </div>
              <h4 className="font-serif font-bold text-lg text-brand-dark mb-2">{pillar.title}</h4>
              <p className="text-sm text-brand-text/75 leading-relaxed font-light">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
