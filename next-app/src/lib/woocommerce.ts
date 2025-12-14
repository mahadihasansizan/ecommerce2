import axios from 'axios';
import { WP_API_BASE, WC_API_BASE } from './config';

const envVars = process.env;

const WP_PROXY_BASE =
  envVars.NEXT_PUBLIC_WP_PROXY_BASE_URL || '/wp-json/headless-proxy/v1';

const WP_PROXY_SECRET =
  envVars.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET || 'change-me-please';

// Generic proxy function for all WooCommerce API calls
// Plugin expects: POST /wp-json/headless-proxy/v1/proxy
// Body: { endpoint: "/products", params: {...}, method: "GET|POST|PUT|DELETE" }
export const proxyRequest = async (endpoint: string, params?: any, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): Promise<any> => {
  try {
    // Normalize endpoint - ensure it starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const headers: any = { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json'
    };
    
    // Add proxy authentication header
    if (WP_PROXY_SECRET && WP_PROXY_SECRET !== 'change-me-please') {
      headers['X-HPM-Secret'] = WP_PROXY_SECRET;
    }

    const url = `${WP_PROXY_BASE}/proxy`;
    const body = { 
      endpoint: normalizedEndpoint, 
      params: params || {}, 
      method: method.toUpperCase() 
    };

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => resp.statusText || '');
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Check if it's an invalid endpoint error - these are expected for optional endpoints
      if (resp.status === 400 && errorData.code === 'invalid_endpoint') {
        // Silently handle invalid endpoint errors - these are expected for optional features
        const abortError = new Error('Invalid endpoint') as Error;
        abortError.name = 'InvalidEndpointError';
        throw abortError;
      }
      
      throw new Error(`Proxy request failed: ${resp.status} ${errorText}`);
    }

    const responseData = await resp.json();
    return responseData;
  } catch (proxyErr) {
    // Don't log AbortError or InvalidEndpointError as they're expected
    if (proxyErr instanceof Error && (proxyErr.name === 'AbortError' || proxyErr.name === 'InvalidEndpointError')) {
      // Silently handle abort and invalid endpoint - these are expected behaviors
      throw proxyErr;
    }
    console.error('❌ Proxy request exception:', proxyErr);
    throw proxyErr;
  }
};

// Legacy constants (kept for backward compatibility but not used)
const WC_API_URL = envVars.DEV
  ? '/wp-json/wc/v3'  // Use proxy in development
  : envVars.VITE_WC_API_URL || WC_API_BASE; // Use full URL in production
const CONSUMER_KEY = envVars.VITE_WC_CONSUMER_KEY;
const CONSUMER_SECRET = envVars.VITE_WC_CONSUMER_SECRET;

// Remove wooCommerceAPI entirely - all requests now go through proxy
// const wooCommerceAPI = axios.create({
//   baseURL: WC_API_URL,
//   timeout: 10000,
//   params: {
//     consumer_key: CONSUMER_KEY,
//     consumer_secret: CONSUMER_SECRET,
//   },
// });

// --- Types ---
export interface WooProductAttribute {
  id?: number;
  name?: string;
  taxonomy?: string;
  variation?: boolean;
  options?: string[];
}

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  price_html?: string; // Added for variable products
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: any[];
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: {
    id: number;
    name: string;
    slug: string;
  }[];
  tags: any[];
  images: {
    id: number;
    date_created: string;
    date_modified: string;
    src: string;
    name: string;
    alt: string;
  }[];
  attributes: any[];
  default_attributes: any[];
  variations: number[];
  grouped_products: any[];
  menu_order: number;
  meta_data: any[];
  product_layout?: string;
  variation_width?: number;
  brand?: {
    name: string;
  };
  free_delivery?: boolean;
  product_note?: string;
}

export interface WooCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: {
    id: number;
    date_created: string;
    date_created_gmt: string;
    date_modified: string;
    date_modified_gmt: string;
    src: string;
    name: string;
    alt: string;
  } | null;
  menu_order: number;
  count: number;
}

