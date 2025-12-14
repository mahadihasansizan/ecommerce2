import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { WooProduct, WooVariation } from '@/lib/woocommerce';
import { useCartStore } from '@/store/cartStore';
import { toast as shadcnToast } from '@/components/ui/use-toast';
import { toast } from 'sonner';
import { pushDL, GTM_CURRENCY } from '@/lib/gtm';

interface ProductActionButtonsProps {
  product: WooProduct;
  selectedVariation?: WooVariation | null;
  selectedVariationId?: number | null;
  quantity: number;
  className?: string;
  variant?: 'default' | 'mobile';
  disabled?: boolean;
  disabledMessage?: string;
  onScrollToVariations?: () => void;
}

const ProductActionButtons: React.FC<ProductActionButtonsProps> = ({
  product,
  selectedVariation,
  selectedVariationId,
  quantity,
  className = '',
  variant = 'default',
  disabled = false,
  disabledMessage,
  onScrollToVariations
}) => {
  const { addToCart, openCart } = useCartStore();

  // Prevent duplicate tracking
  const addToCartInProgressRef = useRef<boolean>(false);
  const buyNowInProgressRef = useRef<boolean>(false);

  const handleAddToCart = async () => {
    if (addToCartInProgressRef.current || disabled) return;
    addToCartInProgressRef.current = true;

    try {
      let selectedVar: WooVariation | null = null;
      const attrs: Record<string, string> = {};

      // Handle variable products
      if (product.type === "variable") {
        if (!selectedVariationId) {
          toast.error("Please select the product variation you want and then add to cart");
          onScrollToVariations?.();
          return;
        }

        const variation = selectedVariation || null;
        if (!variation) {
          toast.error("Please select the product variation you want and then add to cart");
          onScrollToVariations?.();
          return;
        }
        selectedVar = variation;
        (variation.attributes || []).forEach(a => {
          if (a.name && a.option) attrs[a.name] = a.option;
        });
      }

      // Single pixel tracking for add to cart
      const item = {
        item_id: String(selectedVar?.id ?? product.id),
        item_name: product.name,
        sku: selectedVar?.sku || product.sku || undefined,
        item_variant: selectedVar ? (selectedVar.attributes || []).map(a => a.option).filter(Boolean).join(" / ") : undefined,
        price: Number(selectedVar?.price || selectedVar?.sale_price || product.price || product.sale_price || 0),
        quantity: 1,
        item_category: product.categories?.[0]?.name || '',
        google_business_vertical: "retail"
      };

      // Add to cart (don't open cart sidebar, just show animation)
      addToCart(product, selectedVar ?? undefined, quantity, attrs, false);

      // Show success toast for all variants with auto-dismiss after 1 second
      toast.success("Product added to cart", {
        description: `${product.name} has been added to your cart.`,
        duration: 1000, // Auto dismiss after 1 second
        dismissible: true, // Allow manual dismissal with cross button
      });
    } catch (error) {
      shadcnToast({
        variant: "destructive",
        title: "Failed to add to cart",
        description: "Please try again."
      });
    } finally {
      addToCartInProgressRef.current = false;
    }
  };

  const handleBuyNow = () => {
    if (buyNowInProgressRef.current || disabled) return;
    buyNowInProgressRef.current = true;

    try {
      // Handle variable products
      if (product.type === "variable") {
        if (!selectedVariationId) {
          shadcnToast({
            variant: "destructive",
            title: "Please select the product variation you want and then add to cart"
          });
          onScrollToVariations?.();
          return;
        }

        const variation = selectedVariation || null;
        if (!variation) {
          shadcnToast({
            variant: "destructive",
            title: "Please select the product variation you want and then add to cart"
          });
          onScrollToVariations?.();
          return;
        }

        const attrs: Record<string, string> = {};
        (variation.attributes || []).forEach(a => {
          if (a.name && a.option) attrs[a.name] = a.option;
        });

        // GA4 begin_checkout tracking
        const item = {
          item_id: String(variation.id),
          item_name: product.name,
          sku: variation.sku || product.sku || undefined,
          item_variant: (variation.attributes || []).map(a => a.option).filter(Boolean).join(" / "),
          price: Number(variation.price || variation.sale_price || 0),
          quantity: 1,
          item_category: product.categories?.[0]?.name || '',
          google_business_vertical: "retail"
        };

        pushDL("begin_checkout", {
          ecommerce: {
            currency: GTM_CURRENCY,
            value: item.price,
            items: [item]
          }
        });

        addToCart(product, variation ?? undefined, quantity, attrs, false);
      } else {
        // Simple product
        const item = {
          item_id: String(product.id),
          item_name: product.name,
          sku: product.sku || undefined,
          price: Number(product.price || product.sale_price || 0),
          quantity: 1,
          item_category: product.categories?.[0]?.name || '',
          google_business_vertical: "retail"
        };

        pushDL("begin_checkout", {
          ecommerce: {
            currency: GTM_CURRENCY,
            value: item.price,
            items: [item]
          }
        });

        addToCart(product, undefined, quantity, undefined, false);
      }

      // Skip cart opening for buy now
      if (typeof window !== "undefined") {
        sessionStorage.setItem("kh_skip_cart_open", "1");
      }

      // Force page reload for GA tracking instead of SPA navigation
      window.location.href = "/checkout";
    } catch (error) {
      shadcnToast({
        variant: "destructive",
        title: "Failed to proceed to checkout",
        description: "Please try again."
      });
    } finally {
      buyNowInProgressRef.current = false;
    }
  };

  const buttonClass = variant === 'mobile'
    ? "flex-1 py-3 flex items-center justify-center gap-2"
    : "flex-1 py-3 flex items-center justify-center gap-2";

  return (
    <div className={`flex gap-3 ${className}`}>
      <Button
        variant="outline"
        className={`${buttonClass} bg-white hover:bg-gray-50`}
        onClick={handleAddToCart}
        disabled={disabled}
      >
        <span className="leading-none">
          Add to Cart
        </span>
      </Button>

      <Button
        className={buttonClass}
        onClick={handleBuyNow}
        disabled={disabled}
      >
        <span className="leading-none">
          Buy Now
        </span>
      </Button>

      {disabled && disabledMessage && (
        <p className="text-sm text-red-600 text-center mt-2 font-medium">
          {disabledMessage}
        </p>
      )}
    </div>
  );
};

export default ProductActionButtons;
