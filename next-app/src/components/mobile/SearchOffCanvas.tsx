'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { searchProducts } from '@/lib/woocommerce'; // Reuse WooCommerce API function
import { parseVariablePriceRange, formatBDT, numbersFromString, highlightSearchTerm } from '@/lib/utils'; // Import helpers
import { useRouter } from 'next/navigation';

// Updated Types for search results (add slug)
interface SearchResult {
  id: number;
  name: string;
  permalink: string;
  slug: string; // Add slug for dynamic URLs
  images?: { src: string }[]; // Optional for thumbnails
  // price fields (preserve what Woo returns so we can mirror ProductCollectionLayout)
  type?: string;
  price?: string;
  sale_price?: string;
  regular_price?: string;
  price_html?: string;
}

interface SearchOffCanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchOffCanvas: React.FC<SearchOffCanvasProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function
  const debouncedSearch = debounce(async (query: string) => {
    if (!query.trim()) {
      setLiveResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchProducts(query, 5); // Fetch up to 5 results
      setLiveResults(
        results.map((item: any) => {
          // Extract slug from API response or permalink
          const slug = item.slug || (item.permalink || "").split('/').filter(Boolean).pop(); // Fallback
          return {
            id: item.id,
            name: item.name,
            permalink: item.permalink,
            slug: slug,
            images: item.images,
            // preserve pricing fields so renderSearchPrice can mirror ProductCollectionLayout
            type: item.type,
            price: item.price,
            sale_price: item.sale_price,
            regular_price: item.regular_price,
            price_html: item.price_html
          } as SearchResult;
        })
      );
    } catch (error) {
      console.warn('Mobile live search error:', error);
      setLiveResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  // Handle input change for live search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Handle form submit (full search)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/products?search=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setLiveResults([]);
      onClose(); // Close offcanvas after search
    }
  };

  // Close results on outside click or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.search-offcanvas')) {
        setLiveResults([]);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Reset on closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setLiveResults([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      {/* Offcanvas Panel */}
      <div className="relative w-full max-w-md bg-white shadow-xl rounded-b-lg search-offcanvas">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Search Products</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close search">
            <XMarkIcon className="h-6 w-6" />
          </Button>
        </div>
        {/* Search Form */}
        <form onSubmit={handleSearch} className="p-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search your next kitchen items..."
              value={searchQuery}
              onChange={handleInputChange}
              className="pr-12 border-2 border-border/50 focus:border-primary"
              autoFocus // Auto-focus for mobile UX
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3"
              aria-label="Search products"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
            </Button>
          </div>
          {/* Loading State - Show skeleton while searching */}
          {isSearching && (
            <div className="mt-4 max-h-60 overflow-y-auto border rounded-md bg-white shadow-sm">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton-search-${index}`}
                  className="flex items-center gap-3 p-3 border-b last:border-b-0"
                >
                  <Skeleton className="w-10 h-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          )}

          {/* Live Search Results */}
          {!isSearching && liveResults.length > 0 && (
            <div className="mt-4 max-h-60 overflow-y-auto border rounded-md bg-white shadow-sm">
              {liveResults.map((result) => (
                <Link
                  key={result.id}
                  href={`/product/${result.slug}`} // Updated: Use slug for dynamic URLs
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-b-0"
                  onClick={() => {
                    setSearchQuery('');
                    setLiveResults([]);
                    onClose();
                  }}
                >
                  {result.images?.[0] && (
                    <img
                      src={result.images[0].src}
                      alt={result.name}
                      className="w-10 h-10 rounded object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className="text-sm font-medium flex-1 min-w-0">
                    {(() => {
                      const highlighted = highlightSearchTerm(result.name, searchQuery, 40);
                      return (
                        <>
                          {highlighted.showStartEllipsis && '...'}
                          {highlighted.before}
                          {highlighted.match && (
                            <mark className="bg-yellow-200 text-yellow-900 font-semibold px-0.5 rounded">
                              {highlighted.match}
                            </mark>
                          )}
                          {highlighted.after}
                          {highlighted.showEndEllipsis && '...'}
                        </>
                      );
                    })()}
                  </span>
                  {/* Render product price using same logic as ProductCard */}
                  <span className="ml-auto text-sm font-semibold text-primary shrink-0">
                    {renderSearchPrice(result)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {/* Loading State */}
          {isSearching && (
            <div className="mt-4 p-3 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {/* No Results */}
          {!isSearching && searchQuery.trim() && liveResults.length === 0 && (
            <div className="mt-4 p-3 text-center text-sm text-muted-foreground">
              No products found. Try a different search.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// Render product price using same logic as ProductCard
const renderSearchPrice = (product: SearchResult) => {
  // Variable product: try parseVariablePriceRange (from price_html) first,
  // fallback to extracting numbers from product.price or price_html.
  if (product.type === 'variable') {
    const html = product.price_html ?? '';
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

  // Simple product: prefer sale_price if available and different from regular_price
  const price = product.sale_price && product.sale_price !== product.regular_price
    ? product.sale_price
    : product.price;
  const base = parseFloat(String(price ?? ''));
  if (!Number.isNaN(base)) return <span className="text-primary font-bold">{formatBDT(base)}</span>;
  return <span className="text-primary font-bold">{formatBDT(Number(price) || 0)}</span>;
};

// Debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

export default SearchOffCanvas;