export interface WooVariation {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  description: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  status: string;
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  downloads: any[];
  download_limit: number;
  download_expiry: number;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_class: string;
  shipping_class_id: number;
  image: {
    id: number;
    date_created: string;
    date_created_gmt: string;
    date_modified: string;
    date_modified_gmt: string;
    src: string;
    name: string;
    alt: string;
  } | null;
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  menu_order: number;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
  name?: string;
  parent_id?: number;
}

export interface WooState {
  code: string;
  name: string;
}

export interface WooCountry {
  code: string;
  name: string;
  states?: WooState[];
}

export interface WooStoreContext {
  currency: string;
  currency_symbol: string;
  default_country: string;
  default_state?: string;
  base_location?: {
    country?: string;
    state?: string;
    city?: string;
    postcode?: string;
    address_1?: string;
    address_2?: string;
  };
}

// Simple caches to avoid repetitive calls while browsing checkout
let cachedStoreContext: WooStoreContext | null = null;
let cachedCountries: WooCountry[] | null = null;

// API Functions
export const getProducts = async (params?: {
  page?: number;
  per_page?: number;
  search?: string;
  category?: string;
  tag?: string;
  featured?: boolean;
  on_sale?: boolean;
  min_price?: number;
  max_price?: number;
  orderby?: string;
  order?: 'asc' | 'desc';
  _fields?: string; // Optional: specify fields to return
  status?: string; // Product status filter (if provided, only that status; otherwise fetch both publish and private)
}): Promise<WooProduct[]> => {
  try {
    // Optimize: Don't pass _fields from frontend - let PHP proxy handle it automatically
    // This ensures consistent field filtering on the backend
    
    // If status is explicitly provided, use it; otherwise fetch both 'publish' and 'private' products
    // WooCommerce API only accepts one status value per request, so we make two calls if needed
    if (params?.status) {
      // Use the explicitly provided status
      const data = await proxyRequest('/products', params);
      // Filter to ensure only publish/private (exclude draft/pending)
      return (data || []).filter((product: WooProduct) => 
        product.status === 'publish' || product.status === 'private'
      );
    } else {
      // Fetch both published and private products (exclude draft/pending)
      const [publishedData, privateData] = await Promise.all([
        proxyRequest('/products', { ...params, status: 'publish' }),
        proxyRequest('/products', { ...params, status: 'private' }).catch(() => []) // Private might not exist, so catch error
      ]);
      
      // Merge and deduplicate by product ID
      const allProducts = [...(publishedData || []), ...(privateData || [])];
      const uniqueProducts = Array.from(
        new Map(allProducts.map((product: WooProduct) => [product.id, product])).values()
      );
      
      // Additional filter to ensure only publish/private (safety check)
      return uniqueProducts.filter((product: WooProduct) => 
        product.status === 'publish' || product.status === 'private'
      );
    }
  } catch (error) {
    // Don't log AbortError - it's expected when requests are cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      return [];
    }
    console.error('Error fetching products:', error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

// Variant of getProducts that also returns pagination meta from response headers
export const getProductsWithMeta = async (params?: {
  page?: number;
  per_page?: number;
  search?: string;
  category?: string;
  tag?: string;
  featured?: boolean;
  on_sale?: boolean;
  min_price?: number;
  max_price?: number;
  orderby?: string;
  order?: 'asc' | 'desc';
  status?: string; // Product status filter (if provided, only that status; otherwise fetch both publish and private)
}): Promise<{ products: WooProduct[]; total?: number; totalPages?: number }> => {
  try {
    // Build proxy request similar to proxyRequest but keep access to response headers
    const normalizedEndpoint = '/products';
    const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (WP_PROXY_SECRET && WP_PROXY_SECRET !== 'change-me-please') {
      headers['X-HPM-Secret'] = WP_PROXY_SECRET;
    }

    // If status is explicitly provided, use it; otherwise fetch both 'publish' and 'private'
    let responseData: any[] = [];
    let totalHeader: string | null = null;
    let totalPagesHeader: string | null = null;

    if (params?.status) {
      // Use the explicitly provided status
      const finalParams = { ...params };
      const url = `${WP_PROXY_BASE}/proxy`;
      const body = { endpoint: normalizedEndpoint, params: finalParams, method: 'GET' };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => resp.statusText || '');
        throw new Error(`Proxy request failed: ${resp.status} ${errorText}`);
      }

      responseData = await resp.json();
      totalHeader = resp.headers.get('X-WP-Total') || resp.headers.get('x-wp-total');
      totalPagesHeader = resp.headers.get('X-WP-TotalPages') || resp.headers.get('x-wp-totalpages');
    } else {
      // Fetch both published and private products (exclude draft/pending)
      const [publishedResp, privateResp] = await Promise.all([
        fetch(`${WP_PROXY_BASE}/proxy`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            endpoint: normalizedEndpoint,
            params: { ...params, status: 'publish' },
            method: 'GET'
          }),
          signal: new AbortController().signal
        }),
        fetch(`${WP_PROXY_BASE}/proxy`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            endpoint: normalizedEndpoint,
            params: { ...params, status: 'private' },
            method: 'GET'
          }),
          signal: new AbortController().signal
        }).catch(() => null) // Private might not exist, so catch error
      ]);

      const publishedData = publishedResp.ok ? await publishedResp.json() : [];
      const privateData = privateResp?.ok ? await privateResp.json() : [];

      // Merge and deduplicate by product ID
      const allProducts = [...(publishedData || []), ...(privateData || [])];
      responseData = Array.from(
        new Map(allProducts.map((product: WooProduct) => [product.id, product])).values()
      );

      // Get total from published response (private products are typically fewer)
      totalHeader = publishedResp.headers.get('X-WP-Total') || publishedResp.headers.get('x-wp-total');
      totalPagesHeader = publishedResp.headers.get('X-WP-TotalPages') || publishedResp.headers.get('x-wp-totalpages');
    }

    const total = totalHeader ? parseInt(totalHeader, 10) : undefined;
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : undefined;

    // Additional client-side filter to ensure only published or private products are returned (exclude draft/pending)
    const filteredProducts = (responseData || []).filter((product: WooProduct) => 
      product.status === 'publish' || product.status === 'private'
    );

    return { products: filteredProducts, total, totalPages };
  } catch (error) {
    console.error('Error fetching products with meta:', error);
    return { products: [], total: undefined, totalPages: undefined };
  }
};

