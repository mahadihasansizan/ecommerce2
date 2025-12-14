import { cache } from 'react';
import { loadHomeData } from '@/ssr/loaders';
import HeroSection from '@/components/home/HeroSection';
import BestSellers from '@/components/home/BestSellers';
import AllProducts from '@/components/home/AllProducts';
import { generateOrganizationSchema, generateWebsiteSchema } from '@/lib/schema-generator';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils';
import { HSEOHeadData } from '@/lib/hseo';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || 'KitchenHero - Headless WooCommerce';
  const description = seoData?.description || 'Explore premium products from our WooCommerce catalog.';
  const canonical = seoData?.canonical || `${siteUrl}/`;
  const openGraphImage = seoData?.og_image || `${siteUrl}/favicon.ico`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: seoData?.og_url || canonical,
      images: openGraphImage ? [{ url: openGraphImage }] : undefined,
      siteName: seoData?.og_site_name || 'KitchenHero',
      type: normalizeOpenGraphType(seoData?.og_type) ?? 'website',
    },
    twitter: {
      card: normalizeTwitterCard(seoData?.twitter_card) ?? 'summary_large_image',
      title,
      description,
      images: seoData?.twitter_image || openGraphImage,
    },
  };
};

interface SchemaScriptsProps {
  data: Array<Record<string, any>>;
}

const SchemaScripts = ({ data }: SchemaScriptsProps) => (
  <>
    {data.map((item, idx) => (
      <script
        key={`structured-data-${idx}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(item, null, 2) }}
      />
    ))}
  </>
);

const homeData = cache(async () => loadHomeData());

const HomePage = async () => {
  const initialData = await homeData();
  const bestSellers = initialData['home:bestSellers'] || [];
  const allProducts = initialData['home:allProducts'] || [];
  const seoData = initialData['seo:/'] || null;

  const structuredData = [
    generateWebsiteSchema(),
    generateOrganizationSchema(),
    ...(seoData?.json_ld ?? []),
  ];

  return (
    <>
      <SchemaScripts data={structuredData} />
      <div className="container mx-auto px-4 py-2 text-left">
        <HeroSection />
        <BestSellers initialProducts={bestSellers} />
        <AllProducts initialProducts={allProducts} />
      </div>
    </>
  );
};

export async function generateMetadata(): Promise<Metadata> {
  const initialData = await homeData();
  return buildMetadataFromSeo(initialData['seo:/'] || null);
}

export default HomePage;
