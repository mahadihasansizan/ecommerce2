import CartClient from './CartClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cart - KitchenHero',
  description: 'Review the items you intend to purchase.',
};

const CartPage = () => <CartClient />;

export default CartPage;
