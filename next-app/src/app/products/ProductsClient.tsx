'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '@/components/product/ProductCard';
import ProductFiltersPanel from '@/components/product/ProductFiltersPanel';
import { WooCategory, WooProduct } from '@/lib/woocommerce';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { fetchProducts } from './actions';
import { Loader2 } from 'lucide-react';

export interface ProductsClientProps {
  products: WooProduct[];
  categories: WooCategory[];
  total: number;
  activeCategory?: string;
  initialSort?: string;
}

const ProductsClient = ({
  products: initialProducts,
  categories,
  total: initialTotal,
  activeCategory = 'all',
  initialSort = 'date',
}: ProductsClientProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sortBy = searchParams.get('orderby') || initialSort;
  const selectedCategory = searchParams.get('category') || activeCategory;

  // Local state for price inputs
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Infinite Scroll State
  const [products, setProducts] = useState<WooProduct[]>(initialProducts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialProducts.length < initialTotal);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Sync local state with URL params when they change externally
  useEffect(() => {
    setMinPrice(searchParams.get('min_price') || '');
    setMaxPrice(searchParams.get('max_price') || '');
  }, [searchParams]);

  // Reset state when initial products change (filter/sort change)
  useEffect(() => {
    setProducts(initialProducts);
    setPage(1);
    setHasMore(initialProducts.length < initialTotal);
  }, [initialProducts, initialTotal]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    const nextPage = page + 1;

    // Construct params for the server action
    const params: any = {
      category: selectedCategory !== 'all' ? categories.find(c => c.slug === selectedCategory)?.id : undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice || undefined,
    };

    // Add sort options
    switch (sortBy) {
      case 'price-asc':
        params.orderby = 'price';
        params.order = 'asc';
        break;
      case 'price-desc':
        params.orderby = 'price';
        params.order = 'desc';
        break;
      case 'title-asc':
        params.orderby = 'title';
        params.order = 'asc';
        break;
      case 'title-desc':
        params.orderby = 'title';
        params.order = 'desc';
        break;
      case 'popularity':
      case 'rating':
      case 'date':
      default:
        params.orderby = 'date';
        params.order = 'desc';
        break;
    }

    try {
      const { products: newProducts, total: newTotal } = await fetchProducts(nextPage, params);

      if (newProducts.length === 0) {
        setHasMore(false);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
        setPage(nextPage);
        // Check if we've reached the total
        if ([...products, ...newProducts].length >= (newTotal ?? 0)) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Failed to load more products', error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, selectedCategory, minPrice, maxPrice, sortBy, categories, products]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [loadMore]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    router.push(query ? `/products?${query}` : '/products');
  };

  const handleCategoryChange = (slug: string) => {
    updateParams({ category: slug === 'all' ? null : slug });
  };

  const handleSortChange = (value: string) => {
    updateParams({ orderby: value });
  };

  // Debounced price update
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentMin = searchParams.get('min_price') || '';
      const currentMax = searchParams.get('max_price') || '';

      if (minPrice !== currentMin || maxPrice !== currentMax) {
        updateParams({
          min_price: minPrice || null,
          max_price: maxPrice || null
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [minPrice, maxPrice]);

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    router.push('/products');
    setIsMobileFilterOpen(false);
  };

  const headerText = useMemo(() => {
    if (selectedCategory && selectedCategory !== 'all') {
      const matched = categories.find((cat) => cat.slug === selectedCategory);
      return matched ? `${matched.name}` : 'Filtered Products';
    }
    return 'All Products';
  }, [selectedCategory, categories]);

  return (
    <section className="py-8 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4">
        {/* Mobile Header & Filter Trigger */}
        <div className="flex flex-col gap-4 md:hidden mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{headerText}</h1>
              <p className="text-sm text-muted-foreground">Showing {products.length} of {initialTotal} products</p>
            </div>
            <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <AdjustmentsHorizontalIcon className="w-4 h-4" />
                  Filter
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto flex flex-col h-full">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="flex-1 py-6">
                  <ProductFiltersPanel
                    categories={categories}
                    category={selectedCategory}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    sortBy={sortBy}
                    onCategoryChange={(v) => {
                      handleCategoryChange(v);
                    }}
                    onMinPriceChange={setMinPrice}
                    onMaxPriceChange={setMaxPrice}
                    onSortChange={handleSortChange}
                    onReset={handleReset}
                  />
                </div>
                <SheetFooter className="mt-auto border-t pt-4">
                  <div className="flex w-full gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleReset}>Reset</Button>
                    <Button className="flex-1" onClick={() => setIsMobileFilterOpen(false)}>Apply</Button>
                  </div>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <ProductFiltersPanel
              categories={categories}
              category={selectedCategory}
              minPrice={minPrice}
              maxPrice={maxPrice}
              sortBy={sortBy}
              onCategoryChange={handleCategoryChange}
              onMinPriceChange={setMinPrice}
              onMaxPriceChange={setMaxPrice}
              onSortChange={handleSortChange}
              onReset={handleReset}
              showHeading={false}
            />
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            <div className="hidden md:flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{headerText}</h1>
                <p className="text-sm text-muted-foreground">Showing {products.length} of {initialTotal} products</p>
              </div>
            </div>

            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Infinite Scroll Loader */}
                {hasMore && (
                  <div ref={observerTarget} className="flex justify-center py-8">
                    {loading && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                <p className="text-muted-foreground">No products found matching your filters.</p>
                <Button variant="link" onClick={handleReset} className="mt-2">Clear all filters</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductsClient;
