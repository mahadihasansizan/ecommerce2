'use server';

import { getProductsWithMeta } from '@/lib/woocommerce';

export async function fetchProducts(page: number, params: any) {
    try {
        const { products, total } = await getProductsWithMeta({
            ...params,
            page,
            per_page: 26, // Match PRODUCT_LIST_PAGE_SIZE from loaders.ts
            status: 'publish',
        });
        return { products, total };
    } catch (error) {
        console.error('Error fetching products:', error);
        return { products: [], total: 0 };
    }
}
