'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

const AccountClient = () => {
  const { session, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-lg">Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Account</p>
          <h1 className="text-3xl font-bold">{session.firstName || session.username || 'Hi there'}</h1>
          <p className="text-muted-foreground">{session.email}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/orders')}>
            View Orders
          </Button>
          <Button variant="ghost" onClick={logout} className="text-red-500">
            Sign out
          </Button>
        </div>
      </div>
      <section className="rounded-2xl border border-border p-6 space-y-4 leading-relaxed">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Session</p>
          <Badge variant="secondary">{session.customerId ? 'Linked' : 'Guest'}</Badge>
        </div>
        <p>
          You are signed in and can manage your account, review orders, and update your shipping addresses.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/wishlist" className="text-sm text-primary underline">
            Wishlist
          </Link>
          <Link href="/products" className="text-sm text-primary underline">
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
};

export default AccountClient;
