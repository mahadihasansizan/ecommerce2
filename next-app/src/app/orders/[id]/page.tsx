import type { Metadata } from 'next';
import OrderDetailClient from '../OrderDetailClient';
import { generateOrganizationSchema, generateWebsiteSchema } from '@/lib/schema-generator';
import { getHSEOHeadForRoute, type HSEOHeadData } from '@/lib/hseo';
import { getSiteUrl } from '@/lib/utils';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null, orderId: string): Metadata => {
  const siteUrl = getSiteUrl();
  const siteName = seoData?.og_site_name || 'KitchenHero';
  const title = seoData?.title || `Order #${orderId} | ${siteName}`;
  const description = seoData?.description || `Track the status and details of order ${orderId}.`;
  const canonical = seoData?.canonical || `${siteUrl}/orders/${orderId}`;

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
      images: seoData?.og_image ? [{ url: seoData.og_image }] : undefined,
      siteName,
      type: normalizeOpenGraphType(seoData?.og_type) ?? 'website',
    },
    twitter: {
      card: normalizeTwitterCard(seoData?.twitter_card) ?? 'summary_large_image',
      title,
      description,
      images: seoData?.twitter_image || seoData?.og_image || `${siteUrl}/favicon.ico`,
    },
  };
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const seoPath = `/orders/${params.id}`;
  const seoData = await getHSEOHeadForRoute(seoPath);
  return buildMetadataFromSeo(seoData, params.id);
}

const OrderDetailPage = async ({ params }: { params: { id: string } }) => {
  const seoPath = `/orders/${params.id}`;
  const seoData = await getHSEOHeadForRoute(seoPath);
  const structuredData = [
    generateWebsiteSchema(),
    generateOrganizationSchema(),
    ...(seoData?.json_ld ?? []),
  ];

  return (
    <>
      <OrderDetailClient orderId={params.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
};

export default OrderDetailPage;
