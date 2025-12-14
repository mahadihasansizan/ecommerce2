'use client';

import { useState, useEffect } from 'react';
import { fetchSiteInfo, getSiteNameSync } from '@/lib/utils';

interface SiteInfo {
  site_name: string;
  store_base_url: string;
  site_url: string;
}

/**
 * Hook to get site information dynamically from the API
 * Returns cached values for performance
 */
export const useSiteInfo = () => {
  const [siteInfo, setSiteInfo] = useState<SiteInfo>({
    site_name: getSiteNameSync(),
    store_base_url: '',
    site_url: '',
  });

  useEffect(() => {
    fetchSiteInfo().then((info) => {
      setSiteInfo(info);
    });
  }, []);

  return siteInfo;
};

/**
 * Hook to get just the site name (simpler API)
 */
export const useSiteName = (): string => {
  const { site_name } = useSiteInfo();
  return site_name;
};
