import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import NProgress from 'nprogress';
import { WooProduct, getStoreContext } from './woocommerce';
const envVars = process.env;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Progress Bar Utilities
export const progressBar = {
  start: () => {
    if (typeof window !== 'undefined') {
      NProgress.start();
    }
  },
  done: () => {
    if (typeof window !== 'undefined') {
      NProgress.done();
    }
  },
  inc: (amount?: number) => {
    if (typeof window !== 'undefined') {
      NProgress.inc(amount);
    }
  },
  set: (n: number) => {
    if (typeof window !== 'undefined') {
      NProgress.set(n);
    }
  }
};
// WooCommerce product metadata types
interface WooProductMeta {
  key: string;
  value: string | number | boolean;
}

export function mapMetaToProduct(product: WooProduct): WooProduct {
  if (!product || !product.meta_data) return product;
  product.meta_data.forEach((meta: any) => {
    if (meta.key === "_product_layout") {
      product.product_layout = String(meta.value);
    }
  });
  // Map free_delivery from meta_data if present
  const freeDeliveryMeta = product.meta_data.find((meta: any) => meta.key === "_kh_free_delivery");
  if (freeDeliveryMeta) {
    product.free_delivery = freeDeliveryMeta.value === "yes";
  }
  return product;
}

const FALLBACK_CURRENCY_SYMBOL = "$";
let cachedCurrencySymbol: string | null = null;
let cachedCurrencyCode: string | null = null;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  'BDT': '৳',
  'THB': '฿',
  'USD': '$',
  'GBP': '£',
  'EUR': '€',
  'INR': '₹',
  'CNY': '¥',
  'JPY': '¥',
  'AUD': '$',
  'CAD': '$',
  'SGD': '$',
  'MYR': 'RM',
  'IDR': 'Rp',
  'PKR': '₨',
  'LKR': 'Rs',
  'AED': 'د.إ',
  'SAR': '﷼',
  'QAR': '﷼',
  'ZAR': 'R',
  'BRL': 'R$',
  'RUB': '₽',
  'KRW': '₩',
  'TRY': '₺',
};

const loadStoredCurrencySymbol = (): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('kh_currency_symbol');
      return stored && stored.trim() ? stored : null;
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

const storeCurrencySymbol = (symbol: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage && symbol) {
      window.localStorage.setItem('kh_currency_symbol', symbol);
    }
  } catch {
    // ignore storage errors
  }
};

const loadStoredCurrencyCode = (): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('kh_currency_code');
      return stored && stored.trim() ? stored : null;
    }
  } catch {
    //
  }
  return null;
};

const storeCurrencyCode = (code: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage && code) {
      window.localStorage.setItem('kh_currency_code', code);
    }
  } catch {
    //
  }
};

export const setCurrencySymbol = (symbol: string) => {
  if (symbol && symbol.trim()) {
    cachedCurrencySymbol = symbol;
    storeCurrencySymbol(symbol);
  }
};

export const setCurrencyCode = (code: string) => {
  if (code && code.trim()) {
    cachedCurrencyCode = code;
    storeCurrencyCode(code);
  }
};

export const getCurrencySymbolSync = (): string => {
  if (cachedCurrencySymbol && cachedCurrencySymbol.trim()) return cachedCurrencySymbol;
  const stored = loadStoredCurrencySymbol();
  if (stored) {
    cachedCurrencySymbol = stored;
    return stored;
  }

  // Try to resolve from cached code if available
  const code = getCurrencyCodeSync();
  if (code && CURRENCY_SYMBOLS[code]) {
    return CURRENCY_SYMBOLS[code];
  }

  return FALLBACK_CURRENCY_SYMBOL;
};

