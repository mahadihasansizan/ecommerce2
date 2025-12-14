'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import AuthModal from '@/components/auth/AuthModal';
import { useAuth } from '@/context/AuthContext';
import { useCartStore } from '@/store/cartStore';
import {
  calculateShippingRates,
  createOrder,
  getCountries,
  getCountryStates,
  getDefaultCountryStates,
  getStoreContext,
  type WooCountry,
  type WooShippingRate,
  type WooState,
  type WooStoreContext
} from '@/lib/woocommerce';
import { setCurrencyCode as setGlobalCurrencyCode, setCurrencySymbol as setGlobalCurrencySymbol } from '@/lib/utils';
import {
  ArrowLeft,
  Key,
  RefreshCw,
  Truck,
  User
} from 'lucide-react';

const FloatingField: React.FC<{
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
}> = ({ id, label, placeholder, value, onChange, onBlur, error, required }) => {
  const [focused, setFocused] = useState(false);
  const borderClass = error ? 'border-red-500' : value ? 'border-green-500' : 'border-gray-300';
  const shrink = focused || Boolean(value);

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        type="text"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        placeholder={placeholder ?? ''}
        aria-invalid={!!error}
        className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary/30 ${borderClass} bg-white transition`}
      />
      <label
        htmlFor={id}
        className={`absolute left-3 transition-all duration-150 ${shrink ? '-top-2 text-xs text-muted-foreground bg-white px-1' : 'top-2 text-sm text-gray-400'}`}
      >
        {label}
        {required && ' *'}
      </label>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

const SearchableSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { code: string; name: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}> = ({ value, onChange, options, placeholder, disabled, error }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.code === value),
    [options, value]
  );

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', listener);
    return () => document.removeEventListener('click', listener);
  }, []);

  const filtered = query ? options.filter((option) => option.name.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div className="relative" ref={ref}>
      <input
      value={open ? query : selectedOption?.name || query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-primary/30 ${error ? 'border-red-500' : 'border-gray-300'} bg-white`}
      />
      {open && !disabled && (
        <ul className="absolute z-40 left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border rounded shadow-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
          ) : (
            filtered.map((option) => (
              <li
                key={option.code}
                className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-sm"
                onClick={() => {
                  onChange(option.code);
                  setQuery(option.name);
                  setOpen(false);
                }}
              >
                {option.name}
              </li>
            ))
          )}
        </ul>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

