'use client';

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Extend window interface for GA4
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const ScrollToTop = () => {
  const pathname = usePathname();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);

    // GA4 page view tracking for SPA navigation
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag('config', 'GTM-PJP38JVC', {
        page_path: pathname,
        page_title: document.title
      });
    }

    // Also push to dataLayer for GTM
    if (typeof window !== "undefined" && window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
        page_path: pathname,
        page_title: document.title
      });
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
