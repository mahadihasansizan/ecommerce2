'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TrashIcon, HeartIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useWishlistStore } from '@/store/wishlistStore';
import type { WishlistItem } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';
import ProductCard from '@/components/product/ProductCard';
import { Button } from '@/components/ui/button';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const WishlistClient = () => {
  const { items, removeFromWishlist, clearWishlist } = useWishlistStore();
  const { addToCart, openCart } = useCartStore();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;
    const ctx = gsap.context(() => {
      const targets = containerRef.current ? Array.from(containerRef.current.children) : [];
      gsap.fromTo(
        targets,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [items]);

  const handleAddAllToCart = () => {
    items.forEach((item) => {
      addToCart(item.product, undefined, 1, undefined, false);
    });
    toast.success(`Added ${items.length} items to cart`);
    openCart();
  };

  const handleClearWishlist = () => {
    if (confirm('Are you sure you want to clear your wishlist?')) {
      clearWishlist();
      toast.success('Wishlist cleared');
    }
  };

  const handleRemove = (productId: number) => {
    removeFromWishlist(productId);
    toast.success('Removed from wishlist');
  };

  if (!items.length) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <HeartIcon className="h-24 w-24 mx-auto text-gray-300" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Your Wishlist is Empty</h1>
          <p className="text-muted-foreground mb-8">Start adding products that you love!</p>
          <Button onClick={() => router.push('/products')} className="btn-anime">
            Browse Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Wishlist</h1>
          <p className="text-muted-foreground">{items.length} item{items.length > 1 ? 's' : ''} saved</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleAddAllToCart} className="hidden md:flex">
            Add All to Cart
          </Button>
          <Button variant="outline" onClick={handleClearWishlist} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <TrashIcon className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>
      <div className="md:hidden mb-6">
        <Button variant="outline" onClick={handleAddAllToCart} className="w-full">
          Add All to Cart ({items.length})
        </Button>
      </div>
      <div ref={containerRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {items.map((item: WishlistItem) => (
          <div key={item.id} className="relative group">
            <button
              onClick={() => handleRemove(item.productId)}
              className="absolute top-2 right-2 z-20 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Remove from wishlist"
            >
              <TrashIcon className="h-4 w-4 text-red-500" />
            </button>
            <div className="h-full">
              <ProductCard product={item.product} hideWishlistIcon={true} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WishlistClient;
