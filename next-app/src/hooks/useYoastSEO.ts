import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getHSEOHeadForRoute, HSEOHeadData } from '@/lib/hseo';
import { useSSRData } from '@/ssr/initial-data';

/**
 * React hook to fetch Headless SEO (HSEO) data for the current route
 * @param customPath - Optional custom path to fetch SEO for (defaults to current location)
 * @returns HSEO head data and loading state
 */
export const useHeadlessSEO = (customPath?: string) => {
  const pathname = usePathname();
  const targetPath = customPath || pathname;
  const initialSeo = useSSRData<HSEOHeadData | null>(`seo:${targetPath}`);
  const [seoData, setSeoData] = useState<HSEOHeadData | null>(initialSeo || null);
  const [loading, setLoading] = useState(!initialSeo);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSEOData = async () => {
      if (initialSeo) {
        setSeoData(initialSeo);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Use custom path if provided, otherwise use current location
        const path = targetPath;
        
        // Fetch HSEO data for the current path
        const data = await getHSEOHeadForRoute(path);
        
        setSeoData(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch HSEO data');
        console.error('useHeadlessSEO: Error fetching HSEO data:', error);
        setError(error);
        setSeoData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSEOData();
  }, [location.pathname, customPath, initialSeo, targetPath]);

  return {
    seoData,
    loading,
    error,
  };
};

/**
 * @deprecated Use useHeadlessSEO instead
 * Kept for backward compatibility
 */
export const useYoastSEO = useHeadlessSEO;

/**
 * @deprecated Use HSEOHeadData instead
 * Kept for backward compatibility
 */
export type YoastHeadData = HSEOHeadData;
