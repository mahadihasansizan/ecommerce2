import ProductsClient from './ProductsClient';
import { loadProductsPageData } from '@/ssr/loaders';
import { generateOrganizationSchema, generateWebsiteSchema } from '@/lib/schema-generator';
import type { Metadata } from 'next';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { getSiteUrl } from '@/lib/utils';
import { HSEOHeadData } from '@/lib/hseo';
import { normalizeOpenGraphType, normalizeTwitterCard } from '@/lib/metadata-utils';
import { Suspense } from 'react';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || 'Products - KitchenHero';
  const description = seoData?.description || 'Browse our curated WooCommerce catalog.';
  const canonical = seoData?.canonical || `${siteUrl}/products`;
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

const buildUrl = (searchParams: URLSearchParams) => {
  const path = '/products';
  const url = new URL('http://localhost' + path);
  searchParams.forEach((value, key) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

const normalizeSearchParams = (searchParams?: ReadonlyURLSearchParams): URLSearchParams => {
  const params = new URLSearchParams();
  if (!searchParams) return params;

  if (typeof (searchParams as any).entries === 'function') {
    for (const [key, value] of (searchParams as any).entries()) {
      params.append(key, value);
    }
    return params;
  }

  const entries = Object.entries(searchParams as unknown as Record<string, string | string[] | undefined>);
  entries.forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => v && params.append(key, v));
    } else if (typeof value !== 'undefined') {
      params.append(key, value);
    }
  });

  return params;
};

export async function generateMetadata({ searchParams }: { searchParams?: ReadonlyURLSearchParams }): Promise<Metadata> {
  const params = normalizeSearchParams(searchParams);
  const data = await loadProductsPageData(buildUrl(params));
  return buildMetadataFromSeo(data['seo:/products'] || null);
}

const ProductsPage = async ({ searchParams }: { searchParams?: ReadonlyURLSearchParams }) => {
  const params = normalizeSearchParams(searchParams);
  const data = await loadProductsPageData(buildUrl(params));
  const list = data['products:list'];
  if (!list) {
    return <div className="p-8 text-center">No products available right now.</div>;
  }

  return (
    <>
      <Suspense
        fallback={
          <div className="grid min-h-[50vh] place-items-center">
            <p className="text-muted-foreground">Loading products…</p>
          </div>
        }
      >
        <ProductsClient
        products={list.products}
        total={list.total}
        categories={list.categories}
        activeCategory={list.categorySlug}
        initialSort={list.sortBy}
      />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            generateWebsiteSchema(),
            generateOrganizationSchema(),
          ]),
        }}
      />
    </>
  );
};

export default ProductsPage;
