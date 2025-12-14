'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { getProducts, WooProduct } from '@/lib/woocommerce';
import ProductCard from '@/components/product/ProductCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface BestSellersProps {
  initialProducts?: WooProduct[];
}

const BestSellers = ({ initialProducts }: BestSellersProps) => {
  const [products, setProducts] = useState<WooProduct[]>(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [mobilePage, setMobilePage] = useState(0);
  
  // Touch/swipe handlers for mobile
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SWIPE_THRESHOLD = 50;
  const desktopSliderRef = useRef<HTMLDivElement>(null);
  const desktopTouchStartX = useRef<number | null>(null);
  const desktopTouchDeltaX = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        if (initialProducts && initialProducts.length) {
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
        const best = await getProducts({
          per_page: 10, // Limit to exactly 10 products
          orderby: 'popularity',
          order: 'desc',
          status: 'publish', // Only show published products
        });
        // Ensure we only use exactly 10 products
        setProducts((best || []).slice(0, 10));
      } catch (err) {
        console.error('Failed to load best sellers', err);
        setError('Failed to load best sellers');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [initialProducts]);

  // Create slides of 5 products each (max 2 slides for 10 products)
  const slides = useMemo(() => {
    const list = products.slice(0, 10);
    const chunks: (WooProduct | null)[][] = [];

    // Create slides of 5 products each
    for (let i = 0; i < list.length; i += 5) {
      const group: (WooProduct | null)[] = list.slice(i, i + 5);
      // Fill up to 5 slots with null placeholders
      while (group.length < 5) {
        group.push(null);
      }
      chunks.push(group);
    }

    // If no products, show one empty slide
    if (!chunks.length) {
      chunks.push(Array(5).fill(null));
    }

    return chunks;
  }, [products]);

  const totalPages = slides.length;

  // Handle scroll position for mobile pagination - update based on scroll snap
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || loading) return;

    let rafId: number | null = null;
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (!container || isScrolling.current) return;
      
      // Use requestAnimationFrame for smooth updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
      const cardWidth = container.offsetWidth * 0.75;
      const gap = 12; // 0.75rem gap
      const scrollAmount = cardWidth + gap;
      const currentIndex = Math.round(container.scrollLeft / scrollAmount);
      setMobilePage(Math.min(Math.max(0, currentIndex), products.length - 1));
        rafId = null;
      });
    };

    // Use scrollend event if available for immediate update after scroll ends
    const hasScrollEnd = 'onscrollend' in window;
    
    if (hasScrollEnd) {
      const handleScrollEnd = () => {
        isScrolling.current = false;
        handleScroll();
      };
      container.addEventListener('scrollend', handleScrollEnd, { passive: true });
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        const currentContainer = scrollContainerRef.current;
        if (currentContainer) {
          currentContainer.removeEventListener('scrollend', handleScrollEnd);
        }
      };
    } else {
      // Fallback: use scroll with proper debouncing
      const debouncedHandleScroll = () => {
        if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
          isScrolling.current = false;
          handleScroll();
          scrollTimeout = null;
        }, 200); // Increased debounce for smoother feel
      };
      
      container.addEventListener('scroll', debouncedHandleScroll, { passive: true });
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        const currentContainer = scrollContainerRef.current;
        if (currentContainer) {
          currentContainer.removeEventListener('scroll', debouncedHandleScroll);
        }
      };
    }
  }, [loading, products.length]);

  // Early return AFTER all hooks - this prevents hooks order violation
  if (error || (!loading && products.length === 0)) return null;

  const goPrev = () => setPage((p) => (p === 0 ? totalPages - 1 : p - 1));
  const goNext = () => setPage((p) => (p === totalPages - 1 ? 0 : p + 1));

  // Mobile navigation functions - scroll one item at a time with smooth snapping
  const goMobilePrev = () => {
    const container = scrollContainerRef.current;
    if (!container || isScrolling.current) return;
    isScrolling.current = true;
    const cardWidth = container.offsetWidth * 0.75;
    const gap = 12; // 0.75rem gap
    const scrollAmount = cardWidth + gap;
    const currentScroll = container.scrollLeft;
    const targetScroll = Math.max(0, currentScroll - scrollAmount);
    
    // Use scrollTo with smooth behavior, but let scroll-snap handle final positioning
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
    
    // Reset scrolling flag after animation
    setTimeout(() => {
      isScrolling.current = false;
    }, 500);
  };

  const goMobileNext = () => {
    const container = scrollContainerRef.current;
    if (!container || isScrolling.current) return;
    isScrolling.current = true;
    const cardWidth = container.offsetWidth * 0.75;
    const gap = 12; // 0.75rem gap
    const scrollAmount = cardWidth + gap;
    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.offsetWidth;
    const targetScroll = Math.min(maxScroll, currentScroll + scrollAmount);
    
    // Use scrollTo with smooth behavior, but let scroll-snap handle final positioning
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
    
    // Reset scrolling flag after animation
    setTimeout(() => {
      isScrolling.current = false;
    }, 500);
  };

  // Touch handlers for mobile slider - allow natural scroll with scroll-snap
  const onMobileTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isScrolling.current = false;
    // Clear any pending scroll timeouts
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  };

  const onMobileTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    isScrolling.current = true;
    // Don't prevent default - allow natural scrolling with momentum
  };

  const onMobileTouchEnd = () => {
    if (touchStartX.current == null) return;
    const container = scrollContainerRef.current;
    if (!container) {
      touchStartX.current = null;
      return;
    }
    
    // Let scroll-snap handle the snapping naturally - don't interfere with programmatic scroll
    // Only update state after scroll has settled
    const checkScrollEnd = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isScrolling.current = false;
        scrollTimeoutRef.current = null;
      }, 100);
    };
    
    checkScrollEnd();
    
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  const onDesktopTouchStart = (e: React.TouchEvent) => {
    desktopTouchStartX.current = e.touches[0].clientX;
    desktopTouchDeltaX.current = 0;
  };

  const onDesktopTouchMove = (e: React.TouchEvent) => {
    if (desktopTouchStartX.current == null) return;
    desktopTouchDeltaX.current = e.touches[0].clientX - desktopTouchStartX.current;
  };

  const onDesktopTouchEnd = () => {
    if (desktopTouchStartX.current == null) return;
    
    if (desktopTouchDeltaX.current > SWIPE_THRESHOLD) {
      // Swipe right - go to previous
      goPrev();
    } else if (desktopTouchDeltaX.current < -SWIPE_THRESHOLD) {
      // Swipe left - go to next
      goNext();
    }
    desktopTouchStartX.current = null;
    desktopTouchDeltaX.current = 0;
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

  return (
    <>
      <style>{`
        .best-sellers-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 1rem;
        }
        
        .best-sellers-mobile-slider {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          gap: 0.75rem;
          padding-bottom: 0.5rem;
          overscroll-behavior-x: contain;
          will-change: scroll-position;
          /* Smooth momentum scrolling */
          -webkit-scroll-snap-type: x mandatory;
          scroll-padding: 0;
          /* Prevent layout shifts */
          contain: layout style paint;
        }
        
        .best-sellers-mobile-slider::-webkit-scrollbar {
          display: none;
        }
        
        .best-sellers-mobile-slider > div {
          scroll-snap-align: start;
          scroll-snap-stop: normal;
          flex: 0 0 calc(75% - 0.5rem);
          min-width: calc(75% - 0.5rem);
          max-width: calc(75% - 0.5rem);
          /* Optimize rendering */
          will-change: transform;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
        }
        
        @media (min-width: 1024px) {
          .best-sellers-mobile-slider {
            display: none;
          }
          .best-sellers-grid {
            display: grid !important;
          }
        }
        
        @media (max-width: 1023px) {
          .best-sellers-grid {
            display: none;
          }
        }
      `}</style>
      <section className="py-2 lg:py-16 w-full">
        <div className="container mx-auto px-2 md:px-4">
          <div className="mb-4 md:mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">
                Top Picks
              </p>
              <h2 className="text-2xl md:text-3xl font-bold">Best Sellers</h2>
            </div>

            {!loading && (
              <>
                {/* Mobile Navigation Buttons */}
                {products.length > 0 && (
                  <div className="flex md:hidden items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goMobilePrev}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={goMobileNext}>Next</Button>
                  </div>
                )}
                {/* Desktop Navigation Buttons */}
                {totalPages > 1 && (
                  <div className="hidden md:flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goPrev}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={goNext}>Next</Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="relative overflow-hidden w-full">
            {loading ? (
              <>
                {/* Mobile Skeleton Slider */}
                <div className="best-sellers-mobile-slider lg:hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`skeleton-mobile-${i}`}>
                      <SkeletonProductCard />
                    </div>
                  ))}
                </div>
                {/* Desktop Skeleton Grid */}
                <div className="best-sellers-grid hidden lg:grid">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`skeleton-desktop-${i}`} className="w-full">
                      <SkeletonProductCard />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Mobile Touch Slider */}
                <div
                  ref={scrollContainerRef}
                  className="best-sellers-mobile-slider lg:hidden"
                  onTouchStart={onMobileTouchStart}
                  onTouchMove={onMobileTouchMove}
                  onTouchEnd={onMobileTouchEnd}
                >
                  {products.map((product, index) => (
                    <div key={product.id}>
                      <ProductCard product={product} hideGalleryThumbs={true} priority={index === 0} />
                    </div>
                  ))}
                </div>

                {/* Desktop Grid with Pagination and Touch Support */}
                <div 
                  ref={desktopSliderRef}
                  className="hidden lg:block"
                  onTouchStart={onDesktopTouchStart}
                  onTouchMove={onDesktopTouchMove}
                  onTouchEnd={onDesktopTouchEnd}
                >
                  <div
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{
                      transform: `translateX(-${page * 100}%)`,
                    }}
                  >
                    {slides.map((group, idx) => {
                      const slideGroup = group as (WooProduct | null)[];
                      return (
                        <div
                          key={idx}
                          className="w-full flex-shrink-0"
                          style={{ minWidth: '100%', maxWidth: '100%' }}
                        >
                          <div className="best-sellers-grid w-full">
                            {slideGroup.map((product, i) => (
                              product ? (
                                <div key={product.id} className="w-full">
                                  <ProductCard product={product} hideGalleryThumbs={true} priority={page === 0 && i === 0} />
                                </div>
                              ) : (
                                <div
                                  key={`placeholder-${i}`}
                                  className="invisible w-full"
                                  aria-hidden="true"
                                />
                              )
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Mobile Pagination Dots */}
            {!loading && products.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-1 lg:hidden">
                {products.map((_, idx) => {
                  const isActive = idx === mobilePage;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        const container = scrollContainerRef.current;
                        if (container && !isScrolling.current) {
                          isScrolling.current = true;
                          const cardWidth = container.offsetWidth * 0.75;
                          const gap = 12; // 0.75rem gap
                          const scrollAmount = (cardWidth + gap) * idx;
                          container.scrollTo({
                            left: scrollAmount,
                            behavior: 'smooth',
                          });
                          setMobilePage(idx);
                          setTimeout(() => {
                            isScrolling.current = false;
                          }, 500);
                        }
                      }}
                      className={`h-1 w-1 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted'}`}
                      aria-label={`Go to product ${idx + 1}`}
                    />
                  );
                })}
              </div>
            )}

            {/* Desktop Pagination Dots */}
            {!loading && totalPages > 1 && (
              <div className="mt-4 hidden lg:flex items-center justify-center gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPage(idx)}
                    className={`h-1 w-1 rounded-full transition-colors ${idx === page ? 'bg-primary' : 'bg-muted'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default BestSellers;
