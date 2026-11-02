import React, { useState, useMemo } from 'react';
import { useGlobalState } from '../context/GlobalState';
import { usePropertyTypes } from '../hooks/usePropertyTypes';

// Modular Home Components
import HeroShowcase from '../components/home/HeroShowcase';
import ConciergeSearch from '../components/home/ConciergeSearch';
import FeaturedResidences from '../components/home/FeaturedResidences';
import ArchitecturalEthos from '../components/home/ArchitecturalEthos';
import NeighborhoodsExplorer from '../components/home/NeighborhoodsExplorer';
import PropTechShowcase from '../components/home/PropTechShowcase';
import SignatureAmenities from '../components/home/SignatureAmenities';
import NrbGateway from '../components/home/NrbGateway';
import InvestmentCalculator from '../components/home/InvestmentCalculator';
import InstitutionalProof from '../components/home/InstitutionalProof';
import ClientTestimonials from '../components/home/ClientTestimonials';
import JournalEditorial from '../components/home/JournalEditorial';
import HomeCta from '../components/home/HomeCta';
import VipConsultationModal from '../components/home/VipConsultationModal';

export default function Home() {
  const { 
    properties = [], 
    loadingProperties = false, 
    wishlist = [], 
    toggleWishlist 
  } = useGlobalState();
  
  const { types: propertyTypes = [] } = usePropertyTypes();

  // Modal State for Private VIP Consultation / Site Viewing
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [targetProperty, setTargetProperty] = useState('');

  const handleOpenVipModal = (propertyTitle = '') => {
    setTargetProperty(propertyTitle);
    setVipModalOpen(true);
  };

  const handleCloseVipModal = () => {
    setVipModalOpen(false);
    setTargetProperty('');
  };

  // Dynamically derive unique locations and statuses from loaded properties
  const locations = useMemo(() => {
    return [...new Set(properties.map(p => p.location).filter(Boolean))];
  }, [properties]);

  const statuses = useMemo(() => {
    return [...new Set(properties.map(p => p.status).filter(Boolean))];
  }, [properties]);

  return (
    <div className="flex flex-col w-full bg-brand-neutral selection:bg-brand-primary selection:text-white">
      
      {/* 1. Cinematic Hero Showcase */}
      <HeroShowcase onOpenVipModal={handleOpenVipModal} />

      {/* 2. Concierge Discovery & Filter Console */}
      <ConciergeSearch 
        locations={locations}
        propertyTypes={propertyTypes}
        statuses={statuses}
      />

      {/* 3. Featured Signature Residences */}
      <FeaturedResidences 
        properties={properties}
        loading={loadingProperties}
        wishlist={wishlist}
        toggleWishlist={toggleWishlist}
        onOpenVipModal={handleOpenVipModal}
      />

      {/* 4. The Viridian Distinction — Biophilic Ethos & Structural Engineering */}
      <ArchitecturalEthos />

      {/* 5. Prime Micro-Markets & Coveted Enclaves */}
      <NeighborhoodsExplorer />

      {/* 6. Digital Innovation & Remote Transparency (360 VR & 24/7 Live Cams) */}
      <PropTechShowcase />

      {/* 7. Hotel-Grade Curated Amenities & Privileges */}
      <SignatureAmenities />

      {/* 8. NRB & International Investor Gateway (NITA & Legal Framework) */}
      <NrbGateway onOpenVipModal={handleOpenVipModal} />

      {/* 9. Interactive Investment & Installment Estimator */}
      <InvestmentCalculator onOpenVipModal={handleOpenVipModal} />

      {/* 10. Quantitative Proof & Corporate Accreditations */}
      <InstitutionalProof />

      {/* 11. The Discerning Circle — Resident & Investor Endorsements */}
      <ClientTestimonials />

      {/* 12. The Viridian Journal — Architectural & Market Intelligence */}
      <JournalEditorial onOpenVipModal={handleOpenVipModal} />

      {/* 13. Grand Brand Call to Action */}
      <HomeCta onOpenVipModal={handleOpenVipModal} />

      {/* Private VIP Consultation & Site Visit Modal */}
      <VipConsultationModal 
        isOpen={vipModalOpen}
        onClose={handleCloseVipModal}
        defaultProperty={targetProperty}
      />

    </div>
  );
}
