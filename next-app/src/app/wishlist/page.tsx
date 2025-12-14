import WishlistClient from './WishlistClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wishlist - KitchenHero',
  description: 'Saved products you plan to buy.',
};

const WishlistPage = () => <WishlistClient />;

export default WishlistPage;
