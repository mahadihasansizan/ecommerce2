import { getProducts, getCategories } from './woocommerce';
import { getSiteUrl, getProductCanonicalUrl, getCategoryCanonicalUrl } from './utils';
import { XMLBuilder } from 'fast-xml-parser';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: Array<{ loc: string; title?: string; caption?: string }>;
}

/**
 * Generate XML sitemap from URLs
 */
export const generateSitemapXML = (urls: SitemapUrl[]): string => {
  const urlElements = urls.map(url => {
    const urlElement: any = {
      loc: url.loc,
    };
    
    if (url.lastmod) {
      urlElement.lastmod = url.lastmod;
    }
    
    if (url.changefreq) {
      urlElement.changefreq = url.changefreq;
    }
    
    if (url.priority !== undefined) {
      urlElement.priority = url.priority.toString();
    }
    
    // Add images if present
    if (url.images && url.images.length > 0) {
      urlElement['image:image'] = url.images.map(img => ({
        'image:loc': img.loc,
        ...(img.title && { 'image:title': img.title }),
        ...(img.caption && { 'image:caption': img.caption }),
      }));
    }
    
    return { url: urlElement };
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true,
  });

  const sitemap = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    urlset: {
      '@_xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      '@_xmlns:image': 'http://www.google.com/schemas/sitemap-image/1.1',
      url: urlElements,
    },
  };

  return builder.build(sitemap);
};

/**
 * Fetch all sitemap URLs from WordPress
 * @param customSiteUrl - Optional custom site URL (for serverless functions)
 */
export const fetchSitemapUrls = async (customSiteUrl?: string): Promise<SitemapUrl[]> => {
  // Use custom URL if provided (for serverless functions), otherwise detect dynamically
  const siteUrl = customSiteUrl || getSiteUrl();
  const urls: SitemapUrl[] = [];
  
  try {
    // Add homepage
    urls.push({
      loc: siteUrl,
      changefreq: 'daily',
      priority: 1.0,
      lastmod: new Date().toISOString().split('T')[0],
    });

    // Add static pages
    const staticPages = [
      { path: '/products', priority: 0.9, changefreq: 'daily' as const },
      { path: '/categories', priority: 0.8, changefreq: 'weekly' as const },
      { path: '/faq', priority: 0.7, changefreq: 'monthly' as const },
      { path: '/contact', priority: 0.7, changefreq: 'monthly' as const },
    ];

    staticPages.forEach(page => {
      urls.push({
        loc: `${siteUrl}${page.path}`,
        changefreq: page.changefreq,
        priority: page.priority,
        lastmod: new Date().toISOString().split('T')[0],
      });
    });

    // Fetch all products
    try {
      let page = 1;
      let hasMore = true;
      const allProducts: any[] = [];

      while (hasMore) {
        const response = await getProducts({
          page,
          per_page: 100,
          status: 'publish',
        });

        if (Array.isArray(response) && response.length > 0) {
          allProducts.push(...response);
          page++;
          if (response.length < 100) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Add product URLs
      allProducts.forEach(product => {
        const productUrl = getProductCanonicalUrl(product.slug);
        const productImages = product.images?.map((img: any) => ({
          loc: img.src,
          title: product.name,
          caption: product.name,
        })) || [];

        urls.push({
          loc: productUrl,
          changefreq: 'weekly',
          priority: 0.8,
          lastmod: product.date_modified 
            ? new Date(product.date_modified).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          images: productImages.length > 0 ? productImages : undefined,
        });
      });
    } catch (error) {
      console.error('Error fetching products for sitemap:', error);
    }

    // Fetch all categories
    try {
      const categories = await getCategories();

      categories.forEach(category => {
        const categoryUrl = getCategoryCanonicalUrl(category.slug);
        const categoryImages = category.image?.src 
          ? [{
              loc: category.image.src,
              title: category.name,
              caption: category.name,
            }]
          : undefined;

        urls.push({
          loc: categoryUrl,
          changefreq: 'weekly',
          priority: 0.7,
          lastmod: new Date().toISOString().split('T')[0],
          images: categoryImages,
        });
      });
    } catch (error) {
      console.error('Error fetching categories for sitemap:', error);
    }

  } catch (error) {
    console.error('Error generating sitemap URLs:', error);
  }

  return urls;
};

/**
 * Generate complete sitemap XML
 * @param customSiteUrl - Optional custom site URL (for serverless functions)
 */
export const generateSitemap = async (customSiteUrl?: string): Promise<string> => {
  const urls = await fetchSitemapUrls(customSiteUrl);
  return generateSitemapXML(urls);
};
