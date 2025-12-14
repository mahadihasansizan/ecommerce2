'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OrderState = 'placed' | 'processed' | 'shipped' | 'delivered' | 'contact-support';

const steps: OrderState[] = ['placed', 'processed', 'shipped', 'delivered'];

const buildTimeline = (status: OrderState | null) => {
  if (!status) return [];
  const currentIndex = Math.max(0, steps.indexOf(status as OrderState));
  return steps.map((step, index) => ({
    label: step.replace(/-/g, ' '),
    done: index < currentIndex,
    current: index === currentIndex,
  }));
};

const OrdersClient = () => {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<OrderState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const timeline = useMemo(() => buildTimeline(status), [status]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setStatus(null);
    setTimeout(() => {
      setMessage('To view your order status, contact support with your order details.');
      setStatus('contact-support');
      setLoading(false);
    }, 700);
  };

  return (
    <div className="container mx-auto px-4 py-10 text-left">
      <h1 className="text-3xl font-bold mb-6">Track Your Order</h1>
      <form onSubmit={onSubmit} className="bg-white border rounded-lg p-5 max-w-xl space-y-4" noValidate>
        <div>
          <label className="text-sm font-medium mb-1 block">Order ID</label>
          <Input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="e.g. 15234"
            inputMode="numeric"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Phone Number</label>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Registered phone"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={!orderId || !phone || loading}>
          {loading ? 'Checking...' : 'Check Status'}
        </Button>
        {message && <p className="text-sm text-red-600">{message}</p>}
      </form>
      {status && (
        <div className="mt-10 space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Order #{orderId || 'demo'}</h2>
            <p className="text-sm text-muted-foreground">Status: <span className="capitalize">{status.replace(/-/g, ' ')}</span></p>
          </div>
          <ol className="grid md:flex md:justify-between gap-6">
            {timeline.map((step) => (
              <li key={step.label} className="flex-1">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'w-10 h-10 rounded-full border-2 flex items-center justify-center font-medium',
                      step.done
                        ? 'bg-primary text-white border-primary'
                        : step.current
                        ? 'bg-gradient-to-r from-primary/20 to-primary border-primary text-primary'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    {steps.indexOf(step.label as OrderState) + 1}
                  </span>
                  <div>
                    <p className={cn('text-sm font-semibold', step.done ? 'text-primary' : 'text-muted-foreground')}>
                      {step.label}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default OrdersClient;
