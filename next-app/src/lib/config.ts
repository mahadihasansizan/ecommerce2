
const envVars = process.env;

const WORDPRESS_BASE =
  envVars.NEXT_PUBLIC_WORDPRESS_BASE_URL ||
  'https://lightgreen-crab-324738.hostingersite.com';

// Headless Proxy Manager base URL built from env or default
export const WP_PROXY_BASE_URL =
  envVars.NEXT_PUBLIC_WP_PROXY_BASE_URL ||
  `${WORDPRESS_BASE}/wp-json/headless-proxy/v1`;

export const WP_BASE_URL = WORDPRESS_BASE;
export const WP_API_BASE = WP_PROXY_BASE_URL;
export const WC_API_BASE = `${WORDPRESS_BASE}/wp-json/wc/v3`;
export const WC_CONSUMER_KEY = envVars.NEXT_PUBLIC_WC_CONSUMER_KEY;
export const WC_CONSUMER_SECRET = envVars.NEXT_PUBLIC_WC_CONSUMER_SECRET;
