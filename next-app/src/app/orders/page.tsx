import OrdersClient from './OrdersClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orders - KitchenHero',
  description: 'Track the status of your recent orders.',
};

const OrdersPage = () => <OrdersClient />;

export default OrdersPage;
