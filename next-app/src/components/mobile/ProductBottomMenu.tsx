import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ProductActionButtons from '../product/ProductActionButtons';
import { WooProduct, WooVariation } from '@/lib/woocommerce';
import { Capacitor } from '@capacitor/core';
import { useCartStore } from '@/store/cartStore';

interface ProductBottomMenuProps {
  product: WooProduct;
  selectedVariation?: WooVariation | null;
  selectedVariationId?: number | null;
  quantity: number;
  disabled?: boolean;
  disabledMessage?: string;
  currentQuantity?: number;
  variationNotSelected?: boolean;
  onScrollToVariations?: () => void;
}

const ProductBottomMenu = ({
  product,
  selectedVariation,
  selectedVariationId,
  quantity,
  disabled = false,
  disabledMessage,
  currentQuantity = 0,
  variationNotSelected = false,
  onScrollToVariations
}: ProductBottomMenuProps) => {
  const { isOpen: isCartOpen } = useCartStore();
  
  const handleDisabledClick = () => {
    if (disabled && disabledMessage) {
      alert(disabledMessage);
    } else if (variationNotSelected) {
      alert('আগে প্রোডাক্ট নির্বাচন করুন। যেটি নিতে চান, সেটিতে ক্লিক করুন।');
    }
  };

  // Dynamic button text for Add to Cart
  const addToCartText = currentQuantity > 0 ? `Add to Cart (${currentQuantity})` : 'Add to Cart';

  const isNative = Capacitor.isNativePlatform();
  
  // State to track if mobile menu is open
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check for mobile menu state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobileMenu = () => {
      // Check for Sheet component with side="left" that is open
      const sheetContent = document.querySelector('[data-radix-dialog-content][class*="left-0"]');
      const isOpen = sheetContent?.getAttribute('data-state') === 'open';
      setIsMobileMenuOpen(isOpen || false);
    };

    // Check initially
    checkMobileMenu();

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(checkMobileMenu);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-state'],
      subtree: true,
    });

    // Also listen for click events that might open/close the menu
    document.addEventListener('click', checkMobileMenu);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', checkMobileMenu);
    };
  }, []);

  // Hide bottom menu when cart is open or mobile menu is open
  if (isCartOpen || isMobileMenuOpen) {
    return null;
  }
  
  const menuContent = (
    <div 
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-[99999] p-3 shadow-lg"
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 99999,
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        ...(isNative && {
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))'
        })
      }}
    >
      <ProductActionButtons
        product={product}
        selectedVariation={selectedVariation}
        selectedVariationId={selectedVariationId}
        quantity={quantity}
        variant="mobile"
        disabled={disabled}
        disabledMessage={disabledMessage}
        onScrollToVariations={onScrollToVariations}
        className="gap-3"
      />

      {/* Product Note - Mobile */}
      {product.product_note && (
        <div className="mt-2 mb-1">
          <div
            className="text-sm text-muted-foreground prose prose-sm max-w-none text-center"
            dangerouslySetInnerHTML={{ __html: product.product_note }}
          />
        </div>
      )}

      {disabled && disabledMessage && (
        <p className="text-sm text-red-600 text-center mt-2 font-medium bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {disabledMessage}
        </p>
      )}
    </div>
  );

  // Render using portal to ensure it's outside any parent containers that might interfere
  if (typeof window !== 'undefined' && document.body) {
    return createPortal(menuContent, document.body);
  }
  
  return null;
};

export default ProductBottomMenu;