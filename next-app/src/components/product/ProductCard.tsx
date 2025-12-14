 'use client';

import React, { memo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { WooProduct } from '@/lib/woocommerce';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from 'sonner'; // or your preferred toast library
import { parseVariablePriceRange, formatBDT, numbersFromString, decodeHtmlEntities, getCurrencySymbolSync } from '@/lib/utils';
import { gsap } from 'gsap';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { useSiteName } from '@/hooks/useSiteInfo';

interface ProductCardProps {
  product: WooProduct;
  className?: string;
  hideGalleryThumbs?: boolean; // Deprecated - gallery thumbs removed
  hideWishlistIcon?: boolean; // Hide wishlist icon (e.g., on wishlist page)
}

const ProductCard = memo(({ product, className = '', hideGalleryThumbs = false, hideWishlistIcon = false, priority = false }: ProductCardProps & { priority?: boolean }) => {
  const { addToCart } = useCartStore();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlistStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isWishlisted = isInWishlist(product.id);
  const siteName = useSiteName();

  useEffect(() => {
    if (!cardRef.current) return;

    // Initial animation - fade in and slide up
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );

    // Hover animations
    const card = cardRef.current;
    const image = imageRef.current;

    const handleMouseEnter = () => {
      gsap.to(card, { scale: 1.02, duration: 0.3, ease: 'power2.out' });
      if (image) {
        gsap.to(image, { scale: 1.1, duration: 0.3, ease: 'power2.out' });
      }
    };

    const handleMouseLeave = () => {
      gsap.to(card, { scale: 1, duration: 0.3, ease: 'power2.out' });
      if (image) {
        gsap.to(image, { scale: 1, duration: 0.3, ease: 'power2.out' });
      }
    };

    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const getPriceDisplay = (product: WooProduct) => {
    // Variable product: try parseVariablePriceRange (from price_html) first,
    // fallback to extracting numbers from product.price or price_html.
    if (product.type === 'variable') {
      const html = (product as any).price_html ?? '';
      const { min, max } = html ? parseVariablePriceRange(html) : {};

      if (typeof min === 'number' && typeof max === 'number') {
        if (min === max) return <span className="text-primary font-bold">{formatBDT(min)}</span>;
        return <span className="text-primary font-bold">{formatBDT(min)}-{formatBDT(max)}</span>;
      }

      // fallback: try any numbers present in price_html or product.price
      const nums = numbersFromString(String(html || product.price || ''));
      if (nums.length >= 2) {
        const lo = Math.min(...nums);
        const hi = Math.max(...nums);
        if (lo === hi) return <span className="text-primary font-bold">{formatBDT(lo)}</span>;
        return <span className="text-primary font-bold">{formatBDT(lo)}-{formatBDT(hi)}</span>;
      }
      if (nums.length === 1) {
        return <span className="text-primary font-bold">{formatBDT(nums[0])}</span>;
      }

      return null;
    }

    // Simple product: show single price
    const base = parseFloat(String(product.price ?? ''));
    if (!Number.isNaN(base)) return <span className="text-primary font-bold">{formatBDT(base)}</span>;
    const symbol = getCurrencySymbolSync();
    return <span className="text-primary font-bold">{symbol}{product.price}</span>;
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, undefined, 1, undefined, false);
    toast.success('Product added to cart');
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWishlisted) {
      removeFromWishlist(product.id);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist(product);
      toast.success('Added to wishlist');
    }
  };

  const getCategoryName = () => {
    if (product.categories && product.categories.length > 0) return decodeHtmlEntities(product.categories[0].name);
    return 'T-Shirt';
  };

  const renderCategoryBadge = () => (
    <span className="inline-block mb-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
      {getCategoryName()}
    </span>
  );

  const productImage =
    product.images && product.images.length > 0 ? product.images[0].src : '/placeholder.svg';

  // Gallery thumbnails removed - no longer used

  const pluginAvg =
    (product as any)._msds_rating_avg ??
    (product as any).meta?._msds_rating_avg ??
    product.meta_data?.find?.((m: any) => m.key === '_msds_rating_avg')?.value;

  const pluginCount =
    (product as any)._msds_rating_count ??
    (product as any).meta?._msds_rating_count ??
    product.meta_data?.find?.((m: any) => m.key === '_msds_rating_count')?.value;

  const resolvedAvg =
    typeof pluginAvg !== 'undefined'
      ? parseFloat(String(pluginAvg))
      : parseFloat(product.average_rating || '0');

  const resolvedCount =
    typeof pluginCount !== 'undefined' ? Number(pluginCount) : Number(product.rating_count || 0);

  const renderRating = () => {
    if (!resolvedCount || resolvedAvg <= 0) return null;
    const full = Math.floor(resolvedAvg);
    const hasHalf = resolvedAvg - full >= 0.5;
    return (
      <div
        className="flex items-center gap-1"
        aria-label={`Rated ${resolvedAvg.toFixed(1)} out of 5 from ${resolvedCount} reviews`}
      >
        <div className="flex">
          {[...Array(5)].map((_, i) => {
            const half = hasHalf && i === full;
            const filled = i < full;
            return (
              <svg key={i} viewBox="0 0 20 20" className="w-4 h-4">
                {half && (
                  <defs>
                    <linearGradient id={`pcard-half-${product.id}-${i}`}>
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="50%" stopColor="#d1d5db" />
                    </linearGradient>
                  </defs>
                )}
                <path
                  fill={
                    half
                      ? `url(#pcard-half-${product.id}-${i})`
                      : filled
                      ? '#f59e0b'
                      : '#d1d5db'
                  }
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 0 0 .95.69h4.175c.97 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 0 0-.364 1.118l1.287 3.966c.3.922-.756 1.688-1.54 1.118l-3.38-2.454a1 1 0 0 0-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 0 0-.364-1.118L2.04 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 0 0 .95-.69l1.286-3.967Z"
                />
              </svg>
            );
          })}
        </div>
        <span className="text-[11px] font-medium text-amber-600">{resolvedAvg.toFixed(1)}</span>
        <span className="text-[11px] text-muted-foreground">({resolvedCount})</span>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      className={`group cursor-pointer bg-white border border-gray-300 hover:border-gray-400 transition-colors rounded-lg p-4 md:p-3 ${className}`}
    >
      <div className="relative overflow-hidden rounded-lg mb-2 aspect-square">
        <Link href={`/product/${product.slug}`}>
          <img
            ref={imageRef}
            src={productImage}
            alt={`${product.name} - ${getCategoryName()} - ${siteName}`}
            className="w-full h-full object-cover"
            loading="lazy"
            width="400"
            height="400"
          />
          {product.on_sale && (
            <Badge variant="destructive" className="absolute top-2 left-2 flex items-center gap-1 z-10">
              Sale
              {product.featured && (
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 text-yellow-400 ml-1"
                  aria-label="Featured"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 0 0 .95.69h4.175c.97 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 0 0-.364 1.118l1.287 3.966c.3.922-.756 1.688-1.54 1.118l-3.38-2.454a1 1 0 0 0-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 0 0-.364-1.118L2.04 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 0 0 .95-.69l1.286-3.967Z" />
                </svg>
              )}
            </Badge>
          )}

          {/* Gallery thumbnails removed - no longer showing */}
        </Link>
        
        {/* Wishlist Button - Always visible (unless hidden) */}
        {!hideWishlistIcon && (
          <button
            onClick={handleWishlistToggle}
            className={`absolute top-2 right-2 z-10 transition-all p-2 min-w-[44px] min-h-[44px] flex items-center justify-center ${
              isWishlisted
                ? 'text-primary'
                : 'text-gray-600 hover:text-primary'
            }`}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {isWishlisted ? (
              <HeartIconSolid className="h-5 w-5" />
            ) : (
              <HeartIcon className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {renderCategoryBadge()}
        <h3 className="font-medium text-sm text-black line-clamp-2">
          <Link
            href={`/product/${product.slug}`}
            className="focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-sm text-black"
          >
            {decodeHtmlEntities(product.name)}
          </Link>
        </h3>
        {renderRating()}
        <div className="flex items-center justify-between pt-1">{getPriceDisplay(product)}</div>
        {product.type === 'variable' ? (
          <Link href={`/product/${product.slug}`}>
            <Button className="w-full mt-1 py-1 h-auto font-medium text-sm">Add to Cart</Button>
          </Link>
        ) : (
          <Button onClick={handleBuyNow} className="w-full mt-1 py-1 h-auto font-medium text-sm">
            Add to Cart
          </Button>
        )}
      </div>
    </div>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
