'use client';

import Image from 'next/image';
import Link from 'next/link';
import { WooCategory } from '@/lib/woocommerce';
import { Skeleton } from '@/components/ui/skeleton';

interface CategoriesClientProps {
  categories: WooCategory[];
}

const CategoriesClient = ({ categories }: CategoriesClientProps) => {
  if (!categories.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="border border-border rounded-lg p-4">
              <Skeleton className="w-full h-32 mb-4" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Categories</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="block border border-border rounded-lg overflow-hidden transition hover:shadow-lg"
          >
            {category.image?.src ? (
              <div className="relative h-48 w-full">
                <Image
                  src={category.image.src}
                  alt={category.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="h-48 w-full bg-muted"></div>
            )}
            <div className="p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Category</p>
              <h2 className="text-lg font-semibold text-foreground">{category.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CategoriesClient;
