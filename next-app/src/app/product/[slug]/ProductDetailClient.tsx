'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WooProduct } from '@/lib/woocommerce';
import { useCartStore } from '@/store/cartStore';
import { formatBDT } from '@/lib/utils';

const ProductDetailClient = ({ product }: { product: WooProduct }) => {
  const { addToCart } = useCartStore();
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    addToCart(product, undefined, quantity);
  };

  const price = parseFloat(product.price || '0');
  const displayPrice = Number.isNaN(price) ? product.price : formatBDT(price);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="relative min-h-[420px]">
          {product.images?.[0]?.src ? (
            <Image
              src={product.images[0].src}
              alt={product.images[0].alt || product.name}
              width={800}
              height={800}
              className="object-cover w-full h-full rounded-2xl"
            />
          ) : (
            <div className="w-full h-full bg-muted rounded-2xl" />
          )}
        </div>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-lg text-muted-foreground">{displayPrice}</p>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: product.short_description || product.description }} />
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="w-20 border border-border rounded px-3 py-2"
            />
          </div>
          <Button size="lg" onClick={handleAddToCart} className="w-full">
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailClient;