export const getProduct = async (id: number): Promise<WooProduct> => {
  try {
    // For single product detail, return all fields (no filtering)
    const data = await proxyRequest(`/products/${id}`);
    
    // Ensure only published or private products are returned (exclude draft/pending)
    if (data && data.status !== 'publish' && data.status !== 'private') {
      throw new Error('Product not available');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
};

export const getCategories = async (params?: {
  page?: number;
  per_page?: number;
  search?: string;
  orderby?: string;
  order?: 'asc' | 'desc';
}): Promise<WooCategory[]> => {
  try {
    // Ensure count is included in the response
    // WooCommerce API includes count by default, but we explicitly ensure it's not filtered
    const data = await proxyRequest('/products/categories', {
      ...params,
      // Don't use _fields parameter to ensure count is included
      // WooCommerce REST API includes count by default in category responses
    });
    // Ensure count is a number (default to 0 if missing)
    // Handle both number and string representations of count
    const categories = (data || []).map((cat: any) => {
      let count = 0;
      if (typeof cat.count === 'number') {
        count = cat.count;
      } else if (typeof cat.count === 'string') {
        const parsed = parseInt(cat.count, 10);
        count = isNaN(parsed) ? 0 : parsed;
      } else if (cat.count) {
        count = Number(cat.count) || 0;
      }
      return {
      ...cat,
        count
      };
    });
    return categories;
  } catch (error: any) {
    // Don't log AbortError - it's expected when requests are cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      return [];
    }
    console.error('Error fetching categories:', error);
    // Return empty array as fallback instead of throwing
    return [];
  }
};

export const getProductVariations = async (productId: number): Promise<WooVariation[]> => {
  try {
    const data = await proxyRequest(`/products/${productId}/variations`);
    return data || [];
  } catch (error) {
    console.error('Error fetching variations:', error);
    throw error;
  }
};

// Add getFeaturedProducts function
export const getFeaturedProducts = async (limit: number = 8): Promise<WooProduct[]> => {
  try {
    const params = {
      featured: true,
      per_page: limit,
      status: 'publish'
    };
    const data = await proxyRequest('/products', params);
    return data || [];
  } catch (error) {
    console.error('Error fetching featured products:', error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

// ---------------------------------------------------------------------------
// Store metadata helpers (currency, countries, defaults)
// ---------------------------------------------------------------------------

const parseDefaultCountrySetting = (value?: string): { country: string; state?: string } => {
  if (!value) return { country: 'BD', state: undefined };
  const [country, state] = value.split(':');
  return { country: country || 'BD', state: state || undefined };
};

const resolveCurrencySymbol = (currencyCode?: string): string => {
  const upper = (currencyCode || '').toUpperCase();
  if (upper === 'BDT') return 'BDT ';
  if (upper === 'USD') return '$';
  if (upper === 'EUR') return 'EUR ';
  if (upper === 'GBP') return 'GBP ';
  if (upper === 'INR') return 'INR ';
  return upper || 'BDT';
};

export const getCountries = async (forceRefresh: boolean = false): Promise<WooCountry[]> => {
  if (cachedCountries && !forceRefresh) {
    return cachedCountries;
  }

  try {
    const data = await proxyRequest('/data/countries');
    const countries = data || [];
    cachedCountries = countries;
    return countries;
  } catch (error) {
    console.error('Error fetching countries:', error);
    cachedCountries = [];
    return [];
  }
};

export const getCountryStates = async (countryCode: string): Promise<WooState[]> => {
  if (!countryCode) return [];

  try {
    const data = await proxyRequest(`/data/countries/${countryCode}`);
    return data?.states || [];
  } catch (error) {
    console.error(`Error fetching states for ${countryCode}:`, error);

    if (countryCode === 'BD') {
      return [
        { code: 'BD-05', name: 'Barisal' },
        { code: 'BD-01', name: 'Chittagong' },
        { code: 'BD-02', name: 'Dhaka' },
        { code: 'BD-03', name: 'Khulna' },
        { code: 'BD-04', name: 'Rajshahi' },
        { code: 'BD-06', name: 'Rangpur' },
        { code: 'BD-55', name: 'Sylhet' },
        { code: 'BD-54', name: 'Mymensingh' }
      ];
    }

    return [];
  }
};

export const getStoreContext = async (forceRefresh: boolean = false): Promise<WooStoreContext> => {
  if (cachedStoreContext && !forceRefresh) {
    return cachedStoreContext;
  }

  try {
    const settings = await proxyRequest('/settings/general');
    const getSetting = (id: string) => (settings || []).find((s: any) => s.id === id);

    const currency = getSetting('woocommerce_currency')?.value || 'BDT';
    const defaultCountrySetting = getSetting('woocommerce_default_country')?.value;
    const { country: default_country, state: default_state } = parseDefaultCountrySetting(defaultCountrySetting);

    const base_location = {
      country: default_country,
      state: default_state,
      city: getSetting('woocommerce_store_city')?.value || '',
      postcode: getSetting('woocommerce_store_postcode')?.value || '',
      address_1: getSetting('woocommerce_store_address')?.value || '',
      address_2: getSetting('woocommerce_store_address_2')?.value || ''
    };

    const context: WooStoreContext = {
      currency,
      currency_symbol: resolveCurrencySymbol(currency),
      default_country,
      default_state,
      base_location
    };

    cachedStoreContext = context;
    return context;
  } catch (error) {
    // Don't log AbortError - it's expected when requests are cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      return cachedStoreContext || {
        currency: 'BDT',
        currency_symbol: resolveCurrencySymbol('BDT'),
        default_country: 'BD',
      };
    }
    console.error('Error fetching store context:', error);
    cachedStoreContext = {
      currency: 'BDT',
      currency_symbol: resolveCurrencySymbol('BDT'),
      default_country: 'BD',
      default_state: undefined
    };
    return cachedStoreContext;
  }
};

export const createOrder = async (orderData: any): Promise<any> => {
  // Use the Headless Proxy Manager order endpoint
  const WP_ORDER_PROXY = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_URL;
  const WP_ORDER_PROXY_SECRET = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET;

  if (!WP_ORDER_PROXY) {
    throw new Error('Order proxy not configured. Please set NEXT_PUBLIC_WP_ORDER_PROXY_URL in environment variables.');
  }

  const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (WP_ORDER_PROXY_SECRET) headers['X-HPM-Secret'] = WP_ORDER_PROXY_SECRET;

  // Pull live store info so we don't hardcode currency/location/payment data
  const storeContext = await getStoreContext().catch((err) => {
    console.error('dY> Failed to hydrate store context:', err);
    return null;
  });

  const paymentGateways = await getPaymentGateways().catch((err) => {
    console.error('dY> Failed to fetch payment gateways:', err);
    return [];
  });

  const requestedPaymentId = orderData.payment_method;
  const resolvedPayment = paymentGateways.find((p: any) => p.id === requestedPaymentId) || paymentGateways.find((p: any) => p.enabled);
  const payment_method = resolvedPayment?.id || requestedPaymentId || 'cod';
  const payment_method_title = resolvedPayment?.title || resolvedPayment?.method_title || orderData.payment_method_title || 'Cash on delivery';

  const fallbackCountry = storeContext?.default_country || storeContext?.base_location?.country || 'BD';
  const fallbackState = storeContext?.default_state || storeContext?.base_location?.state || '';

  const safeBilling = {
    country: fallbackCountry,
    state: fallbackState,
    ...orderData.billing
  };

  const safeShipping = {
    country: fallbackCountry,
    state: orderData.shipping?.state || fallbackState,
    ...orderData.shipping
  };

  let shippingLines = orderData.shipping_lines;

  // If no shipping lines were provided, calculate them against WooCommerce live rates
  if ((!shippingLines || shippingLines.length === 0) && Array.isArray(orderData.line_items) && orderData.line_items.length) {
    try {
      const shippingQuote = await calculateShippingRates({
        shipping: safeShipping,
        billing: safeBilling,
        line_items: orderData.line_items.map((item: any) => ({
          product_id: Number(item.product_id),
          variation_id: item.variation_id ? Number(item.variation_id) : undefined,
          quantity: Number(item.quantity) || 1
        }))
      });

      if (shippingQuote.rates?.length) {
        const chosen = shippingQuote.rates.find(r => r.id === shippingQuote.selected_rate_id) || shippingQuote.rates[0];
        shippingLines = [{
          method_id: chosen.method_id,
          method_title: chosen.label || 'Shipping',
          total: Number(chosen.total || 0).toFixed(2),
          instance_id: chosen.instance_id,
          meta_data: chosen.meta_data
            ? Object.entries(chosen.meta_data).map(([key, value]) => ({ key, value }))
            : undefined
        }];
      } else {
        shippingLines = [];
      }
    } catch (err) {
      console.warn('dY> Shipping auto-selection failed, continuing without calculated rates', err);
      shippingLines = orderData.shipping_lines || [];
    }
  }

  const normalizedOrder = {
    ...orderData,
    billing: safeBilling,
    shipping: safeShipping,
    payment_method,
    payment_method_title,
    currency: orderData.currency || storeContext?.currency,
    shipping_lines: shippingLines || [],
    meta_data: orderData.meta_data || []
  };

  if (storeContext?.currency_symbol) {
    normalizedOrder.meta_data = [
      ...normalizedOrder.meta_data,
      { key: '_kh_currency_symbol', value: storeContext.currency_symbol }
    ];
  }

  // Creating order with normalized data

  const resp = await fetch(WP_ORDER_PROXY, {
    method: 'POST',
    headers,
    body: JSON.stringify(normalizedOrder)
  });

    // Order creation response received

  if (!resp.ok) {
    let errorText = '';
    const contentType = resp.headers.get('content-type');

    try {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await resp.json();
        errorText = JSON.stringify(errorData);
        console.error('dY> JSON error response:', errorData);
      } else {
        errorText = await resp.text();
        console.error('dY> Non-JSON error response:', errorText.substring(0, 500));
      }
    } catch (parseError) {
      console.error('dY> Failed to parse error response:', parseError);
      errorText = 'HTTP ' + resp.status + ' - Failed to parse response';
    }

    throw new Error('Order creation failed: ' + resp.status + ' ' + errorText);
  }

  // Try to parse the successful response
  let responseData;
  try {
    responseData = await resp.json();
    // Order created successfully
  } catch (jsonError) {
    console.error('dY> Failed to parse successful response as JSON:', jsonError);
    const textResponse = await resp.text();
    console.error('dY> Raw response text:', textResponse.substring(0, 500));
    throw new Error('Order created but received invalid JSON response from server');
  }

  return responseData;
};

export interface WooShippingRate {
  id: string;
  method_id: string;
  instance_id?: number;
  label?: string;
  total: number;
  meta_data?: Record<string, any>;
  currency?: string;
}

export const calculateShippingRates = async (payload: {
  shipping?: Record<string, any>;
  billing?: Record<string, any>;
  line_items: Array<{ product_id: number; variation_id?: number; quantity: number }>;
}): Promise<{ rates: WooShippingRate[]; selected_rate_id?: string | null }> => {
  if (!payload?.line_items?.length) {
    return { rates: [] };
  }

  const storeContext = await getStoreContext().catch(() => null);
  const normalizedPayload = {
    ...payload,
    shipping: {
      country: storeContext?.default_country,
      state: storeContext?.default_state,
      ...payload.shipping
    },
    billing: {
      country: storeContext?.default_country,
      state: storeContext?.default_state,
      ...payload.billing
    }
  };

  const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (WP_PROXY_SECRET && WP_PROXY_SECRET !== 'change-me-please') {
    headers['X-HPM-Secret'] = WP_PROXY_SECRET;
  }

  const url = `${WP_PROXY_BASE}/calculate-shipping`;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(normalizedPayload)
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => resp.statusText || '');
    throw new Error(`Shipping calculation failed: ${resp.status} ${errorText}`);
  }

  const data = await resp.json();
  return {
    rates: data?.rates || [],
    selected_rate_id: data?.selected_rate_id ?? null
  };
};

