import ProductDetailClient from './ProductDetailClient';
import { loadProductPageData } from '@/ssr/loaders';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils';
import { HSEOHeadData } from '@/lib/hseo';
import { generateProductSchema, generateOrganizationSchema } from '@/lib/schema-generator';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null, slug: string): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || 'Product Detail';
  const description = seoData?.description || 'Discover this product from our WooCommerce catalog.';
  const canonical = seoData?.canonical || `${siteUrl}/product/${slug}`;
  const ogImage = seoData?.og_image || `${siteUrl}/favicon.ico`;

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
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: seoData?.og_site_name || 'KitchenHero',
      type: normalizeOpenGraphType(seoData?.og_type) ?? 'website',
    },
    twitter: {
      card: normalizeTwitterCard(seoData?.twitter_card) ?? 'summary_large_image',
      title,
      description,
      images: seoData?.twitter_image || ogImage,
    },
  };
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await loadProductPageData({ slug: resolvedParams.slug });
  const seo = data[`seo:/product/${resolvedParams.slug}`] || null;
  return buildMetadataFromSeo(seo, resolvedParams.slug);
}

const ProductPage = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const resolvedParams = await params;
  const data = await loadProductPageData({ slug: resolvedParams.slug });
  const entry = data[`product:${resolvedParams.slug}`];
  if (!entry?.product) {
    return <div className="p-8 text-center">Product not found.</div>;
  }

  const seo = data[`seo:/product/${resolvedParams.slug}`] || null;
  const structuredData = [
    generateProductSchema(entry.product, resolvedParams.slug),
    generateOrganizationSchema(),
    ...(seo?.json_ld ?? []),
  ];

  return (
    <>
      <ProductDetailClient product={entry.product} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
};

export default ProductPage;
