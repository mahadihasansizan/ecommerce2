'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCategories, WooCategory } from '@/lib/woocommerce';
import { decodeHtmlEntities } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { XMarkIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'; // Removed unused icons
import { useCartStore } from '@/store/cartStore';

// Navigation array matching Header.tsx (kept for consistency, but not used in this component)
const navigation = [
  { name: 'Home', href: '/' },
  { name: 'All Products', href: '/products' },
  { name: 'Categories', href: '/categories' },
  { name: 'FAQ', href: '/faqs' },
  { name: 'Contact Us', href: '/contact' },
];

interface MenuOffCanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const MenuOffCanvas = ({ isOpen, onClose }: MenuOffCanvasProps) => {
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const { getTotalItems, openCart } = useCartStore();
  const totalItems = getTotalItems();

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    if (isOpen) {
      loadCategories();
    } else {
      // Reset when closed
      setCategories([]);
      setLoadingCategories(false);
    }
  }, [isOpen]);

  // Updated pages list to match requirements
  const pages = [
    { name: 'Home', href: '/' },
    { name: 'All Products', href: '/products' },
    { name: 'Categories', href: '/categories' },
    { name: 'FAQ', href: '/faqs' },
    { name: 'Contact Us', href: '/contact' },
  ];

  if (!isOpen) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        {/* Handle indicator for bottom sheet */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 rounded-full" />
        <SheetHeader className="mb-6 mt-4">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Navigation menu with categories and pages</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-3 overflow-y-auto max-h-96">
            {loadingCategories ? (
              // Skeleton loading for categories
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`skeleton-category-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center space-x-3 w-full">
                    <Skeleton className="w-10 h-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : categories.length > 0 ? (
              categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug}`}
                  onClick={onClose}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
                >
                  <div className="flex items-center space-x-3">
                    {category.image ? (
                      <img
                        src={category.image.src}
                        alt={category.name}
                        className="w-10 h-10 object-cover rounded"
                        loading="lazy"
                      />
                    ) : (
                      <Skeleton className="w-10 h-10 rounded" />
                    )}
                    <div>
                      <h4 className="font-medium">{decodeHtmlEntities(category.name)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {typeof category.count === 'number' ? category.count : 0} products
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No categories found</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pages" className="space-y-3">
            {pages.map((page) => (
            <Link
                key={page.name}
                href={page.href}
                onClick={onClose}
                className="block p-3 rounded-lg border hover:bg-muted"
              >
                <h4 className="font-medium">{page.name}</h4>
              </Link>
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-auto p-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onClose();
              openCart();
            }}
          >
            <ShoppingCartIcon className="h-4 w-4 mr-2" />
            Cart ({totalItems})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MenuOffCanvas;
