import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, Bell, Heart, User, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { useGlobalState } from '../context/GlobalState';

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const { user, wishlist, notifications, markNotificationsRead } = useGlobalState();

  const unreadCount = notifications.filter(n => !n.read).length;

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Project', path: '/project' },
    { name: 'Location', path: '/location' },
    { name: 'Live', path: '/live-cameras' },
    { name: '360° Tour', path: '/virtual-tour' },
    { name: 'Booking', path: '/booking' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-brand-neutral font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-brand-dark shadow-md border-b border-brand-primary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-brand-primary rounded-sm flex items-center justify-center border border-brand-accent/50">
                <span className="text-brand-accent font-serif font-bold text-xl">V</span>
              </div>
              <span className="font-serif text-2xl font-bold text-brand-neutral tracking-wide hidden sm:block">
                Viridian<span className="text-brand-accent">Nexus</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden xl:flex space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "text-sm uppercase tracking-wider font-semibold transition-colors duration-300 flex items-center h-20",
                    location.pathname === link.path
                      ? "text-brand-accent border-b-2 border-brand-accent"
                      : "text-brand-neutral hover:text-brand-accent"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-4 md:space-x-6">
              {/* Wishlist */}
              <Link to="/dashboard/wishlist" className="relative text-brand-neutral hover:text-brand-accent transition-colors">
                <Heart size={24} />
                {wishlist.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-accent text-brand-dark text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Notifications */}
              <button 
                onClick={markNotificationsRead}
                className="relative text-brand-neutral hover:text-brand-accent transition-colors"
              >
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* User Profile Dropdown */}
              <div className="relative hidden md:block">
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 text-brand-neutral hover:text-brand-accent focus:outline-none"
                >
                  <img src={user.avatar} alt="Profile" className="w-8 h-8 rounded-full bg-brand-primary/20" />
                  <span className="text-sm font-semibold">{user.name}</span>
                  <ChevronDown size={16} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                    <Link to="/dashboard" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Dashboard</Link>
                    <Link to="/dashboard/bidding" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Live Auctions</Link>
                    <Link to="/dashboard/wishlist" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Wishlist</Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Sign out</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="xl:hidden text-brand-neutral hover:text-brand-accent focus:outline-none ml-2"
              >
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="xl:hidden bg-brand-dark/95 backdrop-blur-sm border-t border-brand-primary/20">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-base font-medium tracking-wide uppercase",
                    location.pathname === link.path
                      ? "text-brand-accent bg-brand-primary/10"
                      : "text-brand-neutral hover:text-brand-accent hover:bg-brand-primary/5"
                  )}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 text-base font-medium tracking-wide uppercase text-brand-neutral hover:text-brand-accent hover:bg-brand-primary/5">Dashboard</Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Global Footer */}
      <footer className="bg-brand-dark text-brand-neutral py-12 border-t border-brand-primary/30 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-serif text-brand-accent mb-4">Viridian Nexus</h3>
            <p className="text-sm text-brand-neutral/80 leading-relaxed">
              Redefining Elite Living in Jolshiri Abashon. A 2,860 sq. ft. masterpiece where natural ecology meets modern luxury.
            </p>
            <div className="mt-4 text-xs text-brand-neutral/60">
              RAJUK Approval Code: RJ-VN-2024-88A<br />
              BNBC 2020 Compliant
            </div>
          </div>
          <div>
            <h3 className="text-xl font-serif text-brand-accent mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm grid grid-cols-2">
              <li><Link to="/project" className="hover:text-brand-accent transition-colors">The Masterpiece</Link></li>
              <li><Link to="/progress" className="hover:text-brand-accent transition-colors">Project Progress</Link></li>
              <li><Link to="/virtual-tour" className="hover:text-brand-accent transition-colors">Virtual Tour</Link></li>
              <li><Link to="/live-cameras" className="hover:text-brand-accent transition-colors">Live Cameras</Link></li>
              <li><Link to="/booking" className="hover:text-brand-accent transition-colors">Online Booking</Link></li>
              <li><Link to="/contact" className="hover:text-brand-accent transition-colors">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-serif text-brand-accent mb-4">Exclusive Newsletter</h3>
            <p className="text-sm text-brand-neutral/80 mb-4">For High-Net-Worth Individuals. Receive structural updates and investment insights.</p>
            <form className="flex">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="bg-brand-neutral/10 border border-brand-primary/30 text-white px-4 py-2 w-full focus:outline-none focus:border-brand-accent"
              />
              <button 
                type="button" 
                className="bg-brand-primary text-white px-4 py-2 hover:bg-brand-primary/80 transition-colors"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-8 pt-8 border-t border-brand-primary/20 text-center text-xs text-brand-neutral/50">
          &copy; {new Date().getFullYear()} Viridian Nexus. All Rights Reserved. Adheres to Real Estate Development and Management Act 2010.
        </div>
      </footer>
    </div>
  );
}