export const getCurrencySymbolAsync = async (forceRefresh: boolean = false): Promise<string> => {
  if (!forceRefresh && cachedCurrencySymbol && cachedCurrencySymbol.trim()) {
    return cachedCurrencySymbol;
  }
  const stored = loadStoredCurrencySymbol();
  if (!forceRefresh && stored) {
    cachedCurrencySymbol = stored;
    return stored;
  }
  try {
    const ctx = await getStoreContext(forceRefresh);

    // Resolve symbol: Map(code) -> ctx.symbol -> ctx.code -> fallback
    let symbol = FALLBACK_CURRENCY_SYMBOL;

    if (ctx.currency) {
      setCurrencyCode(ctx.currency);
      if (CURRENCY_SYMBOLS[ctx.currency]) {
        symbol = CURRENCY_SYMBOLS[ctx.currency];
      } else if (ctx.currency_symbol) {
        symbol = ctx.currency_symbol;
      } else {
        symbol = ctx.currency;
      }
    } else if (ctx.currency_symbol) {
      symbol = ctx.currency_symbol;
    }

    const finalSymbol = symbol.endsWith(' ') ? symbol : `${symbol} `;
    setCurrencySymbol(finalSymbol);
    return cachedCurrencySymbol || FALLBACK_CURRENCY_SYMBOL;
  } catch (error) {
    console.warn('Failed to load currency from WooCommerce:', error);
    return FALLBACK_CURRENCY_SYMBOL;
  }
};

export const getCurrencyCodeSync = (): string => {
  if (cachedCurrencyCode && cachedCurrencyCode.trim()) return cachedCurrencyCode;
  const stored = loadStoredCurrencyCode();
  if (stored) {
    cachedCurrencyCode = stored;
    return stored;
  }
  return '';
};

export const getCurrencyCodeAsync = async (): Promise<string> => {
  if (cachedCurrencyCode && cachedCurrencyCode.trim()) return cachedCurrencyCode;
  const stored = loadStoredCurrencyCode();
  if (stored) {
    cachedCurrencyCode = stored;
    return stored;
  }
  try {
    const ctx = await getStoreContext();
    if (ctx.currency) {
      setCurrencyCode(ctx.currency);
      return ctx.currency;
    }
  } catch {
    //
  }
  return '';
};

export const deferStateUpdate = (callback: () => void) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback);
  } else {
    setTimeout(callback, 0);
  }
};

