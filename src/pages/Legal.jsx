import React, { useState, useEffect } from 'react';
import { Shield, Scale, FileText, Lock, AlertTriangle, CheckCircle, ChevronRight, Building } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

export default function Legal() {
  const { hash } = useLocation();
  const [activeSection, setActiveSection] = useState('buyer-protection');

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      if (['buyer-protection', 'company-policies', 'terms', 'privacy'].includes(id)) {
        setActiveSection(id);
      }
    }
  }, [hash]);

  const sections = [
    { id: 'buyer-protection', label: 'Buyer Protection & Compliance', icon: Shield },
    { id: 'company-policies', label: 'Company Policies & Disclaimers', icon: Building },
    { id: 'terms', label: 'Terms of Service', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Lock },
  ];

  return (
    <div className="w-full bg-gray-50 min-h-screen pb-24 font-sans">
      {/* Header */}
      <div className="bg-brand-dark pt-32 pb-24 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-brand-accent mb-6">Legal & Compliance</h1>
        <p className="text-lg text-brand-neutral/80 max-w-2xl mx-auto">
          Committed to absolute transparency. Industry-standard legal frameworks designed to protect your investments and our mutual interests.
        </p>
      </div>

      <div className="container mx-auto px-4 -mt-12 max-w-6xl">
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 flex flex-col md:flex-row overflow-hidden min-h-[600px]">
          
          {/* Sidebar Navigation */}
          <div className="w-full md:w-80 bg-gray-50/50 border-r border-gray-100 p-6 md:p-8 shrink-0 flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Legal Directory</h3>
            <nav className="flex flex-col gap-2 flex-1">
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-300 ${
                      isActive 
                        ? 'bg-brand-primary text-white font-bold shadow-md shadow-brand-primary/20 scale-[1.02]' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-brand-primary font-medium'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-brand-accent' : 'text-gray-400'} />
                    <span className="text-sm">{sec.label}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto opacity-70" />}
                  </button>
                );
              })}
            </nav>
            
            <div className="mt-12 p-5 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
              <Scale size={24} className="text-brand-primary mb-3" />
              <h4 className="text-sm font-bold text-brand-dark mb-1">Legal Counsel</h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                Our legal framework complies strictly with the Real Estate Development and Management Act, 2010.
              </p>
              <a href="mailto:legal@viridiannexus.com" className="text-xs font-bold text-brand-primary hover:underline">
                Contact Legal Department
              </a>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 md:p-12 lg:p-16">
            
            {activeSection === 'buyer-protection' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Shield size={28} /></div>
                  <h2 className="text-3xl font-serif text-brand-dark">Buyer Protection & Compliance</h2>
                </div>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-600 leading-relaxed mb-8">
                    Viridian Nexus Development Ltd. operates strictly under the legal umbrella of the <strong>Real Estate Development and Management Act, 2010</strong> of Bangladesh. We guarantee full statutory compliance to safeguard our clients' investments.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <div className="p-6 border border-gray-200 rounded-xl bg-white hover:border-brand-primary/30 transition-colors shadow-sm group">
                      <CheckCircle className="text-green-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
                      <h3 className="text-lg font-bold text-brand-dark mb-2">Escrow Fund Allocation</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">Client payments are securely funneled into project-specific accounts. Funds collected for a project are strictly legally prohibited from being diverted to other corporate ventures.</p>
                    </div>
                    <div className="p-6 border border-gray-200 rounded-xl bg-white hover:border-brand-primary/30 transition-colors shadow-sm group">
                      <CheckCircle className="text-green-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
                      <h3 className="text-lg font-bold text-brand-dark mb-2">Strict Timelines & Penalties</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">We accept statutory liabilities. In the event of an arbitrary delay in handover, the company is legally bound to provide compensation as per government regulations.</p>
                    </div>
                    <div className="p-6 border border-gray-200 rounded-xl bg-white hover:border-brand-primary/30 transition-colors shadow-sm group">
                      <CheckCircle className="text-green-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
                      <h3 className="text-lg font-bold text-brand-dark mb-2">No Unilateral Mortgages</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">Post sale-agreement (Bayanama), the developer explicitly waives the right to mortgage the property against bank loans without the express, written consent of the buyer.</p>
                    </div>
                    <div className="p-6 border border-gray-200 rounded-xl bg-white hover:border-brand-primary/30 transition-colors shadow-sm group">
                      <CheckCircle className="text-green-500 mb-4 group-hover:scale-110 transition-transform" size={28} />
                      <h3 className="text-lg font-bold text-brand-dark mb-2">Design Fidelity Guarantee</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">The architectural design, specifications, and layout detailed in the Sale Agreement will not be altered without your formal approval.</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-brand-dark mb-4">Regulatory Approvals</h3>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-4 text-sm text-gray-600 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="mt-1 w-2 h-2 rounded-full bg-brand-primary shrink-0" />
                      <div>
                        <strong className="block text-brand-dark mb-1 text-base">RAJUK Approval</strong>
                        Complete planning, zoning, and building clearance acquired for all active developments.
                      </div>
                    </li>
                    <li className="flex items-start gap-4 text-sm text-gray-600 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="mt-1 w-2 h-2 rounded-full bg-brand-primary shrink-0" />
                      <div>
                        <strong className="block text-brand-dark mb-1 text-base">REHAB Membership</strong>
                        Fully registered member of the Real Estate & Housing Association of Bangladesh.
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'company-policies' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Building size={28} /></div>
                  <h2 className="text-3xl font-serif text-brand-dark">Company Policies & Disclaimers</h2>
                </div>
                <div className="prose prose-gray max-w-none text-gray-600 text-sm leading-relaxed space-y-8">
                  
                  <div>
                    <h3 className="text-lg font-bold text-brand-dark mb-3 flex items-center gap-2"><span className="text-brand-primary">1.</span> Visual Representations & Marketing Materials</h3>
                    <p className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      All 3D renderings, floor plans, images, and marketing collateral displayed on this website are artistic impressions and intent of design. They do not constitute a legal contract. The final constructed property may have minor deviations based on structural necessities, regulatory mandates, or material availability. The definitive specifications will be those outlined exclusively in the formal Sale Agreement.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-brand-dark mb-3 flex items-center gap-2"><span className="text-brand-primary">2.</span> Force Majeure</h3>
                    <p>
                      Viridian Nexus Development Ltd. shall not be held liable for delays or failures in performance resulting from circumstances beyond reasonable control. This includes, but is not limited to: Acts of God (floods, earthquakes, natural disasters), government interventions, strikes, lockouts, national emergencies, pandemics, or unforeseen systemic supply chain disruptions. In such events, handover timelines will be extended proportionally without penalty.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-brand-dark mb-3 flex items-center gap-2"><span className="text-brand-primary">3.</span> Limitation of Liability</h3>
                    <p>
                      Under no circumstances shall Viridian Nexus Development Ltd., its directors, employees, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising out of the use of this website, reliance on its content, or early-stage investment decisions made prior to a formalized legal contract.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-brand-dark mb-3 flex items-center gap-2"><span className="text-brand-primary">4.</span> Payment Defaults & Cancellations</h3>
                    <p>
                      In the event of consecutive payment defaults by the buyer as per the agreed schedule, Viridian Nexus Development Ltd. reserves the right to issue legal notices. Failure to rectify defaults within the statutory 60-day grace period grants the company the right to cancel the allotment and release the unit. Refunds will be processed strictly as per the Real Estate Act, 2010, deducting administrative penalties.
                    </p>
                  </div>
                  
                  <div className="p-5 bg-brand-dark text-brand-neutral/90 border-l-4 border-brand-accent mt-10 rounded-r-xl shadow-md">
                    <p className="font-semibold italic m-0">"These policies are designed to maintain operational integrity and ensure fairness for all stakeholders involved in the development lifecycle."</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'terms' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={28} /></div>
                  <h2 className="text-3xl font-serif text-brand-dark">Terms of Service</h2>
                </div>
                <div className="prose prose-gray max-w-none text-gray-600 text-sm leading-relaxed space-y-6">
                  <p className="text-xs text-brand-primary uppercase tracking-wider font-bold bg-brand-primary/10 inline-block px-3 py-1 rounded-full">Last Updated: September 2026</p>
                  <p className="text-base mt-4">
                    By accessing and using the Viridian Nexus Development Ltd. portal (the "Platform"), you agree to be bound by these Terms of Service. If you do not agree, you must refrain from using the Platform.
                  </p>

                  <div className="space-y-8 mt-8">
                    <div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3 border-b border-gray-100 pb-2">1. User Accounts & Security</h3>
                      <p>
                        You are responsible for maintaining the confidentiality of your account credentials. The Platform provides tools to track bookings and financial ledgers. Viridian Nexus Development Ltd. will not be liable for any loss arising from your failure to protect your login information.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3 border-b border-gray-100 pb-2">2. Platform Usage</h3>
                      <ul className="list-disc pl-5 space-y-3">
                        <li>You agree to provide accurate, current, and complete information during registration and booking.</li>
                        <li>You must not use the Platform for any illegal or unauthorized purpose, including fraudulent financial representations.</li>
                        <li>Attempting to breach the security of the Platform, scrape data, or access data not intended for you is strictly prohibited and subject to legal prosecution.</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3 border-b border-gray-100 pb-2">3. Dispute Resolution & Governing Law</h3>
                      <p>
                        These Terms are governed by the laws of Bangladesh. Any dispute, controversy, or claim arising out of or relating to the use of the Platform or preliminary booking processes shall first be attempted to be resolved amicably. If unresolved, it shall be submitted to binding arbitration in Dhaka, Bangladesh, under the Arbitration Act, 2001.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Lock size={28} /></div>
                  <h2 className="text-3xl font-serif text-brand-dark">Privacy Policy</h2>
                </div>
                <div className="prose prose-gray max-w-none text-gray-600 text-sm leading-relaxed space-y-6">
                  <p className="text-xs text-brand-primary uppercase tracking-wider font-bold bg-brand-primary/10 inline-block px-3 py-1 rounded-full">Last Updated: September 2026</p>
                  
                  <div className="p-5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl mb-8 mt-4 shadow-sm">
                    <p className="font-bold text-brand-dark m-0 flex items-center gap-2 text-base">
                      <AlertTriangle size={20} className="text-brand-primary" />
                      Our Commitment to Data Security
                    </p>
                    <p className="mt-2 mb-0">We employ enterprise-grade encryption and access controls. Your financial and personal data is strictly confidential and is <strong>never sold</strong> to third-party marketers or data brokers.</p>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3">1. Information We Collect</h3>
                      <p>
                        We collect personal information (Name, Email, Phone, NID/Passport, Address) necessary to verify identity and process real estate transactions legally. We also collect usage data (cookies, IP addresses) to improve platform performance and security.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3">2. How We Use Your Information</h3>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
                          <span>To facilitate real estate bookings, legal documentation, and handover processes.</span>
                        </li>
                        <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
                          <span>To communicate critical project updates, payment schedules, and stage progressions.</span>
                        </li>
                        <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
                          <span>To comply with regulatory KYC (Know Your Customer) and anti-money laundering (AML) requirements.</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-brand-dark mb-3">3. Data Sharing & Third Parties</h3>
                      <p className="mb-4">
                        We do not sell data. Data is only shared with authorized third parties when legally or operationally necessary, such as:
                      </p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>Government regulatory bodies (RAJUK, NBR) for compliance and registration.</li>
                        <li>Financial institutions and partner banks solely for processing your approved payments or mortgages.</li>
                        <li>Legal counsel for drafting and executing sale deeds.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