const CheckoutPage = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const cartStore = useCartStore();
  const {
    items,
    getTotalPrice,
    clearCart,
    applyCoupon,
    removeCoupon,
    couponApplied,
    couponDiscount,
    couponLoading,
  } = cartStore;

  const [storeContext, setStoreContext] = useState<WooStoreContext | null>(null);
  const [currencyCode, setCurrencyCode] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [countries, setCountries] = useState<WooCountry[]>([]);
  const [states, setStates] = useState<WooState[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const selectedPaymentId = 'cod';
  const selectedPaymentTitle = 'Cash on delivery';
  const [shippingRates, setShippingRates] = useState<WooShippingRate[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    country: '',
    postcode: '',
    state: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createAccountChecked, setCreateAccountChecked] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [localCouponInput, setLocalCouponInput] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const authModalTab: 'login' | 'signup' = 'login';

  useEffect(() => {
    const loadStoreContext = async () => {
      setLoadingStates(true);
      try {
        const ctx = await getStoreContext();
        setStoreContext(ctx);
        setCurrencyCode(ctx?.currency || '');
        const symbol = ctx?.currency_symbol || ctx?.currency || '';
        setCurrencySymbol(symbol.endsWith(' ') ? symbol : `${symbol} `);
        setGlobalCurrencyCode(ctx?.currency || '');
        setGlobalCurrencySymbol(symbol.endsWith(' ') ? symbol : `${symbol} `);
        const allCountries = await getCountries();
        setCountries(allCountries);
        setFormData((prev) => ({
          ...prev,
          country: ctx?.default_country || allCountries[0]?.code || '',
        }));
        const defaultStates = await getDefaultCountryStates();
        setStates(defaultStates);
      } finally {
        setLoadingStates(false);
      }
    };
    loadStoreContext();
  }, []);

  useEffect(() => {
    const loadStates = async () => {
      setLoadingStates(true);
      const countryCode = formData.country || storeContext?.default_country || 'BD';
      const result = await getCountryStates(countryCode);
      setStates(result);
      if (!result.find((s) => s.code === formData.state)) {
        setFormData((prev) => ({ ...prev, state: '' }));
      }
      setLoadingStates(false);
    };
    if (formData.country) {
      loadStates();
    }
  }, [formData.country, formData.state, storeContext]);

  const refreshShippingRates = useCallback(async () => {
    if (!items.length) return;
    setShippingLoading(true);
    const country = formData.country || storeContext?.default_country || 'BD';
    const payload = {
      shipping: {
        country,
        state: formData.state,
        city: '',
        postcode: formData.postcode,
        address_1: formData.address,
        address_2: '',
      },
      billing: {
        country,
        state: formData.state,
      },
      line_items: items.map((item: any) => ({
        product_id: Number(item.productId),
        variation_id: item.variationId ? Number(item.variationId) : undefined,
        quantity: Number(item.quantity),
      })),
    };

    try {
      const result = await calculateShippingRates(payload);
      const rates = result?.rates || [];
      setShippingRates(rates);
      if (rates.length > 0) {
        const preferred = rates.find((rate) => rate.id === result?.selected_rate_id) || rates[0];
        setSelectedShippingId(preferred.id);
      }
    } catch (error) {
      console.error('shipping rates', error);
      toast.error('Unable to calculate shipping');
    } finally {
      setShippingLoading(false);
    }
  }, [items, formData.country, formData.state, formData.postcode, formData.address, storeContext]);

  useEffect(() => {
    refreshShippingRates();
  }, [refreshShippingRates]);

  useEffect(() => {
    cartStore.closeCart();
  }, [cartStore]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      if (prev[field] === value) return prev;
      return { ...prev, [field]: value };
    });
    setErrors((prev) => {
      const next = { ...prev };
      if (!value.trim()) {
        if (['name', 'phone', 'address', 'country', 'state'].includes(field)) {
          next[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        }
      } else {
        delete next[field];
      }
      if (field === 'phone' && value && !/^\d{11}$/.test(value)) {
        next.phone = 'Phone must be exactly 11 digits';
      }
      return next;
    });
  };

  const subtotal = getTotalPrice();
  const shippingCost = Number(shippingRates.find((rate) => rate.id === selectedShippingId)?.total || 0);
  const grandTotal = Math.max(0, subtotal - (couponApplied ? couponDiscount : 0)) + shippingCost;

  const formatPrice = (value: number) => `${currencySymbol || currencyCode || ''}${value.toFixed(2)}`;

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setIsProcessing(true);
    const nameParts = formData.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const orderData = {
      billing: {
        first_name: firstName,
        last_name: lastName,
        email: formData.email || '',
        phone: formData.phone,
        address_1: formData.address,
        state: formData.state,
        country: formData.country,
        postcode: formData.postcode,
      },
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address_1: formData.address,
        state: formData.state,
        country: formData.country,
        postcode: formData.postcode,
        phone: formData.phone,
      },
      line_items: items.map((item: any) => ({
        product_id: Number(item.productId),
        quantity: Number(item.quantity),
        variation_id: item.variationId ? Number(item.variationId) : undefined,
      })),
      shipping_lines: selectedShippingId
        ? [
            {
              method_id: shippingRates.find((rate) => rate.id === selectedShippingId)?.method_id,
              method_title: shippingRates.find((rate) => rate.id === selectedShippingId)?.label,
              total: shippingCost.toFixed(2),
              instance_id: shippingRates.find((rate) => rate.id === selectedShippingId)?.instance_id,
            },
          ]
        : [],
      payment_method: selectedPaymentId,
      payment_method_title: selectedPaymentTitle,
      currency: currencyCode || undefined,
      set_paid: false,
    };

    try {
      const order = await createOrder(orderData);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('kitchenhero-latest-order', JSON.stringify(order));
        } catch (storageError) {
          console.warn('Failed to cache order data for confirmation page:', storageError);
        }
      }
      clearCart();
      setIsProcessing(false);
      router.push('/order-confirmation');
    } catch (error) {
      console.error(error);
      toast.error('Failed to place the order.');
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted">
        <p className="text-muted-foreground">Processing your order...</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Checkout</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          { !isAuthenticated && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Login or create an account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setAuthModalOpen(true)} variant="outline">Login</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Billing information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FloatingField id="name" label="Name" value={formData.name} onChange={(value) => updateField('name', value)} required error={touched.name ? errors.name : undefined} onBlur={() => setTouched((prev) => ({ ...prev, name: true }))} />
              <FloatingField id="phone" label="Phone" value={formData.phone} onChange={(value) => updateField('phone', value)} required error={touched.phone ? errors.phone : undefined} onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))} />
              <FloatingField id="email" label="Email" value={formData.email} onChange={(value) => updateField('email', value)} onBlur={() => setTouched((prev) => ({ ...prev, email: true }))} error={touched.email ? errors.email : undefined} />

              <div>
                <Label>Country *</Label>
                <select
                  value={formData.country}
                  onChange={(event) => updateField('country', event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/70"
                >
                  <option value="" disabled>
                    {countries.length ? 'Select country' : 'Loading countries...'}
                  </option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {touched.country && errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
              </div>
              <div>
                <Label>State / Division *</Label>
                <SearchableSelect
                  value={formData.state}
                  onChange={(value) => updateField('state', value)}
                  options={states.map((state) => ({ code: state.code, name: state.name }))}
                  placeholder={loadingStates ? 'Loading states...' : 'Select state'}
                  disabled={loadingStates}
                  error={touched.state ? errors.state : undefined}
                />
              </div>
              <FloatingField id="address" label="Address" value={formData.address} onChange={(value) => updateField('address', value)} required error={touched.address ? errors.address : undefined} onBlur={() => setTouched((prev) => ({ ...prev, address: true }))} />
              <FloatingField id="postcode" label="Postal / ZIP" value={formData.postcode} onChange={(value) => updateField('postcode', value)} />

              {!isAuthenticated && (
                <div className="flex items-center gap-2">
                  <Checkbox checked={createAccountChecked} onCheckedChange={(value) => { setCreateAccountChecked(value === true); if (!value) setAccountPassword(''); }} id="createAccount" />
                  <label htmlFor="createAccount" className="text-sm">Create an account</label>
                </div>
              )}

              {!isAuthenticated && createAccountChecked && (
                <div className="space-y-2">
                  <Label htmlFor="accountPassword">Password (optional)</Label>
                  <div className="flex gap-2">
                    <Input id="accountPassword" type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="Leave empty to auto-generate" className="flex-1" />
                    <Button variant="outline" size="icon" onClick={() => {
                      const randomPassword = `KH${Math.random().toString(36).slice(-10)}${Date.now().toString(36)}`;
                      setAccountPassword(randomPassword);
                      toast.success('Random password generated');
                    }}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Order summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {items.map((item: any) => (
                <div key={item.productId} className="flex items-center justify-between gap-3">
                  <div className="flex-1">{item.name}</div>
                  <div>{formatPrice(item.price * item.quantity)}</div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{shippingLoading ? 'Calculating...' : shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between text-red-600">
                  <span>Coupon</span>
                  <span>-{formatPrice(couponDiscount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>

              <div className="flex gap-2">
                <input
                  value={localCouponInput}
                  onChange={(event) => setLocalCouponInput(event.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 px-3 py-2 border rounded"
                />
                {!couponApplied ? (
                  <Button disabled={!localCouponInput.trim() || couponLoading} onClick={() => applyCoupon(localCouponInput)}>
                    Apply
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={removeCoupon}>Remove</Button>
                )}
              </div>

              <Button className="w-full" onClick={handleSubmit}>Place Order</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authModalTab} />
    </div>
  );
};

export default CheckoutPage;
