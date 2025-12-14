/**
 * Multi-Tenant Configuration
 * This file handles tenant-specific settings that can be configured per domain
 */

import { getSiteNameSync, getSiteNameFromAPI } from './utils';

/**
 * Get tenant configuration based on current domain
 * This allows different domains to have different settings
 */
export const getTenantConfig = () => {
  // Get current domain dynamically
  let domain = '';
  
  if (typeof window !== 'undefined' && window.location) {
    domain = window.location.hostname;
  } else if (process.env.VITE_SITE_URL) {
    try {
      const url = new URL(process.env.VITE_SITE_URL);
      domain = url.hostname;
    } catch {
      // Invalid URL, use default
    }
  }

  // Default configuration (can be overridden per domain)
  // Site name will be fetched dynamically from API
  const defaultConfig = {
    siteName: getSiteNameSync(), // Use dynamic site name
    contactEmail: 'info@example.com', // Update with your default email
    supportEmail: 'support@example.com', // Update with your default support email
    phone: '+880 1835868877',
    facebookUrl: 'https://www.facebook.com',
    instagramUrl: 'https://www.instagram.com',
    address: 'Dhaka, Bangladesh',
  };

  type TenantConfig = typeof defaultConfig;

  // Domain-specific overrides
  // You can add domain-specific configurations here
  const domainConfigs: Record<string, Partial<typeof defaultConfig>> = {
    // Add domain-specific configs as needed
  };

  // Merge overrides into the default configuration so required fields stay populated
  return {
    ...defaultConfig,
    ...(domainConfigs[domain] || {}),
  } as TenantConfig;
};

/**
 * Get contact email for the current tenant
 */
export const getContactEmail = (): string => {
  return getTenantConfig().contactEmail;
};

/**
 * Get support email for the current tenant
 */
export const getSupportEmail = (): string => {
  return getTenantConfig().supportEmail;
};

/**
 * Get site name for the current tenant (synchronous - uses cached value)
 */
export const getSiteName = (): string => {
  return getTenantConfig().siteName;
};

/**
 * Get site name asynchronously from API (preferred method)
 */
export const getSiteNameAsync = async (): Promise<string> => {
  return await getSiteNameFromAPI();
};

/**
 * Get social media URLs for the current tenant
 */
export const getSocialUrls = () => {
  const config = getTenantConfig();
  return {
    facebook: config.facebookUrl,
    instagram: config.instagramUrl,
  };
};
