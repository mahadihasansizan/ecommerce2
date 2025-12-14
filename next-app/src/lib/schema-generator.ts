import { WooProduct, WooCategory } from './woocommerce';
import { getSiteUrl, getProductCanonicalUrl, getCategoryCanonicalUrl, stripHtml, getSiteNameSync } from './utils';

/**
 * Generate Product schema with Offer, AggregateRating, and Brand
 */
export const generateProductSchema = (product: WooProduct, slug: string): Record<string, any> => {
  const siteUrl = getSiteUrl();
  const productImages = product.images.map(img => img.src);
  const price = parseFloat(product.price) || 0;
  const currency = 'BDT'; // TODO: Get from store context
  const cleanDescription = stripHtml(product.description || product.short_description || '');

  const schema: Record<string, any> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": productImages.length > 0 ? productImages : [],
    "description": cleanDescription,
    "sku": product.sku || undefined,
    "url": getProductCanonicalUrl(slug),
  };

  // Add brand if available
  if (product.brand?.name) {
    schema.brand = {
      "@type": "Brand",
      "name": product.brand.name
    };
  }

  // Add offer (price, availability)
  if (price > 0) {
    schema.offers = {
      "@type": "Offer",
      "priceCurrency": currency,
      "price": price.toString(),
      "availability": product.stock_status === 'instock' 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "url": getProductCanonicalUrl(slug),
    };
  }

  // Add aggregate rating if available
  const ratingAvg = (product as any).meta?._msds_rating_avg || 
    product.meta_data?.find?.((m: any) => m.key === '_msds_rating_avg')?.value;
  const ratingCount = (product as any).meta?._msds_rating_count || 
    product.meta_data?.find?.((m: any) => m.key === '_msds_rating_count')?.value;
  
  if (ratingAvg && ratingCount && parseFloat(ratingCount) > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": parseFloat(ratingAvg).toString(),
      "reviewCount": parseInt(ratingCount).toString(),
    };
  }

  return schema;
};

/**
 * Generate BreadcrumbList schema
 */
export const generateBreadcrumbSchema = (
  items: Array<{ name: string; url: string }>
): Record<string, any> => {
  return {
    "@context": "https://schema.org/",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
};

/**
 * Generate Website schema for homepage
 */
export const generateWebsiteSchema = (): Record<string, any> => {
  const siteUrl = getSiteUrl();
  const siteName = getSiteNameSync();
  return {
    "@context": "https://schema.org/",
    "@type": "Website",
    "name": siteName,
    "url": siteUrl,
    "description": `Your One-Stop Shop - Discover the best products at ${siteName}`,
  };
};

/**
 * Generate Organization schema
 */
export const generateOrganizationSchema = (): Record<string, any> => {
  const siteUrl = getSiteUrl();
  const siteName = getSiteNameSync();
  return {
    "@context": "https://schema.org/",
    "@type": "Organization",
    "name": siteName,
    "url": siteUrl,
    "logo": `${siteUrl}/favicon.ico`,
  };
};

/**
 * Generate CollectionPage schema for category pages
 */
export const generateCollectionPageSchema = (
  category: WooCategory,
  productCount?: number
): Record<string, any> => {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org/",
    "@type": "CollectionPage",
    "name": category.name,
    "url": getCategoryCanonicalUrl(category.slug),
    "description": category.description ? stripHtml(category.description) : undefined,
    "numberOfItems": productCount,
  };
};

export const generateFAQSchema = (faqs: Array<{ question: string; answer: string }>): Record<string, any> => ({
  "@context": "https://schema.org/",
  "@type": "FAQPage",
  "mainEntity": faqs.map((faq) => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer,
    },
  })),
});
