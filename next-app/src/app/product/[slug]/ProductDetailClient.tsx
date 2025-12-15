'use client';

import { WooProduct } from '@/lib/woocommerce';
import ProductCollectionLayout from '@/components/product/ProductCollectionLayout';

const ProductDetailClient = ({ product }: { product: WooProduct }) => {
  return <ProductCollectionLayout product={product} />;
};

export default ProductDetailClient;
