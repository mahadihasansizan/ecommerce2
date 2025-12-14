import ContactClient from './ContactClient';
import type { Metadata } from 'next';
import { getSiteName } from '@/lib/tenant-config';
import { getSiteUrl } from '@/lib/utils';
import { getHSEOHeadForRoute, HSEOHeadData } from '@/lib/hseo';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || `Contact - ${getSiteName()}`;
  const description =
    seoData?.description || `Reach out to ${getSiteName()} for personalized support.`;

  return {
    title,
    description,
    alternates: { canonical: seoData?.canonical || `${siteUrl}/contact` },
    openGraph: {
      title,
      description,
      url: seoData?.og_url || `${siteUrl}/contact`,
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
  const seoData = await getHSEOHeadForRoute('/contact');
  return buildMetadataFromSeo(seoData);
}

const ContactPage = () => <ContactClient />;

export default ContactPage;
