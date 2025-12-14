import CategoriesClient from './CategoriesClient';
import { loadCategoriesPageData } from '@/ssr/loaders';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils';
import { HSEOHeadData } from '@/lib/hseo';
import { generateWebsiteSchema, generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/schema-generator';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || 'Categories - KitchenHero';
  const description = seoData?.description || 'Browse product categories from our WooCommerce catalog.';
  return {
    title,
    description,
    alternates: { canonical: seoData?.canonical || `${siteUrl}/categories` },
    openGraph: {
      title,
      description,
      url: seoData?.og_url || `${siteUrl}/categories`,
      images: seoData?.og_image ? [{ url: seoData.og_image }] : undefined,
      siteName: seoData?.og_site_name || 'KitchenHero',
      type: 'website',
    },
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadCategoriesPageData();
  return buildMetadataFromSeo(data['seo:/categories'] || null);
}

const CategoriesPage = async () => {
  const data = await loadCategoriesPageData();
  const categories = data['categories:list'] || [];
  const seoData = data['seo:/categories'] || null;
  const structuredData = [
    generateWebsiteSchema(),
    generateOrganizationSchema(),
    generateBreadcrumbSchema([
      { name: 'Home', url: getSiteUrl() },
      { name: 'Categories', url: `${getSiteUrl()}/categories` },
    ]),
    ...(seoData?.json_ld ?? []),
  ];

  return (
    <>
      <CategoriesClient categories={categories} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
};

export default CategoriesPage;
