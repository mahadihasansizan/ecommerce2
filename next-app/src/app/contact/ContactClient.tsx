'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { WP_BASE_URL } from '@/lib/config';
import { getContactEmail, getSiteName } from '@/lib/tenant-config';

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const DEFAULT_FORM: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

const parseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const ContactClient = () => {
  const { toast } = useToast();
  const siteName = getSiteName();
  const contactEmail = getContactEmail();
  const [form, setForm] = useState<ContactFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const valid = Boolean(form.name.trim() && form.email.trim() && form.message.trim());

  const handleChange = (field: keyof ContactFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || loading) return;

    setLoading(true);
    setStatus(null);

    try {
      const base = WP_BASE_URL.replace(/\/+$/, '');
      const response = await fetch(`${base}/wp-json/kitchenhero/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payloadText = await response.text();
      const payload = parseJson(payloadText);

      if (!response.ok) {
        throw new Error(payload?.message || `Server error ${response.status}`);
      }

      if (payload && payload.success !== undefined && !payload.success) {
        throw new Error(payload.message || 'Request failed');
      }

      toast({ title: 'Message sent', description: 'ধন্যবাদ! আমরা শীঘ্রই উত্তর দেব।' });
      setStatus({ ok: true, msg: 'ধন্যবাদ! আপনার মেসেজ সফলভাবে পাঠানো হয়েছে।' });
      setForm(DEFAULT_FORM);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Submission failed');
      setStatus({ ok: false, msg: err.message });
      toast({ title: 'Submission failed', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2 max-w-2xl">
        <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Contact</p>
        <h1 className="text-3xl font-bold">যোগাযোগ করুন</h1>
        <p className="text-muted-foreground">
          যেকোনো অর্ডার, ডেলিভারি, রিফান্ড বা সাধারণ প্রশ্নের জন্য আমাদের ফর্মটি পূরণ করুন।
          আমরা {siteName} থেকে দ্রুত সাড়া দিব।
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-2 text-sm">
          <p className="font-semibold uppercase tracking-[0.3em] text-muted-foreground">Order Support</p>
          <p className="text-muted-foreground leading-relaxed">
            অর্ডার স্ট্যাটাস জানতে My Orders এ যান অথবা নিচে মেসেজ করুন।
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-2 text-sm">
          <p className="font-semibold uppercase tracking-[0.3em] text-muted-foreground">Hotline</p>
          <p className="text-muted-foreground leading-relaxed">01835868877 (শনিবার - বৃহস্পতিবার ১০টা - ৮টা)</p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-2 text-sm">
          <p className="font-semibold uppercase tracking-[0.3em] text-muted-foreground">Email</p>
          <p className="text-muted-foreground leading-relaxed">{contactEmail}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="contact-name">নাম *</Label>
            <Input
              id="contact-name"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="আপনার নাম"
              required
            />
          </div>
          <div>
            <Label htmlFor="contact-email">ইমেইল *</Label>
            <Input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(event) => handleChange('email', event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="contact-phone">ফোন</Label>
            <Input
              id="contact-phone"
              value={form.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
              placeholder="017XXXXXXXX"
            />
          </div>
          <div>
            <Label htmlFor="contact-subject">বিষয়</Label>
            <Input
              id="contact-subject"
              value={form.subject}
              onChange={(event) => handleChange('subject', event.target.value)}
              placeholder="অর্ডার / সাধারণ প্রশ্ন"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="contact-message">মেসেজ *</Label>
          <textarea
            id="contact-message"
            value={form.message}
            onChange={(event) => handleChange('message', event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="আপনার বার্তা লিখুন..."
            required
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button type="submit" className="flex-1" disabled={!valid || loading}>
            {loading ? 'পাঠানো হচ্ছে...' : 'মেসেজ পাঠান'}
          </Button>
          {status && (
            <p className={`text-sm ${status.ok ? 'text-green-600' : 'text-rose-600'}`}>
              {status.msg}
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default ContactClient;
