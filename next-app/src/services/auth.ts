import { WC_API_BASE, WC_CONSUMER_KEY, WC_CONSUMER_SECRET, WP_BASE_URL } from '@/lib/config';

export type AuthSession = {
  token: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  customerId?: number;
  avatarUrl?: string;
};

type JwtLoginResponse = {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name?: string;
};

type WooCustomer = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
};

function getBasicAuthHeader() {
  if (!WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) return undefined;
  const auth = btoa(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`);
  return `Basic ${auth}`;
}

async function fetchWithWooAuth<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  const basicAuth = getBasicAuthHeader();
  if (basicAuth) {
    headers.Authorization = basicAuth;
  }

  const resp = await fetch(`${WC_API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => resp.statusText);
    throw new Error(errorText || 'WooCommerce request failed');
  }

  return resp.json();
}

async function fetchCustomerByEmail(email: string): Promise<WooCustomer | null> {
  const customers = await fetchWithWooAuth<WooCustomer[]>(
    `/customers?search=${encodeURIComponent(email)}&per_page=1`,
    { method: 'GET' },
  );
  if (!customers || !customers.length) return null;
  return customers[0];
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const resp = await fetch(`${WP_BASE_URL}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(error.message || 'Unable to log in. Please check your credentials.');
  }

  const data = (await resp.json()) as JwtLoginResponse;
  const customer = await fetchCustomerByEmail(data.user_email);

  return {
    token: data.token,
    email: data.user_email,
    username: data.user_nicename,
    firstName: customer?.first_name || data.user_display_name,
    lastName: customer?.last_name,
    customerId: customer?.id,
    avatarUrl: customer?.avatar_url,
  };
}

export async function signup(payload: {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const basicAuth = getBasicAuthHeader();
  if (!basicAuth) {
    throw new Error('Missing WooCommerce consumer key/secret in environment.');
  }

  await fetchWithWooAuth<WooCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email,
      username: payload.username,
      password: payload.password,
      first_name: payload.firstName,
      last_name: payload.lastName,
    }),
  });

  // Auto-login after successful signup
  return login(payload.username, payload.password);
}

export async function refreshCustomer(email: string) {
  return fetchCustomerByEmail(email);
}

