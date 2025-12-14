import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WooProduct } from '@/lib/woocommerce';
import { gsap } from 'gsap';

export interface WishlistItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  image: string;
  slug: string;
  product: WooProduct;
  addedAt: number; // timestamp
}

interface WishlistState {
  items: WishlistItem[];
  addToWishlist: (product: WooProduct) => void;
  removeFromWishlist: (productId: number) => void;
  isInWishlist: (productId: number) => boolean;
  getTotalItems: () => number;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => {
      return {
        items: [],

        addToWishlist: (product) => {
          set((state) => {
            // Check if product is already in wishlist
            const exists = state.items.find((item) => item.productId === product.id);
            if (exists) {
              return state; // Already in wishlist, don't add again
            }

            const price = parseFloat(product.price) || 0;
            const image = product.images?.[0]?.src || '/placeholder.svg';

            const newItem: WishlistItem = {
              id: product.id,
              productId: product.id,
              name: product.name,
              price,
              image,
              slug: product.slug,
              product,
              addedAt: Date.now(),
            };

            return {
              items: [...state.items, newItem],
            };
          });

          // Animate wishlist icon when item is added
          const wishlistIcon = document.querySelector('[data-wishlist-icon]');
          if (wishlistIcon) {
            gsap.fromTo(
              wishlistIcon,
              { scale: 1 },
              {
                scale: 1.3,
                duration: 0.3,
                yoyo: true,
                repeat: 1,
                ease: 'power2.out',
              }
            );
          }
        },

        removeFromWishlist: (productId) => {
          set((state) => ({
            items: state.items.filter((item) => item.productId !== productId),
          }));
        },

        isInWishlist: (productId) => {
          return get().items.some((item) => item.productId === productId);
        },

        getTotalItems: () => {
          return get().items.length;
        },

        clearWishlist: () => {
          set({ items: [] });
        },
      };
    },
    {
      name: 'kitchenhero-wishlist',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

