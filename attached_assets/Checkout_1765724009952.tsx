import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Added useLocation for OrderConfirmation
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Single import for both components
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Truck, User, Download, Home, Package, CheckCircle, Key, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import AuthModal from '@/components/auth/AuthModal';
import { calculateShippingRates, createOrder, getDefaultCountryStates, type WooShippingRate, type WooState, getPaymentGateways, validateOrderData, getStoreContext, type WooStoreContext, getCountries, getCountryStates, type WooCountry } from '@/lib/woocommerce';
import { setCurrencyCode as setGlobalCurrencyCode, setCurrencySymbol as setGlobalCurrencySymbol } from '@/lib/utils';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { WP_BASE_URL } from '@/lib/config';
import { getSupportEmail } from '@/lib/tenant-config';
import { useSiteName } from '@/hooks/useSiteInfo';

// GTM helpers
const ensureDataLayer = () => {
  if (typeof window === "undefined") return null as any[] | null;
  (window as any).dataLayer = (window as any).dataLayer || [];
  return (window as any).dataLayer as any[];
};

const pushDL = (event: string, payload: any) => {
  const dl = ensureDataLayer();
  if (!dl) return;
  dl.push({ event, ...payload });
  // GA4 events are pushed to dataLayer (no console logging)
};

const FloatingField: React.FC<{
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
}> = ({ id, label, placeholder, value, onChange, onBlur, type = 'text', error, required, maxLength }) => {
  const [focused, setFocused] = useState(false);
  const shouldShrink = focused || !!value;
  const borderClass = error ? 'border-red-500' : value ? 'border-green-500' : 'border-gray-300';

  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (onBlur) onBlur();
        }}
        className={[
          'w-full px-2 pt-2 pb-2 bg-white border rounded transition-colors outline-none text-sm',
          borderClass,
          'focus:ring-2 focus:ring-primary/20'
        ].join(' ')}
        placeholder={placeholder ?? ''}
        aria-invalid={!!error}
        maxLength={maxLength}
      />
      <label
        htmlFor={id}
        className={[
          'absolute left-2 transition-all duration-150 text-sm pointer-events-none bg-white px-1',
          shouldShrink ? '-top-2 text-xs text-muted-foreground' : 'top-2 text-gray-400'
        ].join(' ')}
      >
        {label}{required ? ' *' : ''}
      </label>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

// Updated SearchableSelect with error styling
const SearchableSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { code: string; name: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: string; // New prop for error
}> = ({ value, onChange, options, placeholder, disabled, error }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const sel = options.find((o) => o.code === value);
    setQuery(sel ? sel.name : '');
  }, [value, options]);

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Determine border class based on error and value
  const borderClass = error ? 'border-red-500' : value ? 'border-green-500' : 'border-gray-300';

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={[
          'w-full px-2 py-2 border rounded text-sm outline-none focus:ring-2 focus:ring-primary/20',
          borderClass
        ].join(' ')}
      />
      {open && !disabled && (
        <ul className="absolute z-40 left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border rounded shadow-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.code}
                className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-sm"
                onClick={() => {
                  onChange(opt.code);
                  setQuery(opt.name);
                  setOpen(false);
                }}
              >
                {opt.name}
              </li>
            ))
          )}
        </ul>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

