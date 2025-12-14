import { useState, useEffect } from 'react';
import { getProducts, WooProduct } from '@/lib/woocommerce';
import ProductCard from '@/components/product/ProductCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

const AllProducts = () => {
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProducts = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const params = {
        page: pageNum,
        per_page: 12, // Show 12 products per page
        status: 'publish',
        orderby: 'date',
        order: 'desc' as const
      };

      const newProducts = await getProducts(params);

      if (append) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }

      // Check if there are more products to load
      setHasMore(newProducts.length === 12);
      setPage(pageNum);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadProducts(1, false);
  }, []);

  const loadMoreProducts = () => {
    if (!loadingMore && hasMore) {
      loadProducts(page + 1, true);
    }
  };

  // Skeleton component for loading state
  const SkeletonProductCard = () => (
    <div className="bg-white border border-gray-300 rounded-lg p-2 md:p-3 animate-pulse">
      <div className="relative overflow-hidden rounded-lg mb-2 aspect-square">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-16 mt-1" />
        <Skeleton className="h-8 w-full mt-2" />
      </div>
    </div>
  );

  if (error) {
    return (
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold mb-2">Oops! Something went wrong</h2>
          <p className="text-muted-foreground mb-6">Failed to load products</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      <style>{`
        .featured-products-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 1rem !important;
        }
        @media (min-width: 1024px) {
          .featured-products-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
      <section className="py-16 lg:py-24 bg-muted/20">
        <div className="container mx-auto px-1">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              আমাদের  <span className="text-gradient">পণ্যসমূহ 123</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              আমরা নিয়ে এসেছি আপনার রান্নাঘরের জন্য দারুণ সব সমাধান। আমাদের প্রোডাক্টগুলো আপনার রান্নাঘরের সৌন্দর্য বাড়াবে, পাশাপাশি কাজগুলোও স্মার্টলি সহজ করে দেবে।
            </p>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="featured-products-grid mb-12">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="w-full">
                  <SkeletonProductCard />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="featured-products-grid mb-12">
                {products.map((product) => (
                  <div key={product.id} className="w-full">
                    <ProductCard
                      product={product}
                      className="animate-slide-up"
                    />
                  </div>
                ))}
              </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center mb-8">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={loadMoreProducts}
                  disabled={loadingMore}
                  className="px-8 py-4 text-lg border-2 hover:bg-primary hover:text-white hover:border-primary"
                >
                  {loadingMore ? 'Loading...' : 'Load More Products'}
                </Button>
              </div>
            )}

            {/* View All Button */}
            <div className="text-center">
              <Link href="/products">
                <Button size="lg" variant="outline" className="px-8 py-4 text-lg border-2 hover:bg-primary hover:text-white hover:border-primary">
                  View All Products
                </Button>
              </Link>
            </div>
            </>
          ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-bold mb-2">No Products Yet</h3>
            <p className="text-muted-foreground mb-6">
              Our awesome products will appear here soon!
            </p>
            <Link href="/products">
              <Button className="btn-anime">
                Browse All Products
              </Button>
            </Link>
          </div>
        )}
        </div>
      </section>
    </>
  );
};

export default AllProducts;