export const getDefaultCountryStates = async (): Promise<WooState[]> => {
  const ctx = await getStoreContext().catch(() => null);
  if (!ctx?.default_country) return [];
  return getCountryStates(ctx.default_country);
};

// Kept for backward compatibility; now delegates to the generic helper
export const getBangladeshStates = async (): Promise<WooState[]> => {
  return getCountryStates('BD');
};

// Mock price range utility (unused by checkout)
export async function getPriceRange(categorySlugs: string[]): Promise<{ min: number, max: number }> {
  return { min: 100, max: 10000 };
}

// Get currency symbol
export async function getCurrencySymbol(): Promise<string> {
  try {
    const ctx = await getStoreContext();
    return ctx.currency_symbol || resolveCurrencySymbol(ctx.currency);
  } catch (error) {
    console.error('Error fetching currency symbol:', error);
    return resolveCurrencySymbol('BDT');
  }
}

export const getPaymentGateways = async () => {
  try {
    const data = await proxyRequest('/payment_gateways');
    return data || [];
  } catch (error) {
    console.error('Error fetching payment gateways:', error);
    throw error;
  }
};

// Coupon interface and fetch by code
export interface WooCoupon {
  id: number;
  code: string;
  discount_type: 'fixed_cart' | 'percent';
  amount: string;
  date_expires: string | null;
  date_expires_gmt: string | null;
}