const Checkout = () => {
  const navigate = useNavigate();
  const { isAuthenticated, signup } = useAuth();
  const siteName = useSiteName();
  const {
    items,
    getTotalPrice,
    clearCart,
    applyCoupon,
    removeCoupon,
    couponCode,
    couponApplied,
    couponDiscount,
    couponLoading,
    couponError,
    getTotalItems,
    closeCart,
    initiateCheckoutTracked,
    setInitiateCheckoutTracked,
  } = useCartStore();

  const store = useCartStore() as any;

  const [storeContext, setStoreContext] = useState<WooStoreContext | null>(null);
  const [currencyCode, setCurrencyCode] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [countries, setCountries] = useState<WooCountry[]>([]);
  const [states, setStates] = useState<WooState[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('cod');
  const [selectedPaymentTitle, setSelectedPaymentTitle] = useState<string>('Cash on delivery');
  const [shippingRates, setShippingRates] = useState<WooShippingRate[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [gtmCurrency, setGtmCurrency] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    country: '',
    postcode: '',
    state: '',
  });
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [localCouponInput, setLocalCouponInput] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');

  // New state for abandoned cart tracking
  const [abandonedSent, setAbandonedSent] = useState(false);
  const lastSentData = useRef<string>('');
  
  // Create account checkbox (only show when not authenticated)
  const [createAccountChecked, setCreateAccountChecked] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');

  useEffect(() => {
    const fetchStoreData = async () => {
      setLoadingStates(true);
      try {
        const ctx = await getStoreContext();
        setStoreContext(ctx);
        setCurrencyCode(ctx?.currency || '');
        const symbol = ctx?.currency_symbol || ctx?.currency || '';
        setCurrencySymbol(symbol.endsWith(' ') ? symbol : `${symbol} `);
        setGtmCurrency(ctx?.currency || '');
        setGlobalCurrencyCode(ctx?.currency || '');
        setGlobalCurrencySymbol(symbol.endsWith(' ') ? symbol : `${symbol} `);

        const allCountries = await getCountries();
        setCountries(allCountries);

        setFormData(prev => ({
          ...prev,
          country: ctx?.default_country || allCountries[0]?.code || '',
        }));

        const defaultStates = await getDefaultCountryStates();
        setStates(defaultStates);
      } catch (error) {
        console.error('Failed to fetch store context/states:', error);
      } finally {
        setLoadingStates(false);
      }
    };
    fetchStoreData();
  }, []);

  useEffect(() => {
    // Close cart when checkout page loads
    closeCart();
  }, [closeCart]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const methods = await getPaymentGateways();
        const enabled = methods.filter((m: any) => m.enabled);
        setPaymentMethods(enabled);
        if (enabled.length > 0) {
          setSelectedPaymentId(enabled[0].id || 'cod');
          setSelectedPaymentTitle(enabled[0].title || enabled[0].id || 'Cash on delivery');
        }
      } catch (err) {
        console.error('Failed to load payment methods', err);
      }
    };
    fetchPayments();
  }, []);

  // When country changes, refresh states list
  useEffect(() => {
    const loadStates = async () => {
      setLoadingStates(true);
      try {
        if (formData.country) {
          const countryStates = await getCountryStates(formData.country);
          setStates(countryStates);
          // reset state if not in new list
          if (!countryStates.find(s => s.code === formData.state)) {
            setFormData(prev => ({ ...prev, state: '' }));
          }
        } else {
          setStates([]);
          setFormData(prev => ({ ...prev, state: '' }));
        }
      } catch (err) {
        console.error('Failed to load states for country', err);
      } finally {
        setLoadingStates(false);
      }
    };
    loadStates();
  }, [formData.country]);

  const refreshShippingRates = useCallback(async () => {
    if (!items.length) {
      setShippingRates([]);
      setSelectedShippingId(null);
      return;
    }

    setShippingLoading(true);
    try {
      const countryCode = formData.country || storeContext?.default_country || 'BD';
      const payload = {
        shipping: {
          country: countryCode,
          state: formData.state,
          city: '',
          postcode: formData.postcode,
          address_1: formData.address,
          address_2: ''
        },
        billing: {
          country: countryCode,
          state: formData.state
        },
        line_items: items.map((item: any) => ({
          product_id: Number(item.productId),
          variation_id: item.variationId ? Number(item.variationId) : undefined,
          quantity: Number(item.quantity)
        }))
      };

      const result = await calculateShippingRates(payload);
      const rates = result?.rates || [];
      setShippingRates(rates);
      if (rates.length > 0) {
        const preferred = (result?.selected_rate_id && rates.find(r => r.id === result.selected_rate_id)) || rates[0];
        setSelectedShippingId(preferred.id);
      } else {
        setSelectedShippingId(null);
      }
    } catch (error) {
      console.error('Failed to calculate shipping', error);
      toast.error('Unable to load shipping options from store');
      setShippingRates([]);
      setSelectedShippingId(null);
    } finally {
      setShippingLoading(false);
    }
  }, [items, formData.state, formData.address, formData.country, formData.postcode, storeContext]);

  useEffect(() => {
    refreshShippingRates();
  }, [refreshShippingRates]);

  // Clear initiate checkout tracking when leaving checkout page
  useEffect(() => {
    return () => {
      setInitiateCheckoutTracked(false);
    };
  }, [setInitiateCheckoutTracked]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const next = { ...prev };
      if (field === 'name') {
        if (!value.trim()) next.name = 'Name is required';
        else delete next.name;
      }
      if (field === 'phone') {
        if (!value.trim()) next.phone = 'Phone is required';
        else if (!/^\d{11}$/.test(value.trim())) next.phone = 'Phone must be exactly 11 digits';
        else delete next.phone;
      }
      if (field === 'email') {
        if (createAccountChecked && !value.trim()) {
          next.email = 'Email is required to create an account';
        } else if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          next.email = 'Please enter a valid email address';
        } else {
          delete next.email;
        }
      }
    if (field === 'address') {
      if (!value.trim()) next.address = 'Address is required';
      else delete next.address;
    }
      if (field === 'country') {
        if (!value) next.country = 'Country is required';
        else delete next.country;
      }
      if (field === 'postcode') {
        if (value && value.length < 3) next.postcode = 'Postcode looks too short';
        else delete next.postcode;
      }
    if (field === 'state') {
      if (!value) next.state = 'State is required';
      else delete next.state;
    }
    return next;
    });
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const changeQty = async (item: any, delta: number) => {
    const current = item.quantity || 1;
    const newQty = Math.max(1, current + delta);
    try {
      if (typeof store.updateQuantity === 'function') {
        await store.updateQuantity(item.id ?? item.productId, newQty);
      } else if (typeof store.updateItemQuantity === 'function') {
        await store.updateItemQuantity(item.id ?? item.productId, newQty);
      } else if (typeof store.setQuantity === 'function') {
        await store.setQuantity(item.id ?? item.productId, newQty);
      } else if (typeof store.setItemQuantity === 'function') {
        await store.setItemQuantity(item.id ?? item.productId, newQty);
      } else {
        console.warn('Cart store: no known update-quantity method found.');
      }
    } catch (err) {
      console.error('Failed to change quantity', err);
    }
  };

  const handleApplyCoupon = async () => {
    if (!localCouponInput?.trim()) return;
    try {
      await applyCoupon(localCouponInput.trim());
      setLocalCouponInput('');

      // GTM: Track coupon applied
      pushDL("apply_coupon", {
        event_category: "ecommerce",
        event_label: "coupon_applied",
        coupon_code: localCouponInput.trim(),
        value: couponDiscount,
        currency: gtmCurrency,
      });
    } catch (err) {
      console.error('Apply coupon failed', err);
      toast.error('Failed to apply coupon');
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      await removeCoupon();
    } catch (err) {
      console.error('Remove coupon failed', err);
      toast.error('Failed to remove coupon');
    }
  };
  const formatPrice = (price: number) => {
    if (isNaN(price) || price === null || price === undefined) {
      return `${currencySymbol || currencyCode || ''}0.00`;
    }
    return `${currencySymbol || currencyCode || ''}${price.toFixed(2)}`;
  };

  const selectedShipping = shippingRates.find(r => r.id === selectedShippingId) || shippingRates[0];
  const shippingCost = selectedShipping ? Number(selectedShipping.total || 0) : 0;
  const shippingLabel = shippingLoading ? 'Calculating...' : (shippingCost === 0 ? 'Free Shipping' : formatPrice(shippingCost));

  const handleSubmit = async (e: React.FormEvent | null = null) => {
    if (e) e.preventDefault();

    // Validate email if create account is checked
    if (createAccountChecked && !isAuthenticated) {
      const email = formData.email.trim();
      if (!email) {
        toast.error('Email is required to create an account');
        setTouched(prev => ({ ...prev, email: true }));
        setErrors(prev => ({ ...prev, email: 'Email is required to create an account' }));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error('Please enter a valid email address');
        setTouched(prev => ({ ...prev, email: true }));
        setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
        return;
      }
    }

    // GTM: Track initiate checkout with user input data
    pushDL("initiate_checkout", {
      event_category: "ecommerce",
      event_label: "checkout_submit",
      value: grandTotal,
      currency: gtmCurrency,
      items_count: items.length,
      // Include user input data for tracking
      customer_name: formData.name,
      customer_phone: formData.phone,
      customer_email: formData.email || '',
      customer_address: formData.address,
      customer_state: formData.state,
      items: items.map((item: any) => ({
        item_id: item.productId.toString(),
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
        item_category: item.category || 'product',
      })),
    });

    const newErrors: any = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^\d{11}$/.test(formData.phone.trim())) newErrors.phone = 'Phone must be exactly 11 digits';
    if (createAccountChecked && !isAuthenticated) {
      if (!formData.email.trim()) newErrors.email = 'Email is required to create an account';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.country) newErrors.country = 'Country is required';
    if (!formData.state) newErrors.state = 'State is required';
    setErrors(newErrors);

    // Set touched for all fields to show errors immediately on submit
    setTouched({
      name: true,
      phone: true,
      email: true,
      address: true,
      country: true,
      postcode: true,
      state: true,
    });

    if (Object.keys(newErrors).length > 0) {
      const errorMessages = Object.values(newErrors);
      toast.error(`Please fix the following errors:\n${errorMessages.join('\n')}`);
      return;
    }

    // Validate cart items before proceeding
    const invalidItems = items.filter(item =>
      !item.productId ||
      item.productId <= 0 ||
      isNaN(item.productId) ||
      item.quantity <= 0 ||
      isNaN(item.quantity)
    );

    if (invalidItems.length > 0) {
      console.error('Invalid cart items found:', invalidItems);
      toast.error('Some items in your cart are invalid. Please remove them and try again.');
      return;
    }

    if (shippingLoading && !selectedShipping) {
      toast.error('Calculating shipping, please try again in a moment.');
      return;
    }

    setIsProcessing(true);

    // Generate email from support email domain for auto-generated emails
    const supportEmail = getSupportEmail();
    const emailDomain = supportEmail.split('@')[1] || 'kitchenhero.xyz';
    const email = formData.email?.trim() ? formData.email.trim() : `${formData.phone}+${items.length}@${emailDomain}`;

    const selectedState = states.find(s => s.code === formData.state) || states.find(s => s.name === formData.state);
    const stateCode = selectedState ? selectedState.code : formData.state;
    const stateName = selectedState ? selectedState.name : formData.state;
    const countryCode = formData.country || storeContext?.default_country || 'BD';

    const shippingLine = selectedShipping
      ? {
          method_id: selectedShipping.method_id,
          method_title: selectedShipping.label || 'Shipping',
          total: Number(selectedShipping.total || 0).toFixed(2),
          instance_id: selectedShipping.instance_id,
        }
      : undefined;

    // Build line items with enhanced validation
    const lineItems = items.map((item: any) => {
      const lineItem: any = {
        product_id: parseInt(item.productId.toString()),
        quantity: parseInt(item.quantity.toString()),
      };

      // Add variation_id only if it's valid
      if (item.variationId && item.variationId > 0 && !isNaN(item.variationId)) {
        lineItem.variation_id = parseInt(item.variationId.toString());
      }

      // Add meta_data for attributes if they exist
      if (item.attributes && Object.keys(item.attributes).length > 0) {
        lineItem.meta_data = Object.entries(item.attributes).map(([k, v]) => ({
          key: (k as string).startsWith('pa_') ? (k as string) : `pa_${k as string}`,
          value: v,
        }));
      }

      return lineItem;
    });

    // Split name into first and last name (simple approach: first word = first name, rest = last name)
    const nameParts = formData.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const orderData: any = {
      payment_method: selectedPaymentId || paymentMethods[0]?.id || 'cod',
      payment_method_title: selectedPaymentTitle || paymentMethods[0]?.title || 'Cash on delivery',
      set_paid: false,
      currency: currencyCode || undefined,
      billing: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: formData.phone,
        address_1: formData.address,
        address_2: '',
        city: '',
        state: stateCode,
        country: countryCode,
        postcode: formData.postcode,
      },
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address_1: formData.address,
        address_2: '',
        city: '',
        state: stateCode,
        country: countryCode,
        postcode: formData.postcode,
        phone: formData.phone,
      },
      meta_data: [
        { key: '_kh_state_label', value: stateName },
        { key: '_kh_shipping_rate', value: selectedShipping?.id || 'none' },
        { key: '_kh_shipping_label', value: selectedShipping?.label || 'Shipping' },
      ],
      line_items: lineItems,
      shipping_lines: shippingLine ? [shippingLine] : [],
      ...(couponApplied && couponCode ? { coupon_lines: [{ code: couponCode }] } : {}),
    };

    try {

      // Validate order data before sending
      const validation = validateOrderData(orderData);
      if (!validation.isValid) {
        console.error('Order validation failed:', validation.errors);
        toast.error(`Order validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Create account if checkbox is checked and user is not authenticated
      if (createAccountChecked && !isAuthenticated && formData.email && formData.name) {
        try {
          const nameParts = formData.name.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Generate username from email (before @) or use a default
          const emailUsername = formData.email.split('@')[0] || 'user';
          const username = emailUsername.replace(/[^a-zA-Z0-9]/g, '') || `user${Date.now()}`;
          
          // Use provided password or generate a random password
          const password = accountPassword.trim() || `KH${Math.random().toString(36).slice(-10)}${Date.now().toString(36)}`;
          
          await signup({
            email: formData.email,
            username: username,
            password: password,
            firstName: firstName,
            lastName: lastName,
          });
          
          // Note: User is now logged in automatically after signup
          toast.success('Account created successfully! Check your email for password reset instructions.');
        } catch (signupError: any) {
          // Don't block order creation if account creation fails
          console.error('Account creation failed:', signupError);
          toast.error('Order placed, but account creation failed. You can create an account later.');
        }
      }

      const order = await createOrder(orderData);

      // Mark as abandoned sent to prevent saving
      setAbandonedSent(true);

      // Delete abandoned cart after successful order (use phone as identifier)
      if (formData.phone) {
        await fetch(`/wp-json/kitchenhero/v1/abandoned-cart/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formData.phone,
          }),
        });
      }

      clearCart();
      setIsProcessing(false); // Set processing to false before navigating
      navigate('/order-confirmation', { state: { order } });
    } catch (err: any) {
      console.error('Order creation failed:', err);
      const errorMessage = err?.message || err?.response?.data?.message || 'Failed to place order. Please try again.';
      toast.error(errorMessage);
    } finally {
      // No need to set isProcessing here since we handle it above
    }
  };

  // totals for the summary UI (client-side preview)
  const subtotal = getTotalPrice();
  const totalAfterDiscount = Math.max(0, subtotal - (couponApplied ? couponDiscount : 0));
  const grandTotal = totalAfterDiscount + shippingCost;

  // Debounced function to send abandoned cart data
  const sendAbandonedCart = useCallback(
    debounce(async (data: any) => {
      if (abandonedSent) return; // Don't send if already sent for this session
      try {
        const response = await fetch(`/wp-json/kitchenhero/v1/abandoned-cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          setAbandonedSent(true);
        }
      } catch (error) {
        console.warn('Failed to send abandoned cart data:', error);
      }
    }, 5000), // Send after 5 seconds of inactivity
    [abandonedSent]
  );

  // Effect to send data on form changes
  useEffect(() => {
    const nameParts = formData.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const data = {
      name: formData.name,
      firstName,
      lastName,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      state: formData.state,
      cartItems: items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        productId: item.productId, // Keep for reference
      })),
      timestamp: new Date().toISOString(),
    };
    const dataString = JSON.stringify(data);
    // Only send if phone is filled (required for capture)
    if (dataString !== lastSentData.current && formData.phone) {
      sendAbandonedCart(data);
      lastSentData.current = dataString;
    }
  }, [formData, items, sendAbandonedCart]);

  // Send on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only send if phone is filled
      if (!abandonedSent && formData.phone) {
        const nameParts = formData.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const data = {
          name: formData.name,
          firstName,
          lastName,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          state: formData.state,
          cartItems: items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            productId: item.productId, // Keep for reference
          })),
          timestamp: new Date().toISOString(),
        };
        navigator.sendBeacon(`/wp-json/kitchenhero/v1/abandoned-cart`, JSON.stringify(data));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData, items, abandonedSent]);

  const handlePaymentStep = () => {
    // Handle payment step logic
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="text-center space-y-6">
          {/* Logo */}
          <div className="relative">
            <img
              src={`${WP_BASE_URL}/wp-content/uploads/2025/08/Kitchenhero-logo.png`}
              alt={`${siteName} Logo`}
              className="w-32 h-auto mx-auto animate-pulse"
              loading="lazy"
            />
            {/* Rotating ring around logo */}
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-spin border-t-primary"></div>
          </div>

          {/* Animated text */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-800 flex justify-center gap-1">
              {"Processing your order...".split("").map((char, i) => (
                <span
                  key={i}
                  className="inline-block animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s`, animationDuration: '1.5s' }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </h1>
            <p className="text-gray-600 animate-pulse">Please wait while we secure your order</p>
          </div>

          {/* Loading dots */}
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>

          {/* Progress bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>

        <style>
          {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          `}
        </style>
      </div>
    );
  }

  if (items.length === 0 && !isProcessing) {
    return (
  <div className="container mx-auto px-4 py-8 text-left">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Button onClick={() => navigate('/products')}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  return (
    <>
  <div className="container mx-auto px-4 py-6 pb-24 text-left">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="p-2 h-9 w-9 flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold m-0">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="order-2 lg:order-1">
            {/* Login Section - Only show if not authenticated */}
            {!isAuthenticated && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">
                        Have an account already?
                      </p>
                      <p className="text-sm font-medium">
                        Please login to continue with your saved information
                      </p>
                    </div>
                    <Button
                      onClick={() => setAuthModalOpen(true)}
                      variant="outline"
                      className="whitespace-nowrap"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Login
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {/* Name */}
                  <FloatingField
                    id="name"
                    label="Name"
                    value={formData.name}
                    onChange={(v) => handleInputChange('name', v)}
                    onBlur={() => handleBlur('name')}
                    error={touched.name && errors.name ? errors.name : undefined}
                    required
                  />

                  {/* Email */}
                  <FloatingField
                    id="email"
                    label={createAccountChecked ? "Email *" : "Email (optional)"}
                    type="email"
                    value={formData.email}
                    onChange={(v) => handleInputChange('email', v)}
                    onBlur={() => handleBlur('email')}
                    error={touched.email && errors.email ? errors.email : undefined}
                    required={createAccountChecked}
                  />

                  {/* Phone */}
                  <FloatingField
                    id="phone"
                    label="Phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(v) => {
                      // Remove non-digits and limit to 11 digits
                      let processedValue = v.replace(/\D/g, ''); // Remove non-digits
                      processedValue = processedValue.slice(0, 11); // Limit to 11 digits
                      handleInputChange('phone', processedValue);
                    }}
                    onBlur={() => handleBlur('phone')}
                    error={touched.phone && errors.phone ? errors.phone : undefined}
                    required
                    maxLength={11}
                  />

                  {/* Country */}
                  <div className="mt-4">
                    <Label>Country *</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(v) => handleInputChange('country', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={countries.length ? 'Select country' : 'Loading countries...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {touched.country && errors.country && (
                      <p className="text-red-500 text-xs mt-1">{errors.country}</p>
                    )}
                  </div>

                  {/* State / Division */}
                  <div className="mt-4">
                    <Label>State / Division *</Label>
                    <SearchableSelect
                      value={formData.state}
                      onChange={(v) => { handleInputChange('state', v); }}
                      options={states.map(s => ({ code: s.code, name: s.name }))}
                      placeholder={loadingStates ? 'Loading states...' : 'Select state'}
                      disabled={loadingStates}
                      error={touched.state && errors.state ? errors.state : undefined}
                    />
                  </div>

                  {/* Address */}
                  <FloatingField
                    id="address"
                    label="Full Address"
                    value={formData.address}
                    onChange={(v) => handleInputChange('address', v)}
                    onBlur={() => handleBlur('address')}
                    error={touched.address && errors.address ? errors.address : undefined}
                    required
                  />

                  {/* Postalcode */}
                  <FloatingField
                    id="postcode"
                    label="Postal / ZIP"
                    value={formData.postcode}
                    onChange={(v) => handleInputChange('postcode', v)}
                    onBlur={() => handleBlur('postcode')}
                    error={touched.postcode && errors.postcode ? errors.postcode : undefined}
                  />

                  {/* Password Field - Only show when create account is checked */}
                  {!isAuthenticated && createAccountChecked && (
                    <div className="space-y-2">
                      <Label htmlFor="accountPassword" className="text-sm font-medium">
                        Password <span className="text-muted-foreground font-normal">(optional - leave empty to auto-generate)</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="accountPassword"
                          type="password"
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          placeholder="Leave empty to auto-generate"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const randomPassword = `KH${Math.random().toString(36).slice(-10)}${Date.now().toString(36)}`;
                            setAccountPassword(randomPassword);
                            toast.success('Random password generated!');
                          }}
                          className="shrink-0"
                          title="Generate random password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to auto-generate a secure password, or create your own.
                      </p>
                    </div>
                  )}

                  {/* Create Account Checkbox - At the bottom */}
                  {!isAuthenticated && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="createAccount"
                        checked={createAccountChecked}
                        onCheckedChange={(checked) => {
                          setCreateAccountChecked(checked === true);
                          if (!checked) {
                            setAccountPassword('');
                          }
                        }}
                      />
                      <label
                        htmlFor="createAccount"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Create an account for faster checkout next time
                      </label>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Collapsible Order Summary (mobile only) */}
                <div className="mt-2 lg:hidden">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSummaryOpen(s => !s)}>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      Order Summary
                    </h3>
                    <div className="text-sm text-muted-foreground">{summaryOpen ? 'Hide' : 'Show'}</div>
                  </div>

                  {!summaryOpen ? (
                    <div className="mt-4 text-sm text-muted-foreground">
                      {items.length} items — {formatPrice(subtotal)} <br />
                      Shipping: {shippingLabel} <br />
                      Total: {formatPrice(grandTotal)}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="space-y-2">
                        {items.map((item: any) => (
                          <div key={item.id + '-' + (item.variationId || 'def')} className="flex items-start justify-between">
                            <div className="flex items-start gap-3 max-w-xs">
                              {item.image && typeof item.image === 'string' && item.image.trim() !== '' ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                                loading="lazy"
                              />
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="text-sm">
                                <div className="font-medium line-clamp-2">{item.name}</div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                                  <div className="inline-flex items-center border rounded">
                                    <button
                                      onClick={() => changeQty(item, -1)}
                                      className="px-2 text-sm"
                                      disabled={(item.quantity || 1) <= 1}
                                    >−</button>
                                    <div className="px-3 text-sm">{item.quantity}</div> 
                                    <button onClick={() => changeQty(item, +1)} className="px-2 text-sm">+</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {/* Coupon input (mobile expanded) */}
                      <div className="flex gap-2 items-center">
                        <input
                          className="flex-1 px-3 py-2 border border-gray-300 rounded outline-none"
                          placeholder="Coupon code"
                          value={localCouponInput}
                          onChange={(e) => setLocalCouponInput(e.target.value)}
                        />
                        {!couponApplied ? (
                          <Button size="sm" onClick={handleApplyCoupon} disabled={!localCouponInput.trim() || couponLoading}>
                            Apply
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={handleRemoveCoupon}>
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{formatPrice(subtotal)}</span>
                        </div>
                        {couponApplied && (
                          <div className="flex justify-between text-red-600">
                            <span>Discount</span>
                            <span>-{formatPrice(couponDiscount)}</span>
                          </div>
                        )}
                      <div className="flex justify-between items-center gap-2">
                        <span>Shipping</span>
                        {shippingRates.length > 1 ? (
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={selectedShippingId || shippingRates[0]?.id || ''}
                            onChange={(e) => setSelectedShippingId(e.target.value)}
                          >
                            {shippingRates.map(rate => (
                              <option key={rate.id} value={rate.id}>
                                {rate.label || rate.method_id} ({formatPrice(Number(rate.total || 0))})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{shippingLabel}</span>
                        )}
                      </div>
                        <Separator />
                        <div className="flex justify-between font-semibold text-base">
                          <span>Total</span>
                          <span>{formatPrice(grandTotal)}</span>
                        </div>

                        <div className="pt-2">
                          <div className="text-sm">Payment: {selectedPaymentTitle || 'Cash on delivery'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Place Order button (after summary) */}
                <div className="lg:hidden mt-6">
                  <Button onClick={handleSubmit} disabled={isProcessing} className="w-full">
                    {isProcessing ? 'Processing...' : 'Place Order'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary (desktop only) */}
          <div className="hidden lg:block order-1 lg:order-2 lg:sticky lg:top-24 self-start">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {items.map((item: any) => (
                    <div
                      key={`${item.id}-${item.variationId || 'default'}`}
                      className="flex items-center gap-4"
                    >
                      {item.image && typeof item.image === 'string' && item.image.trim() !== '' ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        loading="lazy"
                      />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{item.name}</h4>
                        {item.attributes && Object.keys(item.attributes).length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {Object.entries(item.attributes).map(([k, v], i) => (
                              <span key={i} className="mr-2">
                                {k.replace('pa_', '').replace('attribute_', '').toUpperCase()}: {v as any}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                          <div className="inline-flex items-center border rounded">
                            <button
                              onClick={() => changeQty(item, -1)}
                              className="px-3 text-sm"
                              disabled={(item.quantity || 1) <= 1}
                            >−</button>
                            <div className="px-3 text-sm">{item.quantity}</div>
                            <button onClick={() => changeQty(item, +1)} className="px-3 text-sm">+</button>
                          </div>
                        </div>
                      </div>
                      <p className="font-semibold text-sm">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Coupon input (desktop) */}
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 px-3 py-2 border border-gray-300 rounded outline-none"
                    placeholder="Coupon code"
                    value={localCouponInput}
                    onChange={(e) => setLocalCouponInput(e.target.value)}
                  />
                  {!couponApplied ? (
                    <Button size="sm" onClick={handleApplyCoupon} disabled={!localCouponInput.trim() || couponLoading}>
                      Apply
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={handleRemoveCoupon}>
                      Remove
                    </Button>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {couponApplied && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount</span>
                      <span>-{formatPrice(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-2">
                    <span>Shipping</span>
                    {shippingRates.length > 1 ? (
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={selectedShippingId || shippingRates[0]?.id || ''}
                        onChange={(e) => setSelectedShippingId(e.target.value)}
                      >
                        {shippingRates.map(rate => (
                          <option key={rate.id} value={rate.id}>
                            {rate.label || rate.method_id} ({formatPrice(Number(rate.total || 0))})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{shippingLabel}</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span>{formatPrice(grandTotal)}</span>
                  </div>

                  <div className="text-sm mt-2">Payment: {selectedPaymentTitle || 'Cash on delivery'}</div>

                  <Button onClick={handleSubmit} className="w-full" disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Place Order'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* mobile-only fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white px-4 py-3 flex items-center justify-between gap-4 z-50 lg:hidden">
        <div className="flex flex-col leading-tight">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-semibold">{formatPrice(grandTotal)}</span>
        </div>
        <Button onClick={handleSubmit} disabled={isProcessing} className="flex-1">
          {isProcessing ? 'Processing...' : 'Place Order'}
        </Button>
      </div>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultTab={authModalTab}
      />
    </>
  );
};

export default Checkout;

// Debounce utility function (moved here for clarity)
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// OrderConfirmation component (fixed as named export, removed duplicate import)


