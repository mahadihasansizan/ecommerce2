import AccountClient from './AccountClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account - KitchenHero',
  description: 'Manage your account, orders, and preferences.',
};

const AccountPage = () => <AccountClient />;

export default AccountPage;
