'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  PhoneIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Squares2X2Icon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { Badge } from '@/components/ui/badge';
import SearchOffCanvas from '@/components/mobile/SearchOffCanvas';
import { WP_BASE_URL } from '@/lib/config';
import { searchProducts, WooProduct } from '@/lib/woocommerce';
import { parseVariablePriceRange, formatBDT, numbersFromString, highlightSearchTerm } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthModal from '@/components/auth/AuthModal';
import { Capacitor } from '@capacitor/core';
import { gsap } from 'gsap';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { getSocialUrls } from '@/lib/tenant-config';


/** ---------- Types ---------- */
interface SearchResult {
  id: number;
  name: string;
  permalink: string;
  slug: string; // Add slug for proper routing
  image?: string | null;
  priceHtml?: string | null;
  price?: string | null;
  currency?: string | null;
}

type SectionKey = 'info' | 'reviews' | 'faqs';

type NavItem = {
  name: string;
  href: string;
  submenu?: { name: string; href: string }[] | undefined;
};

/** ---------- Navigation ---------- */
const navigation: NavItem[] = [
  { name: 'Home', href: '/' },
  { name: 'All Products', href: '/products' },
  { name: 'Categories', href: '/categories' },
  { name: 'FAQ', href: '/faqs' },
  { name: 'Contact Us', href: '/contact' },
];

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('info');
  const [liveResults, setLiveResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');

  const router = useRouter();
  const pathname = usePathname();
  const isSingleProductPage = /^\/product\//.test(pathname);

  const { getTotalItems, openCart, isOpen: isCartOpen } = useCartStore();
  const totalItems = getTotalItems();
  const [isMounted, setIsMounted] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const prevTotalItemsRef = useRef(totalItems);
  const { isAuthenticated, session, logout } = useAuth();
  const accountLabel = session?.firstName || session?.username || 'Account';
  const headerRef = useRef<HTMLElement>(null);
  const mobileCartBadgeRef = useRef<HTMLSpanElement>(null);
  const desktopCartBadgeRef = useRef<HTMLSpanElement>(null);
  
  // Wishlist
  const { getTotalItems: getWishlistTotal } = useWishlistStore();
  const wishlistCount = getWishlistTotal();
  const wishlistIconRef = useRef<HTMLButtonElement>(null);

  // Close mobile menu when cart opens
  useEffect(() => {
    if (isCartOpen && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isCartOpen, mobileMenuOpen]);

  // Animate header on mount
  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { y: -100, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Enhanced cart badge animation with GSAP
  useEffect(() => {
    if (totalItems > prevTotalItemsRef.current) {
      // Animate both mobile and desktop badges
      const badges = [mobileCartBadgeRef.current, desktopCartBadgeRef.current].filter(Boolean) as HTMLElement[];
      
      badges.forEach((badge) => {
        if (badge) {
          gsap.fromTo(
            badge,
            { scale: 0, rotation: -180 },
            {
              scale: 1,
              rotation: 0,
              duration: 0.5,
              ease: 'back.out(1.7)',
            }
          );
        }
      });

      setCartAnimation(true);
      const timer = setTimeout(() => setCartAnimation(false), 600);
      return () => clearTimeout(timer);
    }
    prevTotalItemsRef.current = totalItems;
  }, [totalItems]);

  /** ---------- Live Search (debounced) ---------- */
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setLiveResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const products = await searchProducts(query);
        const results: SearchResult[] = products.slice(0, 5).map((product: WooProduct) => ({
          id: product.id,
          name: product.name,
          permalink: product.permalink,
          slug: product.slug, // Add slug for proper routing
          image: product.images?.[0]?.src || null,
          priceHtml: product.price_html || null,
          price: product.price || null,
          currency: null, // WooCommerce v3 doesn't include currency in product object
        }));
        setLiveResults(results);
      } catch (err) {
        console.error('❌ Live search error:', err);
        setLiveResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/products?search=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setLiveResults([]);
      setMobileSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  // Track search on submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Remove trackSearch call
      // Navigate to search results page or handle search
    }
  };

  /** ---------- UX Effects ---------- */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.search-container')) {
        setLiveResults([]);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.documentElement.classList.add('overflow-hidden');
    } else {
      document.documentElement.classList.remove('overflow-hidden');
    }
    return () => document.documentElement.classList.remove('overflow-hidden');
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!isSingleProductPage) return;

    const anchors: { id: string; key: SectionKey }[] = [
      { id: 'short-description-section', key: 'info' },
      { id: 'reviews-section', key: 'reviews' },
      { id: 'faqs-section', key: 'faqs' },
    ];

    const onScroll = () => {
      const y = window.scrollY + 100;
      let bestKey: SectionKey = 'info';
      let bestPos = -Infinity;
      for (const a of anchors) {
        const el = document.getElementById(a.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= y && top > bestPos) {
          bestPos = top;
          bestKey = a.key;
        }
      }
      setActiveSection(bestKey);
    };

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('scroll', onScroll, opts);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll, opts);
  }, [isSingleProductPage]);

  const handleSectionClick = (section: SectionKey) => {
    setActiveSection(section);
    window.dispatchEvent(new CustomEvent('kh-open-section', { detail: { section } }));
    const sectionId =
      section === 'info' ? 'info-section' : section === 'reviews' ? 'reviews-section' : 'faqs-section';
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  // Review count for product mini-nav (from location state)
  let reviewCount = 0;
  if (isSingleProductPage && typeof window !== 'undefined') {
    const state = window.history.state as any;
    if (state && typeof state.reviewCount === 'number') {
      reviewCount = state.reviewCount;
    }
  }

  // FAQ count for product mini-nav (from location state and custom event)
  const [faqCount, setFaqCount] = useState(0);
  useEffect(() => {
    if (isSingleProductPage && typeof window !== 'undefined') {
      // Get initial count from state
      const state = window.history.state as any;
      if (state && typeof state.faqCount === 'number') {
        setFaqCount(state.faqCount);
      }
      
      // Listen for FAQ count updates
      const handleFaqCountUpdate = (event: CustomEvent) => {
        setFaqCount(event.detail.count);
      };
      
      window.addEventListener('faqCountUpdated', handleFaqCountUpdate as EventListener);
      
      return () => {
        window.removeEventListener('faqCountUpdated', handleFaqCountUpdate as EventListener);
      };
    }
  }, [isSingleProductPage]);

  // Add renderPrice function (matches SearchOffCanvas logic)
  const renderPrice = (result: SearchResult) => {
    if (result.priceHtml) {
      const { min, max } = parseVariablePriceRange(result.priceHtml);
      if (min != null && max != null) {
        if (min === max) return <span>{formatBDT(min)}</span>;
        return <span>{`${formatBDT(min)}-${formatBDT(max)}`}</span>;
      }

      // Fallback: extract numbers from priceHtml
      const nums = numbersFromString(result.priceHtml);
      if (nums.length) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (min === max) return <span>{formatBDT(min)}</span>;
        return <span>{`${formatBDT(min)}-${formatBDT(max)}`}</span>;
      }
    }

    // Fallback to plain price
    if (result.price) {
      const numeric = parseFloat(result.price);
      if (!Number.isNaN(numeric)) return <span>{formatBDT(numeric)}</span>;
    }

    return null;
  };

  /** ---------- Render ---------- */
  const isNative = Capacitor.isNativePlatform();
  return (
    <header ref={headerRef} className={`sticky top-0 z-30 border-b border-border ${isNative ? 'safe-area-top' : ''}`}>
      {/* Mobile top header - positioned at very top */}
      <div className="md:hidden bg-primary text-white">
        <div className="container mx-auto px-4 py-1">
          <div className="flex items-center justify-between">
            {/* First div: Need Help Message */}
            <a
              href="https://wa.me/8801835868877"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-white hover:text-white/80 transition-colors"
            >
            WhatsApp us: 01835868877
            </a>

            {/* Second div: Social icons */}
            <div className="flex items-center gap-3">
              <a
                href={getSocialUrls().facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-white/80 transition-colors"
                aria-label="Follow us on Facebook"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href={getSocialUrls().instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-white/80 transition-colors"
                aria-label="Follow us on Instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C8.396 0 7.996.014 6.79.067 5.59.12 4.694.287 3.94.547c-.795.275-1.467.647-2.14 1.32S.822 3.205.547 4c-.26.754-.427 1.65-.48 2.85C.014 7.996 0 8.396 0 12.017s.014 4.021.067 5.227c.053 1.2.22 2.096.48 2.85.275.795.647 1.467 1.32 2.14s1.125.975 1.92 1.25c.754.26 1.65.427 2.85.48C7.996 23.986 8.396 24 12.017 24s4.021-.014 5.227-.067c1.2-.053 2.096-.22 2.85-.48.795-.275 1.467-.647 2.14-1.32s.975-1.125 1.25-1.92c.26-.754.427-1.65.48-2.85.053-1.206.067-1.606.067-5.227s-.014-4.021-.067-5.227c-.053-1.2-.22-2.096-.48-2.85-.275-.795-.647-1.467-1.32-2.14S20.812.822 20.017.547c-.754-.26-1.65-.427-2.85-.48C16.021.014 15.621 0 12.017 0zm0 2.25c3.539 0 3.957.014 5.357.078 1.35.064 2.082.29 2.562.48.606.24 1.035.53 1.49.985.455.455.745.884.985 1.49.19.48.416 1.212.48 2.562.064 1.4.078 1.818.078 5.357s-.014 3.957-.078 5.357c-.064 1.35-.29 2.082-.48 2.562-.24.606-.53 1.035-.985 1.49-.455.455-.884.745-1.49.985-.48.19-1.212.416-2.562.48-1.4.064-1.818.078-5.357.078s-3.957-.014-5.357-.078c-1.35-.064-2.082-.29-2.562-.48-.606-.24-1.035-.53-1.49-.985-.455-.455-.745-.884-.985-1.49-.19-.48-.416-1.212-.48-2.562C2.075 15.621 2.061 15.203 2.061 12.017s.014-3.957.078-5.357c.064-1.35.29-2.082.48-2.562.24-.606.53-1.035.985-1.49.455-.455.884-.745 1.49-.985.48-.19 1.212-.416 2.562-.48 1.4-.064 1.818-.078 5.357-.078zM12.017 5.838c-3.403 0-6.17 2.767-6.17 6.17s2.767 6.17 6.17 6.17 6.17-2.767 6.17-6.17-2.767-6.17-6.17-6.17zm0 10.162c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-2 md:py-3">
            {/* Mobile: Hamburger menu (very left) */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </Button>

            {/* Logo - centered on mobile, left on desktop */}
            <Link href="/" className="flex items-center shrink-0 md:shrink-0 md:mr-0 mx-auto md:mx-0">
              <img
                src={`${WP_BASE_URL}/wp-content/uploads/2025/08/Kitchenhero-logo.png`}
                alt="Logo"
                className="h-7 md:h-10 w-auto max-w-[110px] md:max-w-[160px]"
                width={160}
                height={40}
                decoding="async"
              />
            </Link>

            {/* Desktop: Keep logo on left, add spacer */}
            <div className="hidden md:block flex-1"></div>

            {/* Desktop search with live AJAX */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full search-container">
                <Input
                  type="text"
                  placeholder="Search your next kitchen items..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  className="pr-10 border-2 border-border/50 focus:border-primary"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-3"
                  aria-label="Search products"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                </Button>

                {/* Live search dropdown with image + name + price */}
                {liveResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-b-md shadow-lg z-20 max-h-72 overflow-y-auto">
                    {liveResults.map((result) => (
                      <Link
                        key={result.id}
                        href={`/product/${result.slug}`}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50"
                        onClick={() => {
                          setSearchQuery('');
                          setLiveResults([]);
                        }}
                      >
                        {/* Thumb */}
                        <div className="h-10 w-10 rounded overflow-hidden bg-muted shrink-0 border border-border">
                          {result.image ? (
                            
                            <img
                              src={result.image}
                              alt={result.name}
                              className="h-full w-full object-cover"
                              loading="eager"
                              decoding="async"
                            />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>

                        {/* Title + price */}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-foreground">
                            {(() => {
                              const highlighted = highlightSearchTerm(result.name, searchQuery, 50);
                              return (
                                <span>
                                  {highlighted.showStartEllipsis && '...'}
                                  {highlighted.before}
                                  {highlighted.match && (
                                    <mark className="bg-yellow-200 text-yellow-900 font-semibold px-0.5 rounded">
                                      {highlighted.match}
                                    </mark>
                                  )}
                                  {highlighted.after}
                                  {highlighted.showEndEllipsis && '...'}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {renderPrice(result)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {isSearching && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-b-md shadow-lg z-20 max-h-72 overflow-y-auto">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`skeleton-search-header-${index}`}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <Skeleton className="h-10 w-10 rounded shrink-0" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isSearching && searchQuery.trim() && liveResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-b-md shadow-lg z-20 px-4 py-2 text-sm text-muted-foreground">
                    No results found. Try a different search.
                  </div>
                )}
              </div>
            </form>

            {/* Right controls */}
            <div className="flex items-center space-x-4">
              {/* Desktop action tiles */}
              <div className="hidden md:flex items-center gap-3">
                {/* WhatsApp */}
                <a
                  href="https://wa.me/8801835868877"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 hover:border-primary hover:bg-primary/5 transition"
                  aria-label="Chat on WhatsApp"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#25D366] text-white shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                      <path d="M12.04 2c-5.52 0-10 4.41-10 9.84 0 1.74.47 3.44 1.37 4.94L2 22l5.4-1.76a10.2 10.2 0 0 0 4.64 1.12h.01c5.52 0 10-4.41 10-9.84 0-2.63-1.08-5.09-3.05-6.95A10.5 10.5 0 0 0 12.04 2Zm-.01 18.27h-.01a8.7 8.7 0 0 1-4.37-1.18l-.31-.18-3.21 1.05 1.05-3.01-.2-.31a8.2 8.2 0 0 1-1.26-4.39c0-4.54 3.76-8.23 8.38-8.23 2.24 0 4.35.86 5.94 2.42 1.58 1.56 2.45 3.63 2.45 5.81 0 4.54-3.76 8.22-8.38 8.22Zm4.6-6.16c-.25-.13-1.47-.72-1.7-.8-.23-.08-.4-.12-.57.12-.17.24-.66.8-.81.96-.15.16-.3.18-.55.06-.25-.12-1.05-.38-2-1.21-.74-.65-1.24-1.46-1.39-1.7-.15-.24-.02-.37.11-.49.12-.12.25-.28.37-.43.12-.15.16-.24.24-.4.08-.16.04-.3-.02-.43-.06-.12-.57-1.36-.78-1.85-.21-.49-.41-.42-.57-.43-.15-.01-.33-.01-.5-.01-.17 0-.44.06-.67.31-.23.24-.88.86-.88 2.1 0 1.24.9 2.45 1.02 2.62.12.16 1.76 2.75 4.32 3.75.6.23 1.07.37 1.44.47.61.19 1.16.16 1.6.1.49-.07 1.47-.6 1.68-1.19.21-.59.21-1.09.15-1.19-.06-.1-.23-.16-.48-.29Z" />
                    </svg>
                  </div>
                  <div className="flex flex-col leading-tight text-left">
                    <span className="text-xs font-medium">WhatsApp</span>
                    <span className="text-[11px] text-muted-foreground">01835868877</span>
                  </div>
                </a>

                {/* Hotline */}
                <a
                  href="tel:01835868877"
                  className="group flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 hover:border-primary hover:bg-primary/5 transition"
                  aria-label="Call hotline"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary shrink-0">
                    <PhoneIcon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col leading-tight text-left">
                    <span className="text-xs font-medium">Hotline</span>
                    <span className="text-[11px] text-muted-foreground">01835868877</span>
                  </div>
                </a>

              </div>

              {/* Auth controls (desktop) */}
              <div className="hidden md:flex items-center gap-2">
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-2 flex items-center gap-2"
                      >
                        <UserCircleIcon className="h-5 w-5" />
                        <span className="text-sm font-medium whitespace-nowrap">Hi, {accountLabel}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push('/account')} className="cursor-pointer">
                        <Squares2X2Icon className="h-4 w-4 mr-2" />
                        Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/account?tab=orders')} className="cursor-pointer">
                        <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
                        My Orders
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-2 flex items-center gap-2"
                    onClick={() => {
                      setAuthModalTab('login');
                      setAuthModalOpen(true);
                    }}
                  >
                    <UserCircleIcon className="h-5 w-5" />
                    <span className="text-sm font-medium whitespace-nowrap">My Account</span>
                  </Button>
                )}
              </div>

              {/* Mobile: Right side - My Account and Cart */}
              <div className="flex items-center gap-2 md:hidden">
                {/* Mobile search button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileSearchOpen(true)}
                  aria-label="Open search"
                >
                  <MagnifyingGlassIcon className="h-6 w-6" />
                </Button>

                {/* Mobile My Account */}
                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-2"
                        aria-label="My Account"
                      >
                        <UserCircleIcon className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => router.push('/account')} className="cursor-pointer">
                        <Squares2X2Icon className="h-4 w-4 mr-2" />
                        Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/account?tab=orders')} className="cursor-pointer">
                        <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
                        My Orders
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-2"
                    onClick={() => {
                      setAuthModalTab('login');
                      setAuthModalOpen(true);
                    }}
                    aria-label="My Account"
                  >
                    <UserCircleIcon className="h-5 w-5" />
                  </Button>
                )}

                {/* Mobile Wishlist */}
                  <Button
                    ref={wishlistIconRef}
                    data-wishlist-icon
                    variant="outline"
                    size="sm"
                    className="relative border-2 z-20"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push('/wishlist');
                    }}
                    aria-label="Wishlist"
                  >
                  <HeartIcon className="h-5 w-5" />
                  {wishlistCount > 0 && (
                    <span suppressHydrationWarning>
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 bg-red-500"
                      >
                        {wishlistCount}
                      </Badge>
                    </span>
                  )}
                </Button>

                {/* Mobile Cart - with border like My Account */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="relative border-2 z-20" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openCart();
                  }} 
                  aria-label="Open cart"
                >
                  <ShoppingCartIcon className={`h-5 w-5 transition-transform duration-300 ${cartAnimation ? 'scale-125' : ''}`} />
                  {isMounted && totalItems > 0 && (
                    <span ref={mobileCartBadgeRef} suppressHydrationWarning>
                      <Badge
                        variant="destructive"
                        className={`absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 bg-primary transition-all duration-300 ${
                          cartAnimation ? 'animate-bounce scale-125' : ''
                        }`}
                      >
                        {totalItems}
                      </Badge>
                    </span>
                  )}
                </Button>
              </div>

              {/* Desktop: Wishlist */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative hidden md:flex z-20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push('/wishlist');
                  }}
                  aria-label="Wishlist"
                >
                <HeartIcon className="h-6 w-6" />
                {wishlistCount > 0 && (
                  <span suppressHydrationWarning>
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 bg-red-500"
                    >
                      {wishlistCount}
                    </Badge>
                  </span>
                )}
              </Button>

              {/* Desktop: Cart (keep existing) */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="relative hidden md:flex z-20" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openCart();
                }} 
                aria-label="Open cart"
              >
                <ShoppingCartIcon className={`h-6 w-6 transition-transform duration-300 ${cartAnimation ? 'scale-125' : ''}`} />
                {isMounted && totalItems > 0 && (
                    <span ref={desktopCartBadgeRef} suppressHydrationWarning>
                    <Badge
                      variant="destructive"
                      className={`absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 bg-primary transition-all duration-300 ${
                        cartAnimation ? 'animate-bounce scale-125' : ''
                      }`}
                    >
                      {totalItems}
                    </Badge>
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Mobile mini-nav on product page */}
          {isSingleProductPage && (
            <div
              className="md:hidden bg-white border-t border-border border-b border-gray-200 flex items-center justify-center text-xs font-medium"
              style={{ fontSize: '0.7rem', minHeight: 28 }}
            >
              <button
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'info' ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-500'
                }`}
                onClick={() => handleSectionClick('info')}
                type="button"
                aria-current={activeSection === 'info' ? 'true' : undefined}
              >
                Product information
              </button>
              <span className="mx-2 text-gray-300" aria-hidden>
                |
              </span>
              <button
                className={`px-2 py-1 rounded transition-colors ${
                  activeSection === 'reviews' ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-500'
                }`}
                type="button"
                onClick={() => handleSectionClick('reviews')}
                aria-current={activeSection === 'reviews' ? 'true' : 'false'}
              >
                Review{reviewCount > 0 && <span className="ml-1">({reviewCount})</span>}
              </button>
              {faqCount > 0 && (
                <>
                  <span className="mx-2 text-gray-300" aria-hidden>
                    |
                  </span>
                  <button
                    className={`px-2 py-1 rounded transition-colors ${
                      activeSection === 'faqs' ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-500'
                    }`}
                    type="button"
                    onClick={() => handleSectionClick('faqs')}
                    aria-current={activeSection === 'faqs' ? 'true' : 'false'}
                  >
                    FAQ
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop menu bar */}
      <div className="hidden md:block w-full bg-primary">
        <div className="container mx-auto px-4">
          <nav className="flex items-stretch justify-center">
            {navigation.map((item, idx) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-6 py-3 font-medium text-white hover:text-white/80 transition-colors ${
                  idx !== 0 ? 'border-l border-white/25' : ''
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile nav drawer */}
      <Sheet open={mobileMenuOpen && !isCartOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 z-[100001]" hideClose>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>Main navigation menu with links and actions</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center">
                <img
                  src={`${WP_BASE_URL}/wp-content/uploads/2025/08/Kitchenhero-logo.png`}
                  alt="Logo"
                  className="h-8 w-auto"
                  width={128}
                  height={32}
                  decoding="async"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <XMarkIcon className="h-6 w-6" />
              </Button>
            </div>

            {/* Action tiles */}
            <div className="p-4 grid grid-cols-1 gap-3">
              <a
                href="https://wa.me/8801835868877"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:border-primary hover:bg-primary/5 transition"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#25D366] text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M12.04 2c-5.52 0-10 4.41-10 9.84 0 1.74.47 3.44 1.37 4.94L2 22l5.4-1.76a10.2 10.2 0 0 0 4.64 1.12h.01c5.52 0 10-4.41 10-9.84 0-2.63-1.08-5.09-3.05-6.95A10.5 10.5 0 0 0 12.04 2Zm-.01 18.27h-.01a8.7 8.7 0 0 1-4.37-1.18l-.31-.18-3.21 1.05 1.05-3.01-.2-.31a8.2 8.2 0 0 1-1.26-4.39c0-4.54 3.76-8.23 8.38-8.23 2.24 0 4.35.86 5.94 2.42 1.58 1.56 2.45 3.63 2.45 5.81 0 4.54-3.76 8.22-8.38 8.22Zm4.6-6.16c-.25-.13-1.47-.72-1.7-.8-.23-.08-.4-.12-.57.12-.17.24-.66.8-.81.96-.15.16-.3.18-.55.06-.25-.12-1.05-.38-2-1.21-.74-.65-1.24-1.46-1.39-1.7-.15-.24-.02-.37.11-.49.12-.12.25-.28.37-.43.12-.15.16-.24.24-.4.08-.16.04-.3-.02-.43-.06-.12-.57-1.36-.78-1.85-.21-.49-.41-.42-.57-.43-.15-.01-.33-.01-.5-.01-.17 0-.44.06-.67.31-.23.24-.88.86-.88 2.1 0 1.24.9 2.45 1.02 2.62.12.16 1.76 2.75 4.32 3.75.6.23 1.07.37 1.44.47.61.19 1.16.16 1.6.1.49-.07 1.47-.6 1.68-1.19.21-.59.21-1.09.15-1.19-.06-.1-.23-.16-.48-.29Z" />
                  </svg>
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-xs font-medium">WhatsApp</span>
                  <span className="text-[11px] text-muted-foreground">01835868877</span>
                </div>
              </a>

              <a
                href="tel:01835868877"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:border-primary hover:bg-primary/5 transition"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                  <PhoneIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-xs font-medium">Hotline</span>
                  <span className="text-[11px] text-muted-foreground">01835868877</span>
                </div>
              </a>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/account?tab=orders');
                }}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:border-primary hover:bg-primary/5 transition"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                  <ClipboardDocumentListIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-xs font-medium">My Orders</span>
                  <span className="text-[11px] text-muted-foreground">View Orders</span>
                </div>
              </button>
            </div>

            <div className="px-4 pt-2 pb-4 overflow-y-auto border-t">
              <nav className="space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="mt-auto p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openCart();
                }}
              >
                <ShoppingCartIcon className="h-4 w-4 mr-2" />
                <span suppressHydrationWarning>{isMounted ? `Cart (${totalItems})` : 'Cart'}</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile search offcanvas */}
      <SearchOffCanvas isOpen={mobileSearchOpen} onClose={() => setMobileSearchOpen(false)}>
        {/* If your SearchOffCanvas supports children, you can render a mobile search form here */}
      </SearchOffCanvas>

      {/* Auth Modal for mobile and desktop */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultTab={authModalTab}
      />
    </header>
  );
};

/** ---------- Utils ---------- */
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

export default Header;