export const getCouponByCode = async (code: string): Promise<WooCoupon> => {
  try {
    const data = await proxyRequest('/coupons', { code });
    if (!data || data.length === 0) {
      throw new Error('Invalid coupon code');
    }
    return data[0];
  } catch (error) {
    console.error(`Error fetching coupon ${code}:`, error);
    throw error;
  }
}

// Add this function to support getProductBySlug import
export const getProductBySlug = async (slug: string): Promise<WooProduct | null> => {
  try {
    // First try to get the product directly by slug if the API supports it
    const data = await proxyRequest('/products', { slug });

    if (data && data.length > 0) {
      return data[0];
    }

    // Fallback to search if direct slug lookup doesn't work
    // Only search published/private products (exclude draft/pending)
    const products = await getProducts({ search: slug, status: 'publish' });
    return products.find(product => 
      product.slug === slug && (product.status === 'publish' || product.status === 'private')
    ) || null;
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    // Return null instead of throwing to prevent app crashes
    return null;
  }
};

// Alternative createOrder function using fetch directly with multiple fallback methods
export const createOrderDirect = async (orderData: any): Promise<any> => {
  throw new Error('Direct order creation is disabled for security. Use createOrder() which uses the secure proxy.');
};

// Function to validate product data
export const validateProductData = async (productId: number, variationId?: number): Promise<boolean> => {
  try {
    if (variationId) {
      // Validate variation exists
      const variations = await getProductVariations(productId);
      return variations.some(v => v.id === variationId);
    } else {
      // Validate product exists
      const product = await getProduct(productId);
      return !!product && product.id === productId;
    }
  } catch (error) {
    console.error('Error validating product:', error);
    return false;
  }
};

