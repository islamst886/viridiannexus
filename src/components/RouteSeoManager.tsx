import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyDocumentSeo, getSeoMetadataForPath } from '../utils/seo';

/**
 * Keeps document title, meta description, robots directive, canonical link,
 * Open Graph metadata, and Schema.org JSON-LD synchronized on every route transition.
 */
export default function RouteSeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyDocumentSeo(getSeoMetadataForPath(pathname));
  }, [pathname]);

  return null;
}
