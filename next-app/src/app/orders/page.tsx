import OrdersClient from './OrdersClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orders - KitchenHero',
  description: 'View your order history and status.',
};

const OrdersPage = () => <OrdersClient />;

export default OrdersPage;
