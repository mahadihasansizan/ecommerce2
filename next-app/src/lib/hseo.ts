import { proxyRequest } from './woocommerce';
import { getSiteUrl } from './utils';

/**
 * Headless SEO (HSEO) Head Data Interface
 * Represents the SEO metadata returned from our custom HSEO REST API
 */
export interface HSEOHeadData {
  title: string;
  description: string;
  keywords?: string;
  canonical: string;
  og_title: string;
  og_description: string;
  og_image: string;
  og_url: string;
  og_type?: string;
  og_site_name?: string;
  twitter_card: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  robots: string;
  json_ld: Array<Record<string, any>>;
  // Additional fields that might be present
  [key: string]: any;
}

/**
 * Get HSEO head data for a specific URL path
 * @param path - The URL path (e.g., '/product/air-jordan-1' or '/categories/kitchenware')
 * @returns Promise with HSEO head data
 */
export const getHSEOHead = async (path: string): Promise<HSEOHeadData | null> => {
  try {
    // Normalize path - ensure it starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // HSEO REST API endpoint (via headless-proxy namespace)
    const WP_PROXY_BASE = process.env.VITE_WP_PROXY_BASE_URL || '/wp-json/headless-proxy/v1';
    const endpoint = `${WP_PROXY_BASE}/hseo/get?path=${encodeURIComponent(normalizedPath)}`;
    
    // Fetch HSEO data directly (not via proxy since it's already in the proxy namespace)
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      // 404 means no SEO data found - return null (not an error)
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HSEO API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if response is an error object
    if (data && data.code && data.message) {
      // WordPress REST API error format
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    // No debug logging - only log errors
    
    // Build HSEOHeadData object
    const headData: HSEOHeadData = {
      title: data.title || '',
      description: data.description || '',
      keywords: data.keywords || '',
      canonical: data.canonical || (getSiteUrl() + normalizedPath),
      og_title: data.og_title || data.title || '',
      og_description: data.og_description || data.description || '',
      og_image: data.og_image || '',
      og_url: data.og_url || data.canonical || (getSiteUrl() + normalizedPath),
      og_type: data.og_type || 'website',
      og_site_name: data.og_site_name || '',
      twitter_card: data.twitter_card || 'summary_large_image',
      twitter_title: data.twitter_title || data.og_title || data.title || '',
      twitter_description: data.twitter_description || data.og_description || data.description || '',
      twitter_image: data.twitter_image || data.og_image || '',
      robots: data.robots || 'index, follow',
      json_ld: Array.isArray(data.json_ld) ? data.json_ld : [],
    };
    
    return headData;
  } catch (error) {
    // Silently handle errors - HSEO might not be available
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'InvalidEndpointError')) {
      return null;
    }
    console.warn('Failed to fetch HSEO data:', error);
    return null;
  }
};

/**
 * Get HSEO data for current route
 * Helper function to construct path from route
 */
export const getHSEOHeadForRoute = async (path: string): Promise<HSEOHeadData | null> => {
  return getHSEOHead(path);
};

/**
 * Update HSEO data for an object
 * @param objectId - WordPress object ID (post ID, term ID, etc.)
 * @param objectType - Object type ('product', 'page', 'product_cat', etc.)
 * @param data - SEO data to save
 * @returns Promise with success status
 */
export const updateHSEOData = async (
  objectId: number,
  objectType: string,
  data: Partial<HSEOHeadData & { schema_data?: any; faq_data?: Array<{ question: string; answer: string }> }>
): Promise<boolean> => {
  try {
    const endpoint = `/hseo/update`;
    
    const payload = {
      object_id: objectId,
      object_type: objectType,
      ...data,
    };
    
    const response = await proxyRequest(endpoint, payload, 'POST');
    
    return response && response.success === true;
  } catch (error) {
    console.error('Failed to update HSEO data:', error);
    return false;
  }
};
