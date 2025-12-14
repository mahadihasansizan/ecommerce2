import ProductCard from '@/components/product/ProductCard';
import { loadSingleCategoryData } from '@/ssr/loaders';
import type { Metadata } from 'next';
import { HSEOHeadData } from '@/lib/hseo';
import { getSiteUrl } from '@/lib/utils';
import { generateCollectionPageSchema, generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/schema-generator';

const buildMetadataFromSeo = (seoData: HSEOHeadData | null, slug: string): Metadata => {
  const siteUrl = getSiteUrl();
  const title = seoData?.title || 'Category Detail';
  const description = seoData?.description || 'Browse this product category.';
  return {
    title,
    description,
    alternates: {
      canonical: seoData?.canonical || `${siteUrl}/categories/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: seoData?.og_url || `${siteUrl}/categories/${slug}`,
      images: seoData?.og_image ? [{ url: seoData.og_image }] : undefined,
      siteName: seoData?.og_site_name || 'KitchenHero',
      type: 'website',
    },
  };
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadSingleCategoryData({ slug: params.slug });
  return buildMetadataFromSeo(data[`seo:/categories/${params.slug}`] || null, params.slug);
}

const CategoryPage = async ({ params }: { params: { slug: string } }) => {
  const response = await loadSingleCategoryData({ slug: params.slug });
  const entry = response[`category:${params.slug}`];

  if (!entry || !entry.category) {
    return <div className="p-8 text-center">Category not found.</div>;
  }

  const seoData = response[`seo:/categories/${params.slug}`] || null;
  const structuredData = [
    generateBreadcrumbSchema([
      { name: 'Home', url: getSiteUrl() },
      { name: 'Categories', url: `${getSiteUrl()}/categories` },
      { name: entry.category.name, url: `${getSiteUrl()}/categories/${entry.category.slug}` },
    ]),
    generateOrganizationSchema(),
    generateCollectionPageSchema(entry.category, entry.products?.length),
    ...(seoData?.json_ld ?? []),
  ];

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Category</p>
            <h1 className="text-3xl font-bold">{entry.category.name}</h1>
            {entry.category.description && (
              <p className="text-muted-foreground max-w-2xl">{entry.category.description}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm">
              {entry.total ?? entry.products?.length ?? 0} products available
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {entry.products?.map((product: any) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
};

export default CategoryPage;
