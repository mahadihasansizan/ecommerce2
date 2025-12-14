'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '@/components/product/ProductCard';
import { WooCategory, WooProduct } from '@/lib/woocommerce';
import { Button } from '@/components/ui/button';

export interface ProductsClientProps {
  products: WooProduct[];
  categories: WooCategory[];
  total: number;
  activeCategory?: string;
  initialSort?: string;
}

const ProductsClient = ({
  products,
  categories,
  total,
  activeCategory = 'all',
  initialSort = 'date',
}: ProductsClientProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sortBy = searchParams.get('orderby') || initialSort;
  const selectedCategory = searchParams.get('category') || activeCategory;

  const handleCategoryChange = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === 'all') {
      params.delete('category');
    } else {
      params.set('category', slug);
    }
    const query = params.toString();
    router.push(query ? `/products?${query}` : '/products');
  };

  const headerText = useMemo(() => {
    if (selectedCategory && selectedCategory !== 'all') {
      const matched = categories.find((cat) => cat.slug === selectedCategory);
      return matched ? `${matched.name} Collection` : 'Filtered Products';
    }
    return 'All Products';
  }, [selectedCategory, categories]);

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} products</p>
            <h1 className="text-3xl font-bold">{headerText}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-semibold">Sort by:</label>
            <select
              value={sortBy}
              onChange={(ev) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('orderby', ev.target.value);
                const query = params.toString();
                router.push(query ? `/products?${query}` : '/products');
              }}
              className="rounded border border-border px-3 py-1"
            >
              <option value="date">Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
            onClick={() => handleCategoryChange('all')}
            size="sm"
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.slug ? 'secondary' : 'ghost'}
              onClick={() => handleCategoryChange(category.slug)}
              size="sm"
            >
              {category.name}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductsClient;
