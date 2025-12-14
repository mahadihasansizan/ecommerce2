'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { deferStateUpdate } from '@/lib/utils';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'signup';
}

const AuthModal = ({ open, onOpenChange, defaultTab = 'login' }: AuthModalProps) => {
  const router = useRouter();
  const { login, signup, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(defaultTab);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Signup form state
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
  });
  const [signupError, setSignupError] = useState<string | null>(null);

  // Reset forms when modal opens/closes
  useEffect(() => {
    if (!open) return;
    deferStateUpdate(() => {
      setActiveTab(defaultTab);
      setLoginError(null);
      setSignupError(null);
      setLoginUsername('');
      setLoginPassword('');
      setSignupForm({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
      });
    });
  }, [open, defaultTab]);

  // Close modal and navigate to account when authenticated
  useEffect(() => {
    if (isAuthenticated && open) {
      onOpenChange(false);
      router.push('/account');
    }
  }, [isAuthenticated, open, router, onOpenChange]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(loginUsername.trim(), loginPassword);
      // Navigation handled by useEffect above
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed. Please try again.');
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    try {
      await signup({
        email: signupForm.email.trim(),
        username: signupForm.username.trim(),
        password: signupForm.password,
        firstName: signupForm.firstName.trim(),
        lastName: signupForm.lastName.trim(),
      });
      // Navigation handled by useEffect above
    } catch (err: any) {
      setSignupError(err?.message || 'Signup failed. Please try again.');
    }
  };

  const updateSignupForm = (key: keyof typeof signupForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSignupForm({ ...signupForm, [key]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80%] max-w-[80%] sm:max-w-[600px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-left">Welcome</DialogTitle>
          <DialogDescription className="text-left">Login to your account or create a new one</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Username or Email</Label>
                <Input
                  id="login-username"
                  placeholder="you@example.com"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {loginError && <p className="text-sm text-red-600">{loginError}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Login'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-firstName">First name</Label>
                  <Input
                    id="signup-firstName"
                    value={signupForm.firstName}
                    onChange={updateSignupForm('firstName')}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-lastName">Last name</Label>
                  <Input
                    id="signup-lastName"
                    value={signupForm.lastName}
                    onChange={updateSignupForm('lastName')}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupForm.email}
                  onChange={updateSignupForm('email')}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  value={signupForm.username}
                  onChange={updateSignupForm('username')}
                  placeholder="kitchenhero"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupForm.password}
                  onChange={updateSignupForm('password')}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              {signupError && <p className="text-sm text-red-600">{signupError}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
