'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { fetchOrderById, WooOrder } from '@/lib/orders';
import { deferStateUpdate } from '@/lib/utils';

const statusColors: Record<string, string> = {
  processing: 'border-amber-200 bg-amber-100 text-amber-800',
  completed: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  pending: 'border-slate-300 bg-slate-100 text-slate-700',
  cancelled: 'border-rose-200 bg-rose-100 text-rose-700',
  refunded: 'border-sky-200 bg-sky-100 text-sky-700',
};

const formatMoney = (value?: string, currency?: string) => {
  if (!value) return '0.00';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency ? `${currency} ` : ''}${formatted}`.trim();
};

const computeTotals = (order?: WooOrder | null) => {
  if (!order) return null;
  return {
    subtotal: order.subtotal || order.total || '0',
    shipping: order.shipping_total || '0',
    tax: order.total_tax || '0',
    discount: Math.abs(Number(order.discount_total || '0')).toString(),
    total: order.total || '0',
    currency: order.currency,
  };
};

const OrderDetailClient = ({ orderId }: { orderId: string }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [order, setOrder] = useState<WooOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!orderId || !isAuthenticated) {
      return;
    }

    const controller = new AbortController();
    deferStateUpdate(() => {
      setLoading(true);
      setError(null);
    });

    fetchOrderById(orderId, controller.signal)
      .then((result) => setOrder(result))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [orderId, isAuthenticated]);

  const totals = useMemo(() => computeTotals(order), [order]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-2xl font-semibold">Unable to load order</p>
        <p className="text-muted-foreground">{error}</p>
        <Button asChild>
          <Link href="/orders" className="flex items-center gap-2">
            <ArrowLeftIcon className="h-4 w-4" /> Back to orders
          </Link>
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center px-4">
        <p className="text-muted-foreground">Order details will appear once the order is placed.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Order</p>
          <h1 className="text-3xl font-bold">Order #{order.number || order.id}</h1>
          <p className="text-muted-foreground">Status: {order.status || 'processing'}</p>
        </div>
        <Button asChild>
          <Link href="/orders" className="flex items-center gap-2">
            <ArrowLeftIcon className="h-4 w-4" /> Back to orders
          </Link>
        </Button>
      </div>

      <Card className="space-y-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Order Summary</span>
            <Badge className={`border ${statusColors[order.status || 'pending'] || statusColors.pending}`}>
              {order.status?.replace(/_/g, ' ') || 'pending'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Placed on</p>
              <p>{order.date_created ? new Date(order.date_created).toLocaleDateString() : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total amount</p>
              <p className="text-lg font-semibold">
                {formatMoney(totals?.total, totals?.currency)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {(order.line_items || []).map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    {item.image?.src ? (
                      <img src={item.image.src} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-muted" />
                    )}
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(item.total, order.currency)}</p>
                </div>
              </div>
            ))}
          </div>

          {totals && (
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotal, totals.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{formatMoney(totals.shipping, totals.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatMoney(totals.tax, totals.currency)}</span>
              </div>
              {totals.discount && totals.discount !== '0' && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span>
                  <span>-{formatMoney(totals.discount, totals.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatMoney(totals.total, totals.currency)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">
              {(order.billing?.first_name || '') + ' ' + (order.billing?.last_name || '')}
            </p>
            {order.billing?.company && <p>{order.billing.company}</p>}
            <p>{order.billing?.address_1}</p>
            {order.billing?.address_2 && <p>{order.billing.address_2}</p>}
            <p>
              {order.billing?.city}, {order.billing?.state} {order.billing?.postcode}
            </p>
            <p>{order.billing?.country}</p>
            <p className="text-muted-foreground">{order.billing?.email}</p>
          </CardContent>
        </Card>
        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">
              {(order.shipping?.first_name || '') + ' ' + (order.shipping?.last_name || '')}
            </p>
            <p>{order.shipping?.address_1}</p>
            {order.shipping?.address_2 && <p>{order.shipping.address_2}</p>}
            <p>
              {order.shipping?.city}, {order.shipping?.state} {order.shipping?.postcode}
            </p>
            <p>{order.shipping?.country}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Method</span>
              <span>{order.payment_method_title || 'Cash on delivery'}</span>
            </div>
            {order.transaction_id && (
              <div className="flex justify-between">
                <span>Transaction ID</span>
                <span className="font-mono text-xs text-muted-foreground">{order.transaction_id}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex gap-3 flex-wrap">
          <Button asChild>
            <Link href="/products">Continue shopping</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/orders">Back to orders</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailClient;