// Optimized search function - uses WooCommerce search API directly
export const searchProducts = async (query: string, limit: number = 10): Promise<WooProduct[]> => {
  try {
    // Validate query
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }

    // Optimized: Direct WooCommerce search with field filtering
    // The PHP proxy will automatically add field filtering and caching
    // Only search published/private products (exclude draft/pending)
    const products = await getProducts({
      search: trimmedQuery,
      per_page: limit,
      orderby: 'relevance',
      status: 'publish'
    });

    return products || [];
  } catch (error) {
    console.error('❌ Error searching products:', error);
    return [];
  }
};

export const validateOrderData = (orderData: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check required fields
  if (!orderData.payment_method) {
    errors.push('Payment method is required');
  }

  if (!orderData.billing) {
    errors.push('Billing information is required');
  } else {
    // Check if we have at least a first name (last name is optional)
    if (!orderData.billing.first_name || orderData.billing.first_name.trim() === '') {
      errors.push('Billing name is required');
    }
    if (!orderData.billing.email) {
      errors.push('Billing email is required');
    }
    if (!orderData.billing.address_1) {
      errors.push('Billing address is required');
    }
  }

  if (!orderData.shipping) {
    errors.push('Shipping information is required');
  }

  if (!orderData.line_items || !Array.isArray(orderData.line_items) || orderData.line_items.length === 0) {
    errors.push('At least one line item is required');
  } else {
    orderData.line_items.forEach((item: any, index: number) => {
      if (!item.product_id || item.product_id <= 0) {
        errors.push(`Line item ${index + 1}: Invalid product_id (${item.product_id})`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Line item ${index + 1}: Invalid quantity (${item.quantity})`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
