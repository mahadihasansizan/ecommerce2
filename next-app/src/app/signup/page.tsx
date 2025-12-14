import SignupClient from './SignupClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - KitchenHero',
  description: 'Create a new KitchenHero account to start shopping.',
};

const SignupPage = () => <SignupClient />;

export default SignupPage;
