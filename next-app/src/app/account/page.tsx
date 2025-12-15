import { Suspense } from 'react';
import AccountClient from './AccountClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account - KitchenHero',
  description: 'Manage your account, orders, and preferences.',
};

const AccountPage = () => (
  <Suspense fallback={<div className="container mx-auto px-4 py-12 text-center">Loading...</div>}>
    <AccountClient />
  </Suspense>
);

export default AccountPage;