// Decode HTML entities like &amp; &nbsp; etc.
export const decodeHtmlEntities = (text: string): string => {
  if (typeof document !== 'undefined') {
    const parser = new DOMParser();
    return parser.parseFromString(`<!doctype html><body>${text}`, 'text/html').body.textContent || text;
  }
  // Server-side fallback
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

/**
 * Highlight search term in text and truncate if needed
 * Returns an object with parts to render
 */
export interface HighlightedText {
  before: string;
  match: string;
  after: string;
  showStartEllipsis: boolean;
  showEndEllipsis: boolean;
}

export const highlightSearchTerm = (text: string, searchTerm: string, maxLength: number = 50): HighlightedText => {
  if (!text) {
    return { before: '', match: '', after: '', showStartEllipsis: false, showEndEllipsis: false };
  }

  if (!searchTerm) {
    const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    return { before: truncated, match: '', after: '', showStartEllipsis: false, showEndEllipsis: text.length > maxLength };
  }

  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const searchIndex = lowerText.indexOf(lowerSearch);

  if (searchIndex === -1) {
    // Search term not found, just truncate
    const truncated = text.length > maxLength ? text.substring(0, maxLength) : text;
    return { before: truncated, match: '', after: '', showStartEllipsis: false, showEndEllipsis: text.length > maxLength };
  }

  // Find the start and end positions for highlighting
  const start = searchIndex;
  const end = start + searchTerm.length;

  // Determine truncation points
  let displayStart = 0;
  let displayEnd = text.length;
  let showStartEllipsis = false;
  let showEndEllipsis = false;

  if (text.length > maxLength) {
    // Try to center the search term in the visible portion
    const halfLength = Math.floor(maxLength / 2);
    const searchCenter = start + (searchTerm.length / 2);

    displayStart = Math.max(0, Math.floor(searchCenter - halfLength));
    displayEnd = Math.min(text.length, displayStart + maxLength);

    // Adjust if we're near the start or end
    if (displayEnd - displayStart < maxLength) {
      displayStart = Math.max(0, displayEnd - maxLength);
    }

    if (displayStart > 0) showStartEllipsis = true;
    if (displayEnd < text.length) showEndEllipsis = true;
  }

  // Extract the visible portion
  const visibleText = text.substring(displayStart, displayEnd);
  const visibleSearchStart = start - displayStart;
  const visibleSearchEnd = visibleSearchStart + searchTerm.length;

  // Split the visible text into parts: before, search term, after
  const before = visibleText.substring(0, visibleSearchStart);
  const match = visibleText.substring(visibleSearchStart, visibleSearchEnd);
  const after = visibleText.substring(visibleSearchEnd);

  return {
    before,
    match,
    after,
    showStartEllipsis,
    showEndEllipsis
  };
};

/**
 * Truncate text with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// Format number with thousand separators, currency symbol first
export const formatBDT = (n: number) =>
  `${getCurrencySymbolSync()}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const numbersFromString = (s: string): number[] =>
  (s.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g) || [])
    .map((x) => parseFloat(x.replace(/,/g, "")))
    .filter((n) => !Number.isNaN(n));

// Parse price_html for variable products
export const parseVariablePriceRange = (priceHtml: string): { min?: number; max?: number } => {
  const stripHtml = (html: string) =>
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const extractTagged = (tag: string) => {
    return (priceHtml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")) || [])
      .map((chunk) => stripHtml(chunk))
      .join(" ");
  };

  const insText = extractTagged("ins");
  const delText = extractTagged("del");
  const insNums = numbersFromString(insText);
  if (insNums.length) {
    return { min: Math.min(...insNums), max: Math.max(...insNums) };
  }

  const delNums = new Set(numbersFromString(delText));
  const allNums = numbersFromString(stripHtml(priceHtml)).filter((n) => !delNums.has(n));
  if (allNums.length) {
    return { min: Math.min(...allNums), max: Math.max(...allNums) };
  }

  const rawNums = numbersFromString(
    stripHtml(priceHtml)
      .replace(/price range:/gi, "")
      .replace(/from/gi, "")
      .replace(/through/gi, "")
  );
  if (rawNums.length) {
    return { min: Math.min(...rawNums), max: Math.max(...rawNums) };
  }

  return {};
};

export function cleanPriceHtml(html?: string): string {
  if (!html) return "";
  try {
    let out = String(html);

    // Handle sale prices: extract from <ins> if present
    const insMatch = out.match(/<ins[^>]*>([\s\S]*?)<\/ins>/i);
    if (insMatch) {
      out = insMatch[1];
    } else {
      // For ranges, take first meaningful segment
      out = out.split(/<br|\n|<\/p>/i)[0] || out;
    }

    // Strip screen-reader spans and other tags
    out = out.replace(/<span[^>]*class=["']?[^"'>]*screen-reader-text[^"'>]*["']?[^>]*>[\s\S]*?<\/span>/gi, "");
    out = out.replace(/<[^>]+>/g, " ").replace(/\u00A0/g, " ").trim();

    // Remove common suffixes
    out = out.replace(/price range[:\s\S]*$/i, "").trim();
    out = out.replace(/\bthrough\b[\s\S]*$/i, "").trim();
    out = out.replace(/\s+/g, " ").trim();

    return out;
  } catch {
    return String(html).replace(/<[^>]+>/g, "").trim();
  }
}

export const stripHtml = (html?: string) =>
  (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Get the site base URL dynamically
 * Priority:
 * 1. Environment variable NEXT_PUBLIC_SITE_URL (for build-time configuration)
 * 2. Current window location (for runtime detection - multi-tenant)
 * 3. Fallback to default (should not be used in production)
 */
export const getSiteUrl = (): string => {
  const envSiteUrl = envVars.NEXT_PUBLIC_SITE_URL;
  if (envSiteUrl) {
    return envSiteUrl;
  }

  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.protocol}//${window.location.host}`;
  }

  if (envSiteUrl) {
    return envSiteUrl;
  }
  console.warn(
    'getSiteUrl: No domain detected; set NEXT_PUBLIC_SITE_URL to avoid fallback.'
  );
  return 'http://localhost:3000';
};

// Cache for site info to avoid repeated API calls
let cachedSiteInfo: { site_name: string; store_base_url: string; site_url: string } | null = null;
let siteInfoPromise: Promise<{ site_name: string; store_base_url: string; site_url: string }> | null = null;

