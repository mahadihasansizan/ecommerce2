import { createContext, useContext, useState } from "react";
import { WooProduct, WooVariation } from "@/lib/woocommerce";

type CartItem = {
  product: WooProduct;
  quantity: number;
  variation?: WooVariation;
  size?: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: WooProduct, quantity: number, size?: string) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: WooProduct, quantity: number, size?: string) => {
    setCart((prev) => [...prev, { product, quantity, size }]);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart }}>
      {children}
    </CartContext.Provider>
  );
};