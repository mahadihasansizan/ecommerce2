'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSiteName } from '@/hooks/useSiteInfo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { WP_PROXY_BASE_URL } from '@/lib/config';

type WooLineItem = {
  id: number;
  name: string;
  quantity: number;
  sku?: string;
  total: string;
  price?: string;
  image?: { src?: string };
};

type WooOrder = {
  id: number;
  status: string;
  date_created: string;
  total: string;
  subtotal?: string;
  total_tax?: string;
  discount_total?: string;
  shipping_total?: string;
  payment_method_title?: string;
  transaction_id?: string;
  currency?: string;
  line_items?: WooLineItem[];
  billing?: any;
  shipping?: any;
};

const PROXY_SECRET = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET;

async function fetchOrder(id: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (PROXY_SECRET) {
    headers['X-HPM-Secret'] = PROXY_SECRET;
  }
  const resp = await fetch(`${WP_PROXY_BASE_URL}/proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint: `/orders/${id}`,
      params: {},
      method: 'GET',
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(text || 'Unable to load order');
  }
  return (await resp.json()) as WooOrder;
}

function formatMoney(total?: string, currency?: string) {
  if (!total) return '0.00';
  const num = Number(total);
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency || ''} ${formatted}`.trim();
}

const statusColors: Record<string, string> = {
  processing: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-slate-200 text-slate-700 border-slate-300',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
  refunded: 'bg-blue-100 text-blue-700 border-blue-200',
};

const OrderDetailClient = ({ orderId }: { orderId: string }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const siteName = useSiteName();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const { data, isLoading: orderLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId || ''),
    enabled: !!orderId && !!isAuthenticated,
  });

  const order = data;

  const totals = useMemo(() => {
    if (!order) return null;
    return {
      subtotal: order.subtotal || order.total,
      shipping: order.shipping_total || '0',
      tax: order.total_tax || '0',
      discount: order.discount_total || '0',
      total: order.total,
      currency: order.currency,
    };
  }, [order]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/orders">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Orders
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Order #{orderId}</h1>
        </div>

        {orderLoading && (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading order...</p>
          </Card>
        )}

        {error && (
          <Card className="p-6 border border-rose-200">
            <p className="text-rose-600">Failed to load order.</p>
          </Card>
        )}

        {order && (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Order Summary</h2>
                    <p className="text-sm text-muted-foreground">
                      Placed on{' '}
                      {new Date(order.date_created).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <Badge className={`capitalize border ${statusColors[order.status] || statusColors.pending}`}>
                    {order.status}
                  </Badge>
                </div>

                <div className="space-y-4">
                  {(order.line_items || []).map((item) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0">
                      {item.image?.src ? (
                        <img src={item.image.src} alt={item.name} className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <div className="h-16 w-16 bg-slate-100 rounded flex items-center justify-center text-sm text-muted-foreground">
                          Item
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(item.total, order.currency)}</p>
                        {item.price && (
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(item.price, order.currency)} each
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {totals && (
                  <div className="mt-6 pt-6 border-t space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatMoney(totals.subtotal, totals.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>{formatMoney(totals.shipping, totals.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatMoney(totals.tax, totals.currency)}</span>
                    </div>
                    {totals.discount && totals.discount !== '0' && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount</span>
                        <span>-{formatMoney(totals.discount, totals.currency)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatMoney(totals.total, totals.currency)}</span>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Addresses</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {order.billing && (
                    <div className="space-y-1 text-sm">
                      <h3 className="font-semibold text-muted-foreground uppercase tracking-wide text-xs">Billing</h3>
                      <p className="font-medium">
                        {order.billing.first_name} {order.billing.last_name}
                      </p>
                      {order.billing.company && <p>{order.billing.company}</p>}
                      <p>{order.billing.address_1}</p>
                      {order.billing.address_2 && <p>{order.billing.address_2}</p>}
                      <p>
                        {order.billing.city}, {order.billing.state} {order.billing.postcode}
                      </p>
                      <p>{order.billing.country}</p>
                      <p className="pt-2">{order.billing.email}</p>
                      <p>{order.billing.phone}</p>
                    </div>
                  )}

                  {order.shipping && (
                    <div className="space-y-1 text-sm">
                      <h3 className="font-semibold text-muted-foreground uppercase tracking-wide text-xs">Shipping</h3>
                      <p className="font-medium">
                        {order.shipping.first_name} {order.shipping.last_name}
                      </p>
                      {order.shipping.company && <p>{order.shipping.company}</p>}
                      <p>{order.shipping.address_1}</p>
                      {order.shipping.address_2 && <p>{order.shipping.address_2}</p>}
                      <p>
                        {order.shipping.city}, {order.shipping.state} {order.shipping.postcode}
                      </p>
                      <p>{order.shipping.country}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Order Actions</h2>
                <p className="text-sm text-muted-foreground">Status updates from this page are not enabled yet.</p>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Payment</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium">{order.payment_method_title || 'N/A'}</span>
                  </div>
                  {order.transaction_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction ID</span>
                      <span className="font-mono text-xs">{order.transaction_id}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailClient;