/**
 * Fetch site info from the API (site name and store base URL)
 */
export const fetchSiteInfo = async (): Promise<{ site_name: string; store_base_url: string; site_url: string }> => {
  // Return cached value if available
  if (cachedSiteInfo) {
    return cachedSiteInfo;
  }

  // Return existing promise if already fetching
  if (siteInfoPromise) {
    return siteInfoPromise;
  }

  // Create new fetch promise
  siteInfoPromise = (async () => {
    try {
      const WP_PROXY_BASE = envVars.NEXT_PUBLIC_WP_PROXY_BASE_URL || '/wp-json/headless-proxy/v1';
      const response = await fetch(`${WP_PROXY_BASE}/site-info`);

      if (!response.ok) {
        throw new Error(`Failed to fetch site info: ${response.status}`);
      }

      const data = await response.json();
      cachedSiteInfo = {
        site_name: data.site_name || 'Store',
        store_base_url: data.store_base_url || getSiteUrl(),
        site_url: data.site_url || getSiteUrl(),
      };
      return cachedSiteInfo;
    } catch (error) {
      console.warn('Failed to fetch site info from API, using fallback:', error);
      // Return fallback values
      const fallback = {
        site_name: 'Store',
        store_base_url: getSiteUrl(),
        site_url: getSiteUrl(),
      };
      cachedSiteInfo = fallback;
      return fallback;
    } finally {
      siteInfoPromise = null;
    }
  })();

  return siteInfoPromise;
};

/**
 * Get store base URL (preferred over site URL for API calls)
 */
export const getStoreBaseUrl = async (): Promise<string> => {
  const siteInfo = await fetchSiteInfo();
  return siteInfo.store_base_url;
};

/**
 * Get site name dynamically from API
 */
export const getSiteNameFromAPI = async (): Promise<string> => {
  const siteInfo = await fetchSiteInfo();
  return siteInfo.site_name;
};

/**
 * Get site name synchronously (returns cached value or fallback)
 */
export const getSiteNameSync = (): string => {
  if (cachedSiteInfo) {
    return cachedSiteInfo.site_name;
  }
  // Try to get from WordPress site name if available
  if (typeof window !== 'undefined' && (window as any).__SITE_NAME__) {
    return (window as any).__SITE_NAME__;
  }
  return 'Store'; // Fallback
};

/**
 * Generate canonical URL from a path
 * @param path - The path (e.g., '/product/air-jordan-1')
 * @returns Absolute canonical URL
 */
export const getCanonicalUrl = (path: string): string => {
  const siteUrl = getSiteUrl();
  // Remove trailing slash and ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${cleanPath}`;
};

/**
 * Generate canonical URL for a product
 * @param slug - Product slug
 * @returns Absolute canonical URL
 */
export const getProductCanonicalUrl = (slug: string): string => {
  return getCanonicalUrl(`/product/${slug}`);
};

/**
 * Generate canonical URL for a category
 * @param slug - Category slug
 * @returns Absolute canonical URL
 */
export const getCategoryCanonicalUrl = (slug: string): string => {
  return getCanonicalUrl(`/categories/${slug}`);
};

/**
 * Clean URL path by removing query parameters and fragments
 * Used for canonical URLs to avoid duplicate content
 * @param path - Full path with potential query params
 * @returns Clean path without query params
 */
export const cleanPathForCanonical = (path: string): string => {
  // Remove query parameters and hash fragments
  return path.split('?')[0].split('#')[0];
};

/**
 * Check if a URL should be canonicalized to a base URL
 * @param currentPath - Current path with potential filters/params
 * @param basePath - Base path to canonicalize to
 * @returns True if should canonicalize
 */
export const shouldCanonicalizeToBase = (currentPath: string, basePath: string): boolean => {
  const cleanCurrent = cleanPathForCanonical(currentPath);
  const cleanBase = cleanPathForCanonical(basePath);

  // If paths are the same after cleaning, no need to canonicalize
  if (cleanCurrent === cleanBase) {
    return false;
  }

  // Check if current path starts with base path (e.g., filtered category page)
  return cleanCurrent.startsWith(cleanBase);
};
