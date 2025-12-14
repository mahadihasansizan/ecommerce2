'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { formatBDT } from '@/lib/utils';

const CartClient = () => {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.getTotalPrice());
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const clearCart = useCartStore((state) => state.clearCart);

  const hasItems = items.length > 0;
  const formattedTotal = useMemo(() => formatBDT(total), [total]);

  if (!hasItems) {
    return (
      <div className="container mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">Browse products and add them to your cart.</p>
        <Button asChild>
          <Link href="/products">Start Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-6">
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-xl bg-muted">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill className="object-cover" unoptimized />
              ) : (
                <div className="h-full w-full bg-border" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="text-lg font-semibold">{item.name}</h2>
              <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
              <p className="text-lg font-bold">{formatBDT(item.price * item.quantity)}</p>
              <div className="flex gap-3 text-sm text-primary">
                <button onClick={() => removeFromCart(item.id)} className="underline">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-muted p-6 space-y-3 text-right">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Total</p>
        <h2 className="text-3xl font-bold">{formattedTotal}</h2>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={clearCart}>
            Clear Cart
          </Button>
          <Button asChild>
            <Link href="/checkout">Proceed to Checkout</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CartClient;
