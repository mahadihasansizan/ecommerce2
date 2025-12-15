'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSiteName } from '@/hooks/useSiteInfo';
import {
  Squares2X2Icon,
  CubeIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  UserIcon,
  CreditCardIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { formatBDT } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { proxyRequest } from '@/lib/woocommerce';

type Order = {
  id: number;
  status: 'processing' | 'completed' | 'pending' | string;
  date_created: string;
  total: number;
  currency: string;
  items: number;
};

type WooAddress = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  email?: string;
};

type WooCustomer = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  billing?: WooAddress;
  shipping?: WooAddress;
};

const statusStyles: Record<string, string> = {
  processing: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-slate-200 text-slate-700 border-slate-300',
  canceled: 'bg-rose-100 text-rose-700 border-rose-200',
  refunded: 'bg-blue-100 text-blue-700 border-blue-200',
};

const AccountClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isAuthenticated, logout, isLoading } = useAuth();
  const siteName = useSiteName();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Read tab from URL query param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [customer, setCustomer] = useState<WooCustomer | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [billingForm, setBillingForm] = useState<WooAddress>({});
  const [shippingForm, setShippingForm] = useState<WooAddress>({});
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);


  const fetchOrders = useCallback(async () => {
    if (!session?.customerId) {
      console.warn('[AccountClient] No customerId in session');
      return;
    }
    console.log('[AccountClient] Fetching orders for customer:', session.customerId);
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await proxyRequest(
        `/orders`,
        {
          customer: session.customerId,
          per_page: 20,
          orderby: 'date',
          order: 'desc',
        },
        'GET'
      ) as any[];

      console.log('[AccountClient] Orders API response:', data);

      if (!Array.isArray(data)) {
        console.error('[AccountClient] Expected array, got:', typeof data);
        setOrdersError('Invalid response from server');
        return;
      }

      const mapped = data.map((order) => ({
        id: order.id,
        status: order.status,
        date_created: order.date_created,
        total: parseFloat(order.total),
        currency: order.currency || 'USD',
        items: order.line_items?.length || 0,
      })) as Order[];
      console.log('[AccountClient] Mapped', mapped.length, 'orders');
      setOrders(mapped);
    } catch (err: any) {
      console.error('[AccountClient] Error fetching orders:', err);
      setOrdersError(err?.message || 'Unable to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [session?.customerId]);

  const fetchCustomer = useCallback(async () => {
    if (!session?.customerId) return;
    setCustomerLoading(true);
    setCustomerError(null);
    try {
      const data = await proxyRequest(
        `/customers/${session.customerId}`,
        {},
        'GET'
      ) as WooCustomer;

      setCustomer(data);
      setBillingForm(data.billing || {});
      setShippingForm(data.shipping || {});
      setAccountForm({
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        email: data.email || '',
        password: '',
      });
    } catch (err: any) {
      setCustomerError(err?.message || 'Unable to load profile');
    } finally {
      setCustomerLoading(false);
    }
  }, [session?.customerId]);

  const saveAddresses = async () => {
    if (!customer?.id) return;
    setAddressSaving(true);
    setAddressMessage(null);
    try {
      await proxyRequest(
        `/customers/${customer.id}`,
        {
          billing: billingForm,
          shipping: shippingForm,
        },
        'PUT'
      );
      setAddressMessage('Addresses updated successfully.');
      await fetchCustomer();
    } catch (err: any) {
      setAddressMessage(err?.message || 'Unable to save addresses');
    } finally {
      setAddressSaving(false);
    }
  };

  const saveAccount = async () => {
    if (!customer?.id) return;
    setAccountSaving(true);
    setAccountMessage(null);
    try {
      const payload: Record<string, string> = {
        first_name: accountForm.firstName,
        last_name: accountForm.lastName,
        email: accountForm.email,
      };
      if (accountForm.password.trim()) {
        payload.password = accountForm.password.trim();
      }

      await proxyRequest(
        `/customers/${customer.id}`,
        payload,
        'PUT'
      );
      setAccountMessage('Account details updated successfully.');
      setAccountForm((prev) => ({ ...prev, password: '' }));
      await fetchCustomer();
    } catch (err: any) {
      setAccountMessage(err?.message || 'Unable to update account');
    } finally {
      setAccountSaving(false);
    }
  };

  useEffect(() => {
    if (session?.customerId && (activeTab === 'dashboard' || activeTab === 'orders')) {
      fetchOrders();
    }
  }, [activeTab, fetchOrders, session?.customerId]);

  useEffect(() => {
    if (session?.customerId && activeTab !== 'dashboard') {
      fetchCustomer();
    }
  }, [activeTab, fetchCustomer, session?.customerId]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const processing = orders.filter((o) => o.status === 'processing').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const spent = orders.reduce((sum, o) => sum + o.total, 0);
    return { totalOrders, processing, completed, spent };
  }, [orders]);

  const fullName =
    [session?.firstName, session?.lastName].filter(Boolean).join(' ') || session?.username || 'Guest';

  const navItems = [
    { value: 'dashboard', label: 'Dashboard', icon: <Squares2X2Icon className="h-5 w-5" /> },
    { value: 'orders', label: 'Orders', icon: <CubeIcon className="h-5 w-5" /> },
    { value: 'addresses', label: 'Addresses', icon: <MapPinIcon className="h-5 w-5" /> },
    { value: 'account', label: 'Account Details', icon: <UserIcon className="h-5 w-5" /> },
    { value: 'payment', label: 'Payment Methods', icon: <CreditCardIcon className="h-5 w-5" /> },
  ];

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-lg">Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="text-left mb-8 lg:mb-10 space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Hello{fullName ? `, ${fullName}` : ''}!</h1>
          <p className="text-sm lg:text-base text-muted-foreground">Manage your account and orders</p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            router.push(`/account?tab=${val}`, { scroll: false });
          }}
          className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start"
        >
          {/* Column 1 - Navigation */}
          <TabsList className="flex flex-col h-fit bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-5 gap-1 w-full lg:w-[280px] lg:flex-shrink-0">
            {navItems.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="w-full justify-start text-left gap-3 px-4 py-3 rounded-lg font-medium text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white hover:bg-slate-100 transition"
              >
                {item.icon}
                <span>{item.label}</span>
              </TabsTrigger>
            ))}

            <Separator className="my-4" />

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-3 text-red-600 hover:bg-red-50 font-medium"
              onClick={logout}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Logout
            </Button>
          </TabsList>

          {/* Column 2 - Content Area */}
          <div className="flex-1 space-y-6 lg:space-y-8">
            <TabsContent value="dashboard" className="mt-0 space-y-5 lg:space-y-6">
              <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={<CubeIcon className="h-6 w-6" />} label="Total Orders" value={stats.totalOrders} />
                <StatCard icon={<ClockIcon className="h-6 w-6" />} label="Processing" value={stats.processing} />
                <StatCard icon={<CheckCircleIcon className="h-6 w-6" />} label="Completed" value={stats.completed} />
                <StatCard icon={<CurrencyDollarIcon className="h-6 w-6" />} label="Total Spent" value={formatBDT(stats.spent)} />
              </div>

              <Card className="border border-slate-200 shadow-sm rounded-xl lg:rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-left">Recent Orders</CardTitle>
                  <Button variant="link" className="text-slate-700" onClick={() => setActiveTab('orders')}>
                    View all &rarr;
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ordersLoading && <p className="text-sm text-muted-foreground">Loading orders...</p>}
                  {ordersError && <p className="text-sm text-rose-600">{ordersError}</p>}
                  {!ordersLoading && !ordersError && orders.length === 0 && (
                    <p className="text-sm text-muted-foreground">No orders found yet.</p>
                  )}
                  {orders.slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition cursor-pointer"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-900">#{order.id}</span>
                          <Badge className={`capitalize border ${statusStyles[order.status as keyof typeof statusStyles] || statusStyles.pending}`}>
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(order.date_created).toLocaleDateString(undefined, { dateStyle: 'medium' })} | {order.items} item{order.items > 1 ? 's' : ''}
                        </p>
                      </div>
                      <p className="font-semibold text-lg text-slate-900">
                        {order.currency} {order.total.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Placeholder content for other tabs */}
            <TabsContent value="orders" className="mt-0">
              <Card className="border border-slate-200 shadow-sm rounded-xl lg:rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-left">All Orders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ordersLoading && <p className="text-sm text-muted-foreground">Loading orders...</p>}
                  {ordersError && <p className="text-sm text-rose-600">{ordersError}</p>}
                  {!ordersLoading && !ordersError && orders.length === 0 && (
                    <p className="text-sm text-muted-foreground">No orders found yet.</p>
                  )}
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-col md:grid md:grid-cols-[1fr,auto] md:items-center gap-3"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">#{order.id}</span>
                          <Badge className={`text-xs capitalize border ${statusStyles[order.status as keyof typeof statusStyles] || statusStyles.pending}`}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Date:</span>
                            <span className="font-medium text-foreground">
                              {new Date(order.date_created).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </span>
                          </div>
                          <Separator orientation="vertical" className="h-4" />
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Items:</span>
                            <span className="font-medium text-foreground">{order.items} item{order.items > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold">
                            {order.currency} {order.total.toFixed(2)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/orders/${order.id}`)}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="addresses" className="mt-0">
              <Card className="border border-slate-200 shadow-sm rounded-xl lg:rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-left">Shipping & Billing Addresses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {customerLoading && <p className="text-sm text-muted-foreground">Loading addresses...</p>}
                  {customerError && <p className="text-sm text-rose-600">{customerError}</p>}
                  {!customerLoading && !customerError && (
                    <>
                      <div className="grid gap-6 md:grid-cols-2">
                        <AddressCard
                          title="Billing Address"
                          address={billingForm}
                          onChange={setBillingForm}
                        />
                        <AddressCard
                          title="Shipping Address"
                          address={shippingForm}
                          onChange={setShippingForm}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={saveAddresses} disabled={addressSaving}>
                          {addressSaving ? 'Saving...' : 'Save Addresses'}
                        </Button>
                        {addressMessage && (
                          <span className="text-sm text-slate-600">{addressMessage}</span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" className="mt-0">
              <Card className="border border-slate-200 shadow-sm rounded-xl lg:rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-left">Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customerLoading && <p className="text-sm text-muted-foreground">Loading account...</p>}
                  {customerError && <p className="text-sm text-rose-600">{customerError}</p>}
                  {!customerLoading && !customerError && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          label="First name"
                          value={accountForm.firstName}
                          onChange={(v) => setAccountForm((prev) => ({ ...prev, firstName: v }))}
                        />
                        <FormField
                          label="Last name"
                          value={accountForm.lastName}
                          onChange={(v) => setAccountForm((prev) => ({ ...prev, lastName: v }))}
                        />
                      </div>
                      <FormField
                        label="Email"
                        type="email"
                        value={accountForm.email}
                        onChange={(v) => setAccountForm((prev) => ({ ...prev, email: v }))}
                      />
                      <FormField
                        label="Change password"
                        type="password"
                        placeholder="Leave blank to keep current password"
                        value={accountForm.password}
                        onChange={(v) => setAccountForm((prev) => ({ ...prev, password: v }))}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={saveAccount} disabled={accountSaving}>
                          {accountSaving ? 'Saving...' : 'Save Details'}
                        </Button>
                        {accountMessage && (
                          <span className="text-sm text-slate-600">{accountMessage}</span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payment" className="mt-0">
              <Card className="border border-slate-200 shadow-sm rounded-xl lg:rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-left">Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Saved cards and payment options will show here. No payment methods found yet.
                  </p>
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                    Payment token endpoints differ per gateway. Connect Stripe/PayPal tokenization to display saved cards here.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card className="border border-slate-200 shadow-sm rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm">{label}</span>
          <div className="text-slate-500">{icon}</div>
        </div>
        <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}

function AddressCard({
  title,
  address,
  onChange,
}: {
  title: string;
  address: WooAddress;
  onChange: (addr: WooAddress) => void;
}) {
  const update = (key: keyof WooAddress, value: string) => {
    onChange({ ...address, [key]: value });
  };

  const isEmpty = Object.values(address || {}).every((v) => !v);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 text-left">
      <h3 className="font-semibold text-slate-900 text-left">{title}</h3>
      {isEmpty && <p className="text-sm text-muted-foreground text-left">No address added yet.</p>}
      <div className="grid gap-3">
        <FormField label="First name" value={address.first_name || ''} onChange={(v) => update('first_name', v)} />
        <FormField label="Last name" value={address.last_name || ''} onChange={(v) => update('last_name', v)} />
        <FormField label="Address line 1" value={address.address_1 || ''} onChange={(v) => update('address_1', v)} />
        <FormField label="Address line 2" value={address.address_2 || ''} onChange={(v) => update('address_2', v)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="City" value={address.city || ''} onChange={(v) => update('city', v)} />
          <FormField label="State" value={address.state || ''} onChange={(v) => update('state', v)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Postcode" value={address.postcode || ''} onChange={(v) => update('postcode', v)} />
          <FormField label="Country" value={address.country || ''} onChange={(v) => update('country', v)} />
        </div>
        <FormField label="Phone" value={address.phone || ''} onChange={(v) => update('phone', v)} />
        <FormField label="Email" value={address.email || ''} onChange={(v) => update('email', v)} />
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 block text-left">
      <Label className="text-sm text-slate-600 text-left block">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-left"
      />
    </label>
  );
}

export default AccountClient;
