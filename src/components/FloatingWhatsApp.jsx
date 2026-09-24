import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';

export default function FloatingWhatsApp() {
  const { siteSettings } = useGlobalState();

  if (!siteSettings?.whatsappNumber) {
    return null; // Don't render if there's no number configured
  }

  // Ensure it only contains digits for the wa.me link
  const cleanNumber = siteSettings.whatsappNumber.replace(/\D/g, '');

  return (
    <a
      href={`https://wa.me/${cleanNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-lg shadow-[#25D366]/30 transition-all duration-300 hover:scale-110 flex items-center justify-center animate-bounce-slow"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle size={28} />
      <span className="absolute -top-1 -right-1 flex h-4 w-4">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-4 w-4 bg-white border-2 border-[#25D366]"></span>
      </span>
    </a>
  );
}
