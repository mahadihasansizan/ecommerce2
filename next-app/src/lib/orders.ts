import { WP_PROXY_BASE_URL } from './config';

const PROXY_SECRET = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET;

export type WooLineItem = {
  id: number;
  name: string;
  quantity: number;
  price?: string;
  total: string;
  sku?: string;
  image?: { src?: string };
  meta_data?: Array<{ key?: string; value?: string | number }>;
};

export type WooOrder = {
  id: number | string;
  number?: string | number;
  status?: string;
  date_created?: string;
  total?: string;
  subtotal?: string;
  total_tax?: string;
  discount_total?: string;
  shipping_total?: string;
  payment_method_title?: string;
  transaction_id?: string;
  currency?: string;
  line_items?: WooLineItem[];
  shipping_lines?: Array<{ total?: string; price?: string }>;
  billing?: Record<string, any>;
  shipping?: Record<string, any>;
  meta_data?: Array<{ key?: string; value?: unknown }>;
};

export async function fetchOrderById(id: string, signal?: AbortSignal): Promise<WooOrder> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (PROXY_SECRET) {
    headers['X-HPM-Secret'] = PROXY_SECRET;
  }

  const response = await fetch(`${WP_PROXY_BASE_URL}/proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint: `/orders/${id}`, params: {}, method: 'GET' }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || 'Unable to load order');
  }

  return response.json();
}
