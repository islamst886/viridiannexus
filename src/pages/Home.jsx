import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, MapPin, Building, ChevronRight, ChevronLeft, Search, Heart, PlayCircle, Star, Quote, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalState';
import { usePropertyTypes } from '../hooks/usePropertyTypes';
import { formatPropertyPrice, formatPropertySpecs } from '../utils/propertyFormatting';

const carouselItems = [
  {
    title: "Single Unit Per Floor",
    desc: "Unmatched exclusivity and privacy.",
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "4 Expansive Bedrooms",
    desc: "Spacious living with multiple master suites.",
    img: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Infinity Pool Access",
    desc: "Rooftop luxury overlooking Jolshiri.",
    img: "https://images.unsplash.com/photo-1576013551627-1cc001fd2851?auto=format&fit=crop&w=800&q=80"
  }
];

const featuredProjects = [
  {
    id: 'the-sapphire-penthouse',
    name: 'The Sapphire Penthouse',
    location: 'Gulshan 2, Dhaka',
    price: '৳ 5,00,00,000',
    type: 'Penthouse',
    beds: 4,
    baths: 5,
    sqft: '4,500',
    img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    status: 'Ready'
  },
  {
    id: 'emerald-heights',
    name: 'Emerald Heights',
    location: 'Banani, Dhaka',
    price: '৳ 3,20,00,000',
    type: 'Luxury Apartment',
    beds: 3,
    baths: 4,
    sqft: '3,200',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    status: 'Ongoing'
  },
  {
    id: 'oasis-towers',
    name: 'Oasis Towers',
    location: 'Jolshiri Abashon',
    price: '৳ 2,80,00,000',
    type: 'Smart Home',
    beds: 3,
    baths: 3,
    sqft: '2,860',
    img: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80',
    status: 'Upcoming'
  }
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { toggleWishlist, wishlist, properties: allProjects, loadingProperties: loading } = useGlobalState();
  const [filterLocation, setFilterLocation] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // displayProjects initializes and updates when allProjects arrives
  const [displayProjects, setDisplayProjects] = useState([]);
  
  useEffect(() => {
    setDisplayProjects(allProjects);
  }, [allProjects]);

  const navigate = useNavigate();
  const { types: propertyTypes } = usePropertyTypes();

  // Dynamically derive unique locations and statuses from real data
  const locations = useMemo(() => [...new Set(allProjects.map(p => p.location).filter(Boolean))], [allProjects]);
  const statuses  = useMemo(() => [...new Set(allProjects.map(p => p.status).filter(Boolean))], [allProjects]);

  // Navigate to /projects with query params so filters are fully applied there
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (filterLocation) params.set('location', filterLocation);
    if (filterStatus)   params.set('status', filterStatus);
    if (filterType)     params.set('type', filterType);
    navigate(`/projects?${params.toString()}`);
  };

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % carouselItems.length);
  const prevSlide = () => setCurrentSlide((p) => (p - 1 + carouselItems.length) % carouselItems.length);

  return (
    <div className="flex flex-col w-full bg-brand-neutral">
      
      {/* 1. Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80" 
            alt="Viridian Nexus Exterior" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-brand-dark/70 mix-blend-multiply"></div>
          {/* <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-80">
                <source src="/hero-video.mp4" type="video/mp4" />
              </video> */}
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="mb-4"
          >
            <span className="text-brand-accent uppercase tracking-[0.3em] font-bold text-sm md:text-base drop-shadow-md">
              Homes Woven In Nature
            </span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif text-brand-neutral mb-6 drop-shadow-lg"
          >
            Discover Your Premium <br/><span className="text-brand-accent text-5xl md:text-7xl">Luxury Residence</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-lg md:text-xl text-brand-neutral/90 mb-12 max-w-3xl mx-auto drop-shadow"
          >
            Curating exclusive real estate portfolios across Dhaka's most prestigious neighborhoods. Exceptional design, elite security, and uncompromising luxury.
          </motion.p>
        </div>
      </section>

      {/* 2. Floating Search Bar */}
      <section className="relative z-20 -mt-16 max-w-6xl mx-auto w-full px-4">
        <div className="bg-white rounded-xl shadow-2xl p-4 md:p-6 border-b-4 border-brand-primary flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-1">Location</label>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-full p-2 border-b-2 border-brand-neutral focus:border-brand-primary outline-none bg-transparent text-brand-dark font-medium">
              <option value="">All Locations</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-gray-100 md:pl-4 pt-4 md:pt-0">
            <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-1">Property Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full p-2 border-b-2 border-brand-neutral focus:border-brand-primary outline-none bg-transparent text-brand-dark font-medium">
              <option value="">All Types</option>
              {propertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-gray-100 md:pl-4 pt-4 md:pt-0">
            <label className="block text-xs font-bold text-brand-primary uppercase tracking-wider mb-1">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full p-2 border-b-2 border-brand-neutral focus:border-brand-primary outline-none bg-transparent text-brand-dark font-medium">
              <option value="">Any Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="w-full md:w-auto mt-4 md:mt-0">
            <button onClick={handleSearch} className="w-full md:w-auto bg-brand-primary hover:bg-brand-dark text-white px-8 py-4 rounded font-bold flex items-center justify-center gap-2 transition-colors">
              <Search size={20} /> Search
            </button>
          </div>
        </div>
      </section>

      {/* 3. Featured Projects */}
      <section className="py-24 bg-brand-neutral">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div>
              <h2 className="text-sm font-bold text-brand-primary uppercase tracking-widest mb-2">Exclusive Portfolio</h2>
              <h3 className="text-4xl font-serif text-brand-dark">Featured Projects</h3>
            </div>
            <Link to="/projects" className="mt-4 md:mt-0 text-brand-primary font-bold hover:text-brand-dark flex items-center gap-1">
              View All Projects <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <div className="col-span-full py-20 flex justify-center items-center text-brand-primary">
                <Loader2 size={48} className="animate-spin" />
              </div>
            ) : displayProjects.length === 0 ? (
              <div className="col-span-full py-12 text-center text-brand-dark bg-white rounded-xl shadow-sm border border-gray-100">
                <p className="text-xl font-bold mb-2">No properties found in the database.</p>
                <p className="text-gray-500 mb-4">Please log in to the Admin Dashboard to add properties.</p>
                <button onClick={() => { setFilterLocation('All Locations'); setFilterStatus('Any Status'); setDisplayProjects(allProjects); }} className="text-brand-primary hover:underline font-semibold">Clear Filters</button>
              </div>
            ) : (
              displayProjects.map(project => {
                const isSaved = wishlist.some(p => p.id === project.id);
                const specs = formatPropertySpecs(project);
                const priceStr = formatPropertyPrice(project);
                return (
                  <div key={project.id} onClick={() => navigate(`/property/${project.id}`)} className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group border border-gray-100 cursor-pointer transform hover:-translate-y-1 duration-300">
                    <div className="relative h-64 overflow-hidden">
                      <img src={project.images?.hero || 'https://via.placeholder.com/800x600'} alt={project.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute top-4 left-4 bg-brand-dark/90 text-brand-accent text-xs font-bold px-3 py-1 uppercase tracking-wider rounded-sm backdrop-blur-sm shadow-md">
                        {project.status}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(project);
                        }}
                        className={`absolute top-4 right-4 p-2 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-110 ${isSaved ? 'bg-brand-primary text-white' : 'bg-white/80 text-gray-500 hover:text-brand-primary'}`}
                      >
                        <Heart size={20} className={isSaved ? "fill-current" : ""} />
                      </button>
                    </div>
                    <div className="p-6 relative">
                      <h4 className="text-2xl font-serif text-brand-dark mb-2 group-hover:text-brand-primary transition-colors">{project.name}</h4>
                      <p className="text-brand-text/70 flex items-center gap-1 text-sm mb-4"><MapPin size={16} /> {project.location}</p>
                      
                      <div className="flex justify-between items-center border-t border-b border-gray-100 py-3 mb-4 text-brand-dark/80 text-sm font-medium">
                        <div className="flex items-center gap-1"><img src="https://img.icons8.com/ios/50/003329/bed.png" className="w-5 h-5 opacity-70" alt="bed"/> {specs.beds} Beds</div>
                        <div className="flex items-center gap-1"><img src="https://img.icons8.com/ios/50/003329/shower.png" className="w-5 h-5 opacity-70" alt="bath"/> {specs.baths} Baths</div>
                        <div className="flex items-center gap-1"><img src="https://img.icons8.com/ios/50/003329/ruler.png" className="w-5 h-5 opacity-70" alt="sqft"/> {specs.sqft} SqFt</div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xl font-bold text-brand-primary tracking-tight">{priceStr}</div>
                        <div className="text-brand-dark font-bold group-hover:text-brand-primary text-sm uppercase tracking-wide flex items-center gap-1 transition-colors">
                          Explore <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* 4. Immersive Experiences Promo */}
      <section className="py-20 bg-brand-dark text-brand-neutral">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-brand-accent uppercase tracking-widest mb-2">Technology meets Real Estate</h2>
            <h3 className="text-4xl font-serif text-brand-neutral">Experience It First Hand</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Link to="/virtual-tour" className="relative h-80 rounded-2xl overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Virtual Tour" />
              <div className="absolute inset-0 bg-brand-dark/60 group-hover:bg-brand-dark/40 transition-colors flex flex-col justify-center items-center">
                <PlayCircle size={64} className="text-brand-accent mb-4 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                <h4 className="text-3xl font-serif text-white flex items-center gap-3">
                  360° Virtual Tours
                  <span className="text-[10px] bg-brand-accent text-brand-dark px-2 py-1 rounded-sm uppercase tracking-widest font-bold">Coming Soon</span>
                </h4>
                <p className="text-brand-accent mt-2">Walk through your future home online.</p>
              </div>
            </Link>
            
            <Link to="/live-cameras" className="relative h-80 rounded-2xl overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1541888087525-cebfd64c2924?auto=format&fit=crop&w=1000&q=80" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Live Cameras" />
              <div className="absolute inset-0 bg-brand-dark/60 group-hover:bg-brand-dark/40 transition-colors flex flex-col justify-center items-center">
                <div className="flex items-center gap-2 mb-4 bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full"></span> LIVE NOW
                </div>
                <h4 className="text-3xl font-serif text-white flex items-center gap-3">
                  Construction Cameras
                  <span className="text-[10px] bg-brand-accent text-brand-dark px-2 py-1 rounded-sm uppercase tracking-widest font-bold">Coming Soon</span>
                </h4>
                <p className="text-brand-accent mt-2">Watch your investment grow 24/7.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Our Signature Experience */}
      <section className="py-24 bg-brand-neutral text-brand-text">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-brand-primary uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
              <span className="w-8 h-[1px] bg-brand-primary"></span>
              Our Signature Experience
              <span className="w-8 h-[1px] bg-brand-primary"></span>
            </h2>
            <h3 className="text-4xl md:text-5xl font-serif text-brand-dark mb-6">Uncompromising Luxury & Integrity</h3>
            <p className="text-lg max-w-3xl mx-auto text-brand-text/80 leading-relaxed">
              From the highly secure enclaves of Jolshiri Abashon to the most sought-after neighborhoods across Dhaka, we deliver architectural masterpieces backed by flawless execution and visionary design.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16">
            {[
              { icon: ShieldCheck, title: "Unrivaled Security Protocols", desc: "Elite, multi-tier security infrastructure ensuring absolute peace of mind for you and your family." },
              { icon: Building, title: "Architectural Excellence", desc: "Collaborating with renowned global and local architects to build sustainable, intelligent, and deeply aesthetic residences." },
              { icon: MapPin, title: "Prime Global Standards", desc: "Strategically positioned in Dhaka's most prestigious locations, offering unparalleled connectivity and lifestyle amenities." }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="bg-white p-10 border border-brand-primary/10 shadow-lg hover:shadow-2xl transition-all duration-300 text-center rounded-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                <div className="w-20 h-20 mx-auto bg-brand-neutral rounded-full flex items-center justify-center mb-6 text-brand-primary shadow-inner border border-gray-100">
                  <feature.icon size={36} className="group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-2xl font-serif text-brand-dark mb-4">{feature.title}</h3>
                <p className="text-sm text-brand-text/70 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Counters */}
          <div className="bg-brand-primary rounded-2xl p-10 text-white grid grid-cols-2 md:grid-cols-4 gap-8 text-center shadow-2xl">
            <div>
              <div className="text-4xl md:text-5xl font-bold font-serif text-brand-accent mb-2">15+</div>
              <div className="text-sm uppercase tracking-wider font-semibold">Ongoing Projects</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold font-serif text-brand-accent mb-2">500+</div>
              <div className="text-sm uppercase tracking-wider font-semibold">Happy Families</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold font-serif text-brand-accent mb-2">12+</div>
              <div className="text-sm uppercase tracking-wider font-semibold">Years Experience</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold font-serif text-brand-accent mb-2">100%</div>
              <div className="text-sm uppercase tracking-wider font-semibold">On-Time Delivery</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Testimonials */}
      <section className="py-24 bg-brand-dark relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-brand-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
        
        <div className="container mx-auto px-4 max-w-7xl text-center relative z-10">
          <Quote size={56} className="mx-auto text-brand-accent/40 mb-6" />
          <h2 className="text-sm font-bold text-brand-accent uppercase tracking-widest mb-2">Client Experiences</h2>
          <h3 className="text-4xl md:text-5xl font-serif text-white mb-16">What Our Residents Say</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: "Rafiqul Islam", role: "Business Executive", text: "The level of craftsmanship is extraordinary. Every detail of our penthouse was meticulously executed, and the after-sales concierge service is something I've never experienced in Bangladesh before." },
              { name: "Dr. Samina Chowdhury", role: "Medical Professional", text: "Investing with Viridian Nexus Development Ltd. felt less like buying property and more like acquiring a piece of art. The transparency during construction and the final handover was remarkably professional." },
              { name: "Ahsan Habib", role: "NRB Investor", text: "Living in a Viridian Nexus Development Ltd. property redefines luxury. The smart home integration, the serene community, and the sheer elegance of the architecture make coming home the best part of my day." }
            ].map((review, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-md p-10 rounded-2xl border border-white/10 text-left hover:bg-white/10 transition-colors duration-300">
                <div className="flex text-brand-accent mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
                </div>
                <p className="text-white/80 mb-8 italic text-lg leading-relaxed">"{review.text}"</p>
                <div className="flex items-center gap-4 border-t border-white/10 pt-6">
                  <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center text-brand-accent font-bold text-xl font-serif border border-white/20">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{review.name}</h4>
                    <p className="text-xs text-brand-accent uppercase tracking-widest mt-1">{review.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Final Call to Action */}
      <section className="py-28 bg-brand-primary text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-15 mix-blend-overlay"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4">
          <h2 className="text-4xl md:text-6xl font-serif text-brand-accent mb-6 drop-shadow-md">Ready to Secure Your Legacy?</h2>
          <p className="text-xl md:text-2xl mb-12 text-white/90 font-light leading-relaxed">Discover the definitive standard of luxury living. Connect with our private advisors today to explore exclusive opportunities.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Link to="/contact" className="bg-brand-accent text-brand-dark px-10 py-5 font-bold rounded-sm shadow-xl hover:bg-white hover:scale-105 transition-all uppercase tracking-widest text-sm">Contact Private Sales</Link>
              <Link to="/projects" className="bg-transparent border-2 border-brand-accent text-brand-accent px-10 py-5 font-bold rounded-sm hover:bg-brand-accent hover:text-brand-dark transition-all uppercase tracking-widest text-sm">Explore Portfolio</Link>
            </div>
        </div>
      </section>

    </div>
  );
}
