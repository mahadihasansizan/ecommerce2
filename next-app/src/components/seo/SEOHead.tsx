import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePathname } from 'next/navigation';
import { HSEOHeadData } from '@/lib/hseo';
import {
  getCanonicalUrl,
  cleanPathForCanonical,
  getSiteUrl,
  getSiteNameSync,
  fetchSiteInfo,
} from '@/lib/utils';

interface SEOHeadProps {
  seoData?: HSEOHeadData | null;
  fallback?: {
    title?: string;
    description?: string;
    keywords?: string;
    canonical?: string;
    image?: string;
  };
  structuredData?: Record<string, any> | Array<Record<string, any>>;
  noindex?: boolean;
  nofollow?: boolean;
}

// Backward compatibility - support legacy yoastData prop
interface SEOHeadPropsLegacy {
  yoastData?: HSEOHeadData | null;
  fallback?: {
    title?: string;
    description?: string;
    keywords?: string;
    canonical?: string;
    image?: string;
  };
  structuredData?: Record<string, any> | Array<Record<string, any>>;
  noindex?: boolean;
  nofollow?: boolean;
}

/**
 * SEOHead Component
 * Renders comprehensive SEO metadata including:
 * - Title and meta description
 * - Canonical URL
 * - Open Graph tags
 * - Twitter Card tags
 * - Robots meta
 * - Structured data (JSON-LD)
 */
const SEOHead: React.FC<SEOHeadProps | SEOHeadPropsLegacy> = (props) => {
  // Support both new (seoData) and legacy (yoastData) prop names for backward compatibility
  const seoData = (props as SEOHeadProps).seoData || (props as SEOHeadPropsLegacy).yoastData;
  const { fallback, structuredData, noindex = false, nofollow = false } = props;
  
  const pathname = usePathname();
  const siteUrl = getSiteUrl();
  const [siteName, setSiteName] = useState(getSiteNameSync());

  // Fetch site name on mount
  useEffect(() => {
    fetchSiteInfo().then((info) => {
      setSiteName(info.site_name);
    });
  }, []);

  // Determine title
  const title = seoData?.title || fallback?.title || `${siteName} - Your One-Stop Shop`;
  
  // Determine description
  const description = seoData?.description || fallback?.description || `Discover the best products at ${siteName}.`;
  
  // Determine keywords
  const keywords = seoData?.keywords || fallback?.keywords;
  
  // Determine canonical URL
  let canonical = seoData?.canonical;
  if (!canonical) {
    canonical = fallback?.canonical || getCanonicalUrl(cleanPathForCanonical(pathname));
  }
  // Ensure canonical is absolute
  if (canonical && !canonical.startsWith('http')) {
    canonical = getCanonicalUrl(canonical);
  }
  
  // Determine OG image
  const ogImage = seoData?.og_image || fallback?.image || `${siteUrl}/favicon.ico`;
  // Ensure OG image is absolute
  const ogImageAbsolute = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`;
  
  // Determine OG URL
  const ogUrl = seoData?.og_url || canonical;
  
  // Determine robots meta
  let robots = seoData?.robots || 'index, follow';
  if (noindex) {
    robots = robots.replace(/index/g, 'noindex').replace(/follow/g, 'nofollow');
  }
  if (nofollow) {
    robots = robots.replace(/follow/g, 'nofollow');
  }
  
  // Collect all structured data
  const allStructuredData: Array<Record<string, any>> = [];
  
  // Add HSEO JSON-LD if available
  if (seoData?.json_ld && Array.isArray(seoData.json_ld)) {
    allStructuredData.push(...seoData.json_ld);
  }
  
  // No debug logging - only log errors if needed
  
  // Add custom structured data
  if (structuredData) {
    if (Array.isArray(structuredData)) {
      allStructuredData.push(...structuredData);
    } else {
      allStructuredData.push(structuredData);
    }
  }

  // Ensure we always have values (never render empty meta tags)
  const finalTitle = title || `${siteName} - Your One-Stop Shop`;
  const finalDescription = description || `Discover the best products at ${siteName}.`;

  // Ensure OG URL is absolute
  const ogUrlAbsolute = ogUrl && ogUrl.startsWith('http') ? ogUrl : `${siteUrl}${ogUrl.startsWith('/') ? ogUrl : `/${ogUrl}`}`;
  
  // Twitter image handling
  const twitterImage = seoData?.twitter_image || seoData?.og_image || fallback?.image;
  const twitterImageAbsolute = twitterImage 
    ? (twitterImage.startsWith('http') ? twitterImage : `${siteUrl}${twitterImage.startsWith('/') ? twitterImage : `/${twitterImage}`}`)
    : ogImageAbsolute;

  return (
    <Helmet>
      {/* Basic Meta Tags - Always rendered */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {keywords && keywords.trim() && <meta name="keywords" content={keywords.trim()} />}
      <meta name="robots" content={robots} />
      <meta name="author" content={siteName} />
      <meta name="generator" content="Headless Proxy Manager" />
      
      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph Tags - Always rendered */}
      <meta property="og:title" content={seoData?.og_title || finalTitle} />
      <meta property="og:description" content={seoData?.og_description || finalDescription} />
      {ogImageAbsolute && <meta property="og:image" content={ogImageAbsolute} />}
      <meta property="og:url" content={ogUrlAbsolute} />
      <meta property="og:type" content={seoData?.og_type || 'website'} />
      <meta property="og:site_name" content={seoData?.og_site_name || siteName} />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter Card Tags - Always rendered */}
      <meta name="twitter:card" content={seoData?.twitter_card || 'summary_large_image'} />
      <meta name="twitter:title" content={seoData?.twitter_title || seoData?.og_title || finalTitle} />
      <meta name="twitter:description" content={seoData?.twitter_description || seoData?.og_description || finalDescription} />
      {twitterImageAbsolute && <meta name="twitter:image" content={twitterImageAbsolute} />}
      
      {/* Additional SEO Meta Tags */}
      <meta name="theme-color" content="#ffffff" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      
      {/* Structured Data (JSON-LD) */}
      {allStructuredData.length > 0 && allStructuredData.map((data, index) => (
        <script
          key={`structured-data-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data, null, 2) }}
        />
      ))}
    </Helmet>
  );
};

export default SEOHead;
