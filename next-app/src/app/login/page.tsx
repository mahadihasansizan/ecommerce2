import LoginClient from './LoginClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - KitchenHero',
  description: 'Sign in to your KitchenHero account and manage orders.',
};

const LoginPage = () => <LoginClient />;

export default LoginPage;
