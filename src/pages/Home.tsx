import { useMemo, useState } from 'react';
import ArchitecturalEthos from '../components/home/ArchitecturalEthos';
import ClientTestimonials from '../components/home/ClientTestimonials';
import ConciergeSearch from '../components/home/ConciergeSearch';
import FeaturedResidences from '../components/home/FeaturedResidences';
import HeroShowcase from '../components/home/HeroShowcase';
import HomeCta from '../components/home/HomeCta';
import InstitutionalProof from '../components/home/InstitutionalProof';
import InvestmentCalculator from '../components/home/InvestmentCalculator';
import JournalEditorial from '../components/home/JournalEditorial';
import NeighborhoodsExplorer from '../components/home/NeighborhoodsExplorer';
import NrbGateway from '../components/home/NrbGateway';
import PropTechShowcase from '../components/home/PropTechShowcase';
import SignatureAmenities from '../components/home/SignatureAmenities';
import VipConsultationModal from '../components/home/VipConsultationModal';
import { useGlobalState } from '../context/GlobalState';
import { usePropertyTypes } from '../hooks/usePropertyTypes';

export default function Home() {
  const {
    properties = [],
    loadingProperties = false,
    wishlist = [],
    toggleWishlist,
  } = useGlobalState();

  const { types: propertyTypes = [] } = usePropertyTypes();

  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [targetProperty, setTargetProperty] = useState('');

  const handleOpenVipModal = (propertyTitle = ''): void => {
    setTargetProperty(propertyTitle);
    setVipModalOpen(true);
  };

  const handleCloseVipModal = (): void => {
    setVipModalOpen(false);
    setTargetProperty('');
  };

  const locations = useMemo(() => {
    return [...new Set(properties.map((p) => p.location).filter(Boolean))];
  }, [properties]);

  const statuses = useMemo(() => {
    return [...new Set(properties.map((p) => p.status).filter(Boolean))];
  }, [properties]);

  return (
    <div className="flex flex-col w-full bg-brand-neutral selection:bg-brand-primary selection:text-white">
      <HeroShowcase onOpenVipModal={handleOpenVipModal} />

      <ConciergeSearch
        locations={locations}
        propertyTypes={propertyTypes}
        _statuses={statuses}
      />

      <FeaturedResidences
        properties={properties}
        loading={loadingProperties}
        wishlist={wishlist}
        toggleWishlist={toggleWishlist}
        onOpenVipModal={handleOpenVipModal}
      />

      <ArchitecturalEthos />

      <NeighborhoodsExplorer />

      <PropTechShowcase />

      <SignatureAmenities />

      <NrbGateway onOpenVipModal={handleOpenVipModal} />

      <InvestmentCalculator onOpenVipModal={handleOpenVipModal} />

      <InstitutionalProof />

      <ClientTestimonials />

      <JournalEditorial />

      <HomeCta onOpenVipModal={handleOpenVipModal} />

      <VipConsultationModal
        isOpen={vipModalOpen}
        onClose={handleCloseVipModal}
        defaultProperty={targetProperty}
      />
    </div>
  );
}
