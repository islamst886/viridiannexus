import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, Clock, Calendar, User, Share2, 
  CheckCircle2, Sparkles, ShieldCheck, MapPin, Building2, 
  Download, Send, MessageSquare 
} from 'lucide-react';
import { JOURNAL_ARTICLES, getJournalArticle } from '../data/journalArticles';
import { toast } from 'react-toastify';
import { supabase } from '../supabase';
import { useGlobalState } from '../context/GlobalState';

export default function JournalArticle() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, userProfile } = useGlobalState();

  // Find article by slug or default to first article
  const currentSlug = slug || 'jolshiri-revolution';
  const article = getJournalArticle(currentSlug) || JOURNAL_ARTICLES[0];

  // In-page dossier request state
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSlug]);

  useEffect(() => {
    if (isLoggedIn && userProfile) {
      setFormData(prev => ({
        ...prev,
        name: userProfile.displayName || '',
        email: userProfile.email || '',
        phone: userProfile.phone || ''
      }));
    }
  }, [isLoggedIn, userProfile]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Publication link copied to clipboard.');
  };

  const handleRequestDossier = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('Please enter your name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      const messageBody = `[Publication Dossier Request]\nArticle: ${article.title}\nCategory: ${article.category}\nPhone: ${formData.phone || 'N/A'}\nNotes: ${formData.note || 'Requested Full Dossier & Feasibility Whitepaper'}`;

      const { error } = await supabase.from('inquiries').insert({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        inquiry_type: 'Brochure Request',
        message: messageBody,
        property_name: article.title,
        status: 'Unread',
        source: 'Viridian Journal Page'
      });

      if (error) throw error;

      toast.success('Thank you. The full research dossier and whitepaper have been dispatched to your email.');
      setFormData({ name: '', email: '', phone: '', note: '' });
    } catch (err) {
      console.error(err);
      toast.error('Unable to send request. Please try again or reach out on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  // Find other articles for bottom navigation
  const otherArticles = JOURNAL_ARTICLES.filter(a => a.slug !== article.slug);

  return (
    <div className="w-full bg-brand-neutral min-h-screen text-brand-text">
      
      {/* ── Top Editorial Breadcrumb & Navigation ── */}
      <div className="bg-brand-dark text-white border-b border-brand-primary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 max-w-5xl flex items-center justify-between text-xs">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-brand-accent hover:text-white font-bold uppercase tracking-wider transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Return to Homepage</span>
          </Link>

          <div className="flex items-center gap-3 text-white/60">
            <span>The Viridian Journal</span>
            <span>/</span>
            <span className="text-brand-accent font-medium truncate max-w-[200px] sm:max-w-none">
              {article.category}
            </span>
          </div>
        </div>
      </div>

      {/* ── Article Header ── */}
      <header className="bg-white border-b border-gray-100 pt-12 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          
          {/* Category Eyebrow */}
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-primary mb-4 bg-brand-neutral px-3 py-1 rounded-full border border-brand-primary/20">
            <Sparkles size={13} className="text-brand-primary" />
            <span>{article.category}</span>
          </div>

          {/* Grand Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif text-brand-dark leading-[1.12] mb-6 tracking-tight">
            {article.title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-brand-text/80 font-light leading-relaxed mb-8">
            {article.subtitle}
          </p>

          {/* Author Byline & Meta */}
          <div className="flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-4">
              <img
                src={article.author.avatar}
                alt={article.author.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-brand-primary"
              />
              <div>
                <h2 className="font-serif font-bold text-sm text-brand-dark">{article.author.name}</h2>
                <p className="text-xs text-brand-primary font-medium">{article.author.role}</p>
                <p className="text-[11px] text-gray-500">{article.author.affiliation}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-brand-primary" />
                <span>{article.date}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-brand-primary" />
                <span>{article.readTime}</span>
              </span>
              <button
                onClick={handleShare}
                className="ml-2 inline-flex items-center gap-1.5 text-brand-primary hover:text-brand-dark px-2.5 py-1 rounded-md border border-gray-200 hover:border-brand-primary transition-all cursor-pointer"
                title="Share this publication"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* ── Full Hero Visual & Stats Banner ── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl -mt-6">
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-brand-dark">
          <img
            src={article.heroImage}
            alt={article.title}
            className="w-full h-[360px] sm:h-[480px] object-cover"
          />
          <div className="bg-brand-dark/95 px-6 py-3 text-xs text-brand-accent/80 flex items-center justify-between border-t border-brand-primary/20">
            <span>{article.imageCaption}</span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase text-white/50">Viridian Spatial Archives</span>
          </div>
        </div>

        {/* 4 Metric Callout Cards */}
        {article.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {article.stats.map((s, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold block mb-1">
                  {s.label}
                </span>
                <span className="font-serif font-bold text-2xl text-brand-primary block">
                  {s.value}
                </span>
                <span className="text-[11px] text-brand-dark/60 mt-1 block font-light">
                  {s.note}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Editorial Content Layout ── */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Table of Contents & Author Profile (Sticky on Desktop) */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="lg:sticky lg:top-24 space-y-6">
              
              {/* Table of Contents */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-widest text-brand-primary mb-4 pb-2 border-b border-gray-100">
                  Publication Sections
                </h2>
                <nav className="space-y-3">
                  {article.sections.map((sec, i) => (
                    <a
                      key={i}
                      href={`#section-${i}`}
                      className="block text-xs text-brand-text/80 hover:text-brand-primary font-medium transition-colors"
                    >
                      0{i + 1}. {sec.heading}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Author Note Box */}
              <div className="bg-brand-neutral p-6 rounded-2xl border border-brand-primary/20">
                <span className="text-[10px] uppercase tracking-widest text-brand-primary font-bold block mb-2">
                  About the Research Atelier
                </span>
                <p className="text-xs text-brand-text/75 leading-relaxed font-light mb-4">
                  The Viridian Nexus Research & Design Atelier publishes peer-reviewed spatial, architectural, and financial insights to elevate urban living standards across Bangladesh.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-brand-dark">
                  <ShieldCheck size={16} className="text-brand-primary" />
                  <span>Institutional Quality Sign-Off</span>
                </div>
              </div>

              {/* Quick Contact CTA */}
              <div className="bg-brand-dark text-white p-6 rounded-2xl border border-brand-accent/20">
                <h2 className="font-serif text-lg text-brand-accent mb-2">Consult the Authors</h2>
                <p className="text-xs text-white/70 font-light mb-4">
                  Schedule a private briefing with our architectural and legal team regarding this publication.
                </p>
                <a
                  href="#request-dossier"
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-accent hover:text-brand-dark text-white py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <MessageSquare size={14} />
                  <span>Request Full Whitepaper</span>
                </a>
              </div>

            </div>
          </aside>

          {/* Right Column: Editorial Body */}
          <article className="lg:col-span-8 bg-white p-8 sm:p-12 rounded-3xl border border-gray-200 shadow-sm space-y-10">
            
            {/* Executive Abstract */}
            <div className="bg-brand-neutral p-6 rounded-2xl border-l-4 border-brand-primary">
              <span className="text-[10px] uppercase tracking-widest text-brand-primary font-bold block mb-1">
                Executive Abstract
              </span>
              <p className="text-sm sm:text-base text-brand-dark font-serif italic leading-relaxed">
                "{article.summary}"
              </p>
            </div>

            {/* Sections Flow */}
            {article.sections.map((sec, idx) => (
              <section key={idx} id={`#section-${idx}`} className="space-y-4 pt-4 first:pt-0">
                <h2 className="text-2xl sm:text-3xl font-serif text-brand-dark tracking-tight">
                  {sec.heading}
                </h2>

                <div className="space-y-4">
                  {sec.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-base sm:text-lg text-brand-text/80 leading-relaxed font-light">
                      {p}
                    </p>
                  ))}
                </div>

                {/* Optional Pull Quote */}
                {sec.quote && (
                  <blockquote className="my-8 p-6 sm:p-8 bg-brand-neutral rounded-2xl border-l-4 border-brand-accent shadow-sm">
                    <p className="font-serif text-lg sm:text-xl italic text-brand-dark leading-relaxed">
                      "{sec.quote}"
                    </p>
                    <cite className="block text-xs font-bold uppercase tracking-widest text-brand-primary mt-3 not-italic">
                      — Viridian Nexus Research & Insights
                    </cite>
                  </blockquote>
                )}
              </section>
            ))}

            {/* Related Signature Residences */}
            {article.relatedProperties && article.relatedProperties.length > 0 && (
              <div className="pt-10 border-t border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-brand-primary font-bold block">
                      Enclave Residences
                    </span>
                    <h2 className="font-serif text-xl sm:text-2xl text-brand-dark">
                      Featured In This Context
                    </h2>
                  </div>
                  <Link
                    to="/projects"
                    className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:underline"
                  >
                    View All &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {article.relatedProperties.map(prop => (
                    <div
                      key={prop.id}
                      onClick={() => navigate(`/property/${prop.id}`)}
                      className="bg-brand-neutral/40 rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                    >
                      <div className="relative h-44 overflow-hidden bg-brand-dark">
                        <img
                          src={prop.image}
                          alt={prop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute bottom-2 left-2 bg-brand-dark/90 text-white text-xs font-serif font-bold px-2.5 py-1 rounded">
                          {prop.price}
                        </div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-serif font-bold text-base text-brand-dark group-hover:text-brand-primary transition-colors">
                          {prop.name}
                        </h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin size={12} className="text-brand-primary" /> {prop.location}
                        </p>
                        <p className="text-[11px] text-brand-primary font-medium mt-2 pt-2 border-t border-gray-100">
                          {prop.specs}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In-Page Research Dossier Request Form */}
            <div id="request-dossier" className="pt-10 border-t border-gray-100">
              <div className="bg-gradient-to-br from-brand-dark via-brand-primary to-brand-dark rounded-2xl p-8 sm:p-10 text-white shadow-xl">
                <div className="max-w-xl">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-brand-accent font-bold block mb-2">
                    Private Research Access
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl text-white mb-3">
                    Request Full Research Dossier & Feasibility Report
                  </h2>
                  <p className="text-xs sm:text-sm text-brand-neutral/80 font-light leading-relaxed mb-6">
                    Receive the uncompressed technical whitepaper, architectural blueprints, environmental studies, and financial valuation reports for this study.
                  </p>

                  <form onSubmit={handleRequestDossier} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-accent mb-1">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Tariq Rahman"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-brand-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-accent mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="client@investment.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-brand-accent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-accent mb-1">
                        Phone / WhatsApp (optional)
                      </label>
                      <input
                        type="tel"
                        placeholder="+880 1711-000000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-brand-accent"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-brand-accent hover:bg-white text-brand-dark px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download size={14} />
                      <span>{submitting ? 'Dispatching...' : 'Dispatch Full Dossier (PDF)'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>

          </article>
        </div>
      </main>

      {/* ── More Publications Deck ── */}
      <section className="bg-white py-16 border-t border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-brand-primary font-bold block">
                The Viridian Journal
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-brand-dark">
                Continue Reading
              </h2>
            </div>
            <Link
              to="/"
              className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:underline"
            >
              Explore Homepage &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {otherArticles.map((oa) => (
              <div
                key={oa.slug}
                onClick={() => navigate(`/journal/${oa.slug}`)}
                className="group bg-brand-neutral/40 rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-52 overflow-hidden bg-brand-dark">
                    <img
                      src={oa.heroImage}
                      alt={oa.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-brand-dark/90 text-brand-accent text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      {oa.category}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span>{oa.date}</span>
                      <span>•</span>
                      <span>{oa.readTime}</span>
                    </div>
                    <h3 className="font-serif font-bold text-xl text-brand-dark group-hover:text-brand-primary transition-colors leading-snug">
                      {oa.title}
                    </h3>
                    <p className="text-xs text-brand-text/70 mt-2 font-light line-clamp-2">
                      {oa.summary}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-primary group-hover:text-brand-dark">
                    <span>Read Publication</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
}

