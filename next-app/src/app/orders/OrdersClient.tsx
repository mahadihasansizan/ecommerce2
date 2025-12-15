'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { fetchOrders } from '@/lib/orders';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
  processing: 'border-amber-200 bg-amber-100 text-amber-800',
  completed: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  pending: 'border-slate-300 bg-slate-100 text-slate-700',
  cancelled: 'border-rose-200 bg-rose-100 text-rose-700',
  refunded: 'border-sky-200 bg-sky-100 text-sky-700',
};

const OrdersClient = () => {
  const router = useRouter();
  const { session, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const { data: orders, isLoading: ordersLoading, error } = useQuery({
    queryKey: ['orders', session?.customerId],
    queryFn: () => fetchOrders(session!.customerId!),
    enabled: !!session?.customerId,
  });

  if (isLoading || (ordersLoading && isAuthenticated)) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <Button asChild variant="outline">
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-rose-200">
          <CardContent className="pt-6 text-center text-rose-600">
            <p>Unable to load your orders. Please try again later.</p>
          </CardContent>
        </Card>
      ) : !orders || orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground mb-4">You haven't placed any orders yet.</p>
            <Button asChild>
              <Link href="/products">Start Shopping</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden transition-colors hover:bg-slate-50">
              <Link href={`/orders/${order.id}`} className="block">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Order #{order.number || order.id}</span>
                        <Badge className={`border ${statusColors[order.status || 'pending'] || statusColors.pending}`}>
                          {order.status?.replace(/-/g, ' ') || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.date_created ? new Date(order.date_created).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Date unknown'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-semibold">
                          {order.currency} {Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <ArrowRightIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersClient;
