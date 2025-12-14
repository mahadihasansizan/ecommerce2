import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WooProduct, WooVariation } from '@/lib/woocommerce';
import { getCouponByCode } from '@/lib/woocommerce';

export interface CartItem {
  id: string;
  productId: number;
  variationId?: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  attributes?: {
    [key: string]: string;
  };
  product: WooProduct;
  variation?: WooVariation;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  showAddBanner: boolean;
  addToCart: (product: WooProduct, variation?: WooVariation, quantity?: number, attributes?: { [key: string]: string }, openCart?: boolean) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  hideAddBanner: () => void;
}

// add couponAmountRaw to store type
interface CartStateWithCoupon extends CartState {
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  couponCode: string;
  couponType: string | null;
  couponAmountRaw: number;      // raw amount from Woo
  couponDiscount: number;       // computed discount
  couponLoading: boolean;
  couponError: string | null;
  couponApplied: boolean;
  initiateCheckoutTracked: boolean;
  purchaseTracked: boolean;
  setInitiateCheckoutTracked: (tracked: boolean) => void;
  setPurchaseTracked: (tracked: boolean) => void;
}

const generateCartItemId = (productId: number, variationId?: number, attributes?: { [key: string]: string }): string => {
  const attributesString = attributes ? Object.entries(attributes).sort().map(([key, value]) => `${key}:${value}`).join('|') : '';
  return `${productId}${variationId ? `-${variationId}` : ''}${attributesString ? `-${attributesString}` : ''}`;
};

export const useCartStore = create<CartStateWithCoupon>()(
  persist(
    (set, get) => {
      // helper to recalculate discount after cart changes
      const recalcCoupon = () => {
        const {
          couponCode,
          couponType,
          couponAmountRaw,
          getTotalPrice
        } = get() as CartStateWithCoupon;
        if (!couponCode || !couponType) {
          set({ couponDiscount: 0 });
          return;
        }
        const subtotal = getTotalPrice();
        let discount = couponType === 'percent'
          ? (couponAmountRaw / 100) * subtotal
          : couponAmountRaw;
        if (discount > subtotal) discount = subtotal;
        set({ couponDiscount: discount });
      };

      return {
        items: [],
        isOpen: false,
        showAddBanner: false,
        // coupon defaults
        couponCode: '',
        couponType: null,
        couponAmountRaw: 0,
        couponDiscount: 0,
        couponLoading: false,
        couponError: null,
        couponApplied: false,
        initiateCheckoutTracked: false,
        purchaseTracked: false,

        setInitiateCheckoutTracked: (tracked) => set({ initiateCheckoutTracked: tracked }),
        setPurchaseTracked: (tracked) => set({ purchaseTracked: tracked }),

        addToCart: (product, variation, quantity = 1, attributes, openCart = true) => {
          const id = generateCartItemId(product.id, variation?.id, attributes);
          let price = 0;
          if (variation?.price) price = parseFloat(variation.price) || 0;
          else price = parseFloat(product.price) || 0;
          const image = variation?.image?.src || product.images?.[0]?.src || '';

          set(state => {
            const exists = state.items.find(i => i.id === id);
            const items = exists
              ? state.items.map(i =>
                  i.id === id ? { ...i, quantity: i.quantity + quantity } : i
                )
              : [
                  ...state.items,
                  { id, productId: product.id, variationId: variation?.id, name: product.name,
                    price, image, quantity, attributes, product, variation }
                ];
            return { 
              items, 
              isOpen: openCart ? true : state.isOpen, 
              showAddBanner: openCart ? true : state.showAddBanner 
            };
          });
          recalcCoupon();
        },

        removeFromCart: itemId => {
          set(state => ({ items: state.items.filter(i => i.id !== itemId) }));
          recalcCoupon();
        },

        updateQuantity: (itemId, qty) => {
          if (qty <= 0) {
            get().removeFromCart(itemId);
            return;
          }
          set(state => ({
            items: state.items.map(i =>
              i.id === itemId ? { ...i, quantity: qty } : i
            )
          }));
          recalcCoupon();
        },

        clearCart: () => {
          set({ items: [] });
          recalcCoupon();
        },

        getTotalItems: () =>
          get().items.reduce((sum, i) => sum + i.quantity, 0),

        getTotalPrice: () =>
          get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

        openCart: () => set({ isOpen: true }),

        closeCart: () => set({ isOpen: false, showAddBanner: false }),

        toggleCart: () =>
          set(state => ({
            isOpen: !state.isOpen,
            showAddBanner: state.isOpen ? false : state.showAddBanner
          })),

        hideAddBanner: () => set({ showAddBanner: false }),

        applyCoupon: async code => {
          const subtotal = get().getTotalPrice();
          set({ couponLoading: true, couponError: null });
          try {
            const coupon = await getCouponByCode(code.trim());
            const amt = parseFloat(coupon.amount) || 0;
            let discount =
              coupon.discount_type === 'percent'
                ? (amt / 100) * subtotal
                : amt;
            if (discount > subtotal) discount = subtotal;
            set({
              couponCode: code.trim(),
              couponType: coupon.discount_type,
              couponAmountRaw: amt,
              couponDiscount: discount,
              couponLoading: false,
              couponError: null,
              couponApplied: true
            });
          } catch (err: unknown) {
            const error = err as Error;
            set({
              couponLoading: false,
              couponError: error?.message || 'Invalid coupon',
              couponCode: '',
              couponType: null,
              couponAmountRaw: 0,
              couponDiscount: 0,
              couponApplied: false
            });
            throw err;
          }
        },

        removeCoupon: () => {
          set({
            couponCode: '',
            couponType: null,
            couponAmountRaw: 0,
            couponDiscount: 0,
            couponLoading: false,
            couponError: null,
            couponApplied: false
          });
        },

        // Add this method to get quantity for a specific product
        getProductQuantity: (productId: number) => {
          const items = get().items;
          const item = items.find((i) => i.product.id === productId);
          return item ? item.quantity : 0;
        },
      };
    },
    { name: 'kitchenhero-cart', partialize: state => ({ items: state.items }) }
  )
);