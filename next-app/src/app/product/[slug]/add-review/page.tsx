import AddReviewClient from './AddReviewClient';
import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/utils';
import { HSEOHeadData, getHSEOHeadForRoute } from '@/lib/hseo';

const buildMetadataFromSeo = (slug: string, seo: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seo?.title || 'Add Review';
  const description = seo?.description || 'Share your review about this product.';
  const canonical = seo?.canonical || `${siteUrl}/product/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: seo?.og_url || canonical,
      images: seo?.og_image ? [{ url: seo.og_image }] : undefined,
      siteName: seo?.og_site_name || 'KitchenHero',
      type: 'website',
    },
  };
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const path = `/product/${params.slug}/add-review`;
  const seoData = await getHSEOHeadForRoute(path);
  return buildMetadataFromSeo(params.slug, seoData);
}

const AddReviewPage = ({ params }: { params: { slug: string } }) => {
  return <AddReviewClient slug={params.slug} />;
};

export default AddReviewPage;
