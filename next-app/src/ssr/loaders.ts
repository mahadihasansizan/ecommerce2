import { getHSEOHeadForRoute } from '@/lib/hseo';
import {
  getCategories,
  getProductBySlug,
  getProducts,
  getProductsWithMeta,
  WooCategory,
} from '@/lib/woocommerce';
import { mapMetaToProduct } from '@/lib/utils';
import { InitialData } from './initial-data';

type LoaderParams = Record<string, string | undefined>;

const HOME_PAGE_SIZE = 10;
const PRODUCT_LIST_PAGE_SIZE = 26;
const CATEGORY_PAGE_SIZE = 20;

const parseUrl = (url: string) => {
  try {
    // Ensure we always get a full URL that URL() can parse
    return new URL(url, 'http://localhost');
  } catch {
    return new URL('http://localhost');
  }
};

export async function loadHomeData(): Promise<InitialData> {
  const [seoData, bestSellers, allProducts] = await Promise.all([
    getHSEOHeadForRoute('/'),
    getProducts({
      per_page: HOME_PAGE_SIZE,
      orderby: 'popularity',
      order: 'desc',
      status: 'publish',
    }),
    getProducts({
      page: 1,
      per_page: HOME_PAGE_SIZE,
      status: 'publish',
      orderby: 'date',
      order: 'desc',
    }),
  ]);

  return {
    'seo:/': seoData,
    'home:bestSellers': (bestSellers || []).slice(0, HOME_PAGE_SIZE),
    'home:allProducts': allProducts || [],
  };
}

export async function loadProductPageData(
  params: LoaderParams
): Promise<InitialData> {
  const slug = params.slug;
  if (!slug) return {};

  const path = `/product/${slug}`;
  const [product, seoData] = await Promise.all([
    getProductBySlug(slug),
    getHSEOHeadForRoute(path),
  ]);

  return {
    [`product:${slug}`]: {
      product: product ? mapMetaToProduct(product) : null,
      seo: seoData,
    },
    [`seo:${path}`]: seoData,
  };
}

export async function loadProductsPageData(url: string): Promise<InitialData> {
  const parsed = parseUrl(url);
  const search = parsed.searchParams;
  const categorySlug = search.get('category') || 'all';
  const sortBy = search.get('orderby') || 'date';

  const categories = await getCategories();
  const categoryMatch = categories.find((c) => c.slug === categorySlug);

  const sortOptions = (() => {
    switch (sortBy) {
      case 'price-asc':
        return { orderby: 'price', order: 'asc' as const };
      case 'price-desc':
        return { orderby: 'price', order: 'desc' as const };
      case 'title-asc':
        return { orderby: 'title', order: 'asc' as const };
      case 'title-desc':
        return { orderby: 'title', order: 'desc' as const };
      case 'popularity':
      case 'rating':
        return { orderby: 'date', order: 'desc' as const };
      case 'date':
      default:
        return { orderby: 'date', order: 'desc' as const };
    }
  })();

  const params: Record<string, string | number> = {
    page: 1,
    per_page: PRODUCT_LIST_PAGE_SIZE,
    status: 'publish',
    ...sortOptions,
  };

  if (categoryMatch) {
    params.category = categoryMatch.id.toString();
  }

  const [productResponse, seoData] = await Promise.all([
    getProductsWithMeta(params),
    getHSEOHeadForRoute(parsed.pathname),
  ]);

  return {
    [`seo:${parsed.pathname}`]: seoData,
    'products:list': {
      products: productResponse.products || [],
      total: productResponse.total ?? productResponse.products?.length ?? 0,
      categories,
      sortBy,
      categorySlug,
    },
  };
}

export async function loadCategoriesPageData(): Promise<InitialData> {
  const [seoData, categories] = await Promise.all([
    getHSEOHeadForRoute('/categories'),
    getCategories(),
  ]);

  return {
    'seo:/categories': seoData,
    'categories:list': categories || [],
  };
}

export async function loadSingleCategoryData(
  params: LoaderParams
): Promise<InitialData> {
  const slug = params.slug;
  if (!slug) return {};

  const categories = await getCategories();
  const category = categories.find((cat: WooCategory) => cat.slug === slug);
  const path = `/categories/${slug}`;

  if (!category) {
    const seoData = await getHSEOHeadForRoute(path);
    return {
      [`seo:${path}`]: seoData,
      [`category:${slug}`]: null,
    };
  }

  const sortOptions = { orderby: 'date', order: 'desc' as const };

  const [productsResponse, seoData] = await Promise.all([
    getProductsWithMeta({
      page: 1,
      per_page: CATEGORY_PAGE_SIZE,
      category: category.id.toString(),
      status: 'publish',
      ...sortOptions,
    }),
    getHSEOHeadForRoute(path),
  ]);

  return {
    [`seo:${path}`]: seoData,
    [`category:${slug}`]: {
      category,
      products: productsResponse.products || [],
      total: productsResponse.total ?? productsResponse.products?.length ?? 0,
    },
  };
}
