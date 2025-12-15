import type { Metadata } from 'next';
import { Suspense } from 'react';
import OrderConfirmationClient from './OrderConfirmationClient';
import { getSiteName } from '@/lib/tenant-config';
import { getSiteUrl } from '@/lib/utils';
import { getHSEOHeadForRoute, HSEOHeadData } from '@/lib/hseo';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || `Order Confirmation - ${getSiteName()}`;
  const description = seoData?.description || 'Thank you! Your order is confirmed and being processed.';
  const canonical = seoData?.canonical || `${siteUrl}/order-confirmation`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: seoData?.og_url || canonical,
      images: seoData?.og_image ? [{ url: seoData.og_image }] : undefined,
      siteName: seoData?.og_site_name || getSiteName(),
      type: normalizeOpenGraphType(seoData?.og_type) ?? 'website',
    },
    twitter: {
      card: normalizeTwitterCard(seoData?.twitter_card) ?? 'summary_large_image',
      title,
      description,
      images: seoData?.twitter_image || seoData?.og_image,
    },
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const seoData = await getHSEOHeadForRoute('/order-confirmation');
  return buildMetadataFromSeo(seoData);
}

const OrderConfirmationPage = () => (
  <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading...</div>}>
    <OrderConfirmationClient />
  </Suspense>
);

export default OrderConfirmationPage;
