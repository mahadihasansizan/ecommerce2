import { WP_BASE_URL } from './config';
import { proxyRequest } from './woocommerce';

/**
 * Yoast SEO Head Data Interface
 * Represents the SEO metadata returned from Yoast SEO REST API
 */
export interface YoastHeadData {
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
 * Yoast SEO REST API Response
 * The actual response structure from Yoast endpoint
 */
interface YoastAPIResponse {
  json?: {
    title?: string;
    description?: string;
    keywords?: string;
    canonical?: string;
    robots?: {
      index?: string;
      follow?: string;
      'max-snippet'?: string;
      'max-image-preview'?: string;
      'max-video-preview'?: string;
    };
    og_locale?: string;
    og_type?: string;
    og_title?: string;
    og_description?: string;
    og_url?: string;
    og_site_name?: string;
    og_image?: Array<{
      url?: string;
      width?: number;
      height?: number;
      type?: string;
    }>;
    twitter_card?: string;
    twitter_title?: string;
    twitter_description?: string;
    twitter_image?: string;
  };
  html?: string; // Full HTML head tags
  json_ld?: Array<Record<string, any>>; // Structured data
}

/**
 * Get Yoast SEO head data for a specific URL
 * @param url - The URL path (e.g., '/product/air-jordan-1' or full URL)
 * @returns Promise with Yoast head data
 */
export const getYoastHead = async (url: string): Promise<YoastHeadData | null> => {
  try {
    // Ensure URL is properly formatted
    let normalizedUrl = url;
    
    // If it's a relative path, make it absolute for Yoast API
    if (normalizedUrl.startsWith('/')) {
      // Get the site URL dynamically (multi-tenant support)
      let siteUrl: string;
      if (process.env.VITE_SITE_URL) {
        siteUrl = process.env.VITE_SITE_URL;
      } else if (typeof window !== 'undefined' && window.location) {
        siteUrl = `${window.location.protocol}//${window.location.host}`;
      } else {
        // Fallback to WordPress base URL for server-side
        siteUrl = WP_BASE_URL;
      }
      normalizedUrl = `${siteUrl}${normalizedUrl}`;
    }
    
    // Encode the URL for the query parameter
    const encodedUrl = encodeURIComponent(normalizedUrl);
    
    // Yoast SEO REST API endpoint
    const endpoint = `/yoast/v1/get_head?url=${encodedUrl}`;
    
    // Use proxyRequest to fetch Yoast data
    const response = await proxyRequest(endpoint, {}, 'GET');
    
    if (!response) {
      return null;
    }
    
    // Parse the response
    const yoastData: YoastAPIResponse = response;
    
    // No debug logging (Yoast SEO is deprecated, using HSEO instead)
    
    // Extract data from response
    const json = yoastData.json || {};
    const robots = json.robots || {};
    
    // Build robots meta string
    const robotsParts: string[] = [];
    if (robots.index) robotsParts.push(robots.index);
    if (robots.follow) robotsParts.push(robots.follow);
    if (robots['max-snippet']) robotsParts.push(`max-snippet:${robots['max-snippet']}`);
    if (robots['max-image-preview']) robotsParts.push(`max-image-preview:${robots['max-image-preview']}`);
    if (robots['max-video-preview']) robotsParts.push(`max-video-preview:${robots['max-video-preview']}`);
    const robotsString = robotsParts.length > 0 ? robotsParts.join(', ') : 'index, follow';
    
    // Extract OG image URL
    const ogImage = json.og_image?.[0]?.url || '';
    
    // Extract keywords from Yoast response
    // Keywords might be in json.keywords or need to be extracted from html
    let keywords = json.keywords || '';
    
    // If keywords not in json, try to extract from html meta tag
    if (!keywords && yoastData.html) {
      const keywordsMatch = yoastData.html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
      if (keywordsMatch && keywordsMatch[1]) {
        keywords = keywordsMatch[1];
      }
    }
    
    // Build YoastHeadData object
    const headData: YoastHeadData = {
      title: json.title || '',
      description: json.description || '',
      keywords: keywords,
      canonical: json.canonical || normalizedUrl,
      og_title: json.og_title || json.title || '',
      og_description: json.og_description || json.description || '',
      og_image: ogImage,
      og_url: json.og_url || normalizedUrl,
      og_type: json.og_type || 'website',
      og_site_name: json.og_site_name || 'KitchenHero',
      twitter_card: json.twitter_card || 'summary_large_image',
      twitter_title: json.twitter_title || json.og_title || json.title || '',
      twitter_description: json.twitter_description || json.og_description || json.description || '',
      twitter_image: json.twitter_image || ogImage,
      robots: robotsString,
      json_ld: yoastData.json_ld || [],
    };
    
    return headData;
  } catch (error) {
    // Silently handle errors - Yoast might not be available
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'InvalidEndpointError')) {
      return null;
    }
    console.warn('Failed to fetch Yoast SEO data:', error);
    return null;
  }
};

/**
 * Get Yoast SEO data for current route
 * Helper function to construct URL from route path
 */
export const getYoastHeadForRoute = async (path: string): Promise<YoastHeadData | null> => {
  return getYoastHead(path);
};
