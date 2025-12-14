'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getProductBySlug, WooProduct } from '@/lib/woocommerce';
import { WP_BASE_URL } from '@/lib/config';
import { Star, Upload, X } from 'lucide-react';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 6;

type ReviewForm = {
  name: string;
  email: string;
  review: string;
  rating: number;
  images: File[];
  previews: string[];
};

const INITIAL_FORM_STATE: ReviewForm = {
  name: '',
  email: '',
  review: '',
  rating: 5,
  images: [],
  previews: [],
};

const convertImageToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result && result.startsWith('data:image/')) {
        resolve(result);
        return;
      }
      reject(new Error('Invalid image format'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const AddReviewClient = ({ slug }: { slug: string }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [product, setProduct] = useState<WooProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ReviewForm>(INITIAL_FORM_STATE);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    getProductBySlug(slug)
      .then((data) => {
        if (active) {
          setProduct(data);
        }
      })
      .catch(() => {
        if (active) {
          setProduct(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const canSubmit = Boolean(
    product &&
      form.name.trim() &&
      form.email.trim() &&
      form.review.trim() &&
      !uploading
  );

  const handleImagesSelected = (files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }

    const remaining = MAX_IMAGES - form.images.length;
    if (remaining <= 0) {
      toast({
        title: 'Upload limit reached',
        description: 'You can attach up to 6 images per review.',
      });
      return;
    }

    let added = 0;

    Array.from(files).some((file) => {
      if (added >= remaining) {
        return true;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: 'Unsupported format',
          description: `${file.name} is not a supported image type.`,
        });
        return false;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 10MB size limit.`,
        });
        return false;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const preview = reader.result as string;
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, file],
          previews: [...prev.previews, preview],
        }));
      };
      reader.readAsDataURL(file);
      added += 1;
      return false;
    });

    if (added > 0) {
      toast({
        title: 'Images added',
        description: `${added} image${added > 1 ? 's' : ''} queued for upload.`,
      });
    }
  };

  const removePreview = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== index),
      previews: prev.previews.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!product) {
      setStatus({ ok: false, msg: 'Cannot find product details.' });
      return;
    }

    if (!canSubmit) {
      setStatus({ ok: false, msg: 'Please complete all required fields.' });
      return;
    }

    setUploading(true);
    setStatus(null);
    setUploadProgress(0);

    try {
      const imagesBase64: string[] = [];

      for (let index = 0; index < form.images.length; index += 1) {
        const file = form.images[index];
        const progress = Math.round(((index + 1) / form.images.length) * 100);
        setUploadProgress(progress);
        const dataUrl = await convertImageToBase64(file);
        imagesBase64.push(dataUrl);
      }

      const response = await fetch(`${WP_BASE_URL}/wp-json/msds_headless_custom_review/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          name: form.name.trim(),
          email: form.email.trim(),
          review: form.review.trim(),
          rating: form.rating,
          images_base64: imagesBase64,
        }),
      });

      const bodyText = await response.text();
      let result: Record<string, any> | null = null;
      try {
        result = JSON.parse(bodyText);
      } catch (error) {
        console.error('AddReview: Failed to parse JSON response', error);
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || bodyText || 'Unable to submit review.');
      }

      toast({
        title: 'Review submitted',
        description: 'Thanks! We will publish it once approved.',
      });

      setStatus({ ok: true, msg: 'Your review is awaiting moderation.' });
      setForm(INITIAL_FORM_STATE);

      setTimeout(() => {
        router.push(`/product/${slug}`);
      }, 1500);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Submission failed');
      toast({
        title: 'Submission failed',
        description: err.message,
      });
      setStatus({ ok: false, msg: err.message });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!slug) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Product slug is required to write a review.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Loading product...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-6">
        <p className="text-2xl font-semibold">Product not found</p>
        <p className="text-muted-foreground">We could not locate the product you are trying to review.</p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className="container mx-auto px-4 py-12 space-y-8 max-w-4xl">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Review</p>
        <h1 className="text-3xl lg:text-4xl font-bold">Write a review for {product.name}</h1>
        <p className="text-muted-foreground">Share your experience so other shoppers can make confident choices.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-background p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="review-name">Name *</Label>
            <Input
              id="review-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <Label htmlFor="review-email">Email *</Label>
            <Input
              id="review-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Rating *</Label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                type="button"
                key={score}
                onClick={() => setForm((prev) => ({ ...prev, rating: score }))}
                className={`w-10 h-10 rounded-full border transition ${form.rating >= score ? 'bg-yellow-400 text-foreground border-yellow-400' : 'border-border text-muted-foreground'}`}
              >
                <Star className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="review-text">Review *</Label>
          <textarea
            id="review-text"
            rows={5}
            value={form.review}
            onChange={(event) => setForm((prev) => ({ ...prev, review: event.target.value }))}
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none"
            placeholder="Tell us what you liked (or what we can improve)"
            required
          />
        </div>

        <div>
          <Label>Photos (optional)</Label>
          <div
            className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition hover:border-primary"
            onClick={() => document.getElementById('review-images')?.click()}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">
              Click or drag to upload up to {MAX_IMAGES} images (JPG/PNG/WebP). Max 10MB per file.
            </p>
            <input
              id="review-images"
              type="file"
              multiple
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={(event) => handleImagesSelected(event.target.files)}
            />
          </div>
          {form.previews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {form.previews.map((src, idx) => (
                <div key={`${src}-${idx}`} className="relative group">
                  <img src={src} alt={`preview-${idx}`} className="h-24 w-full object-cover rounded-2xl border" />
                  <button
                    type="button"
                    onClick={() => removePreview(idx)}
                    className="absolute -top-2 -right-2 bg-background border rounded-full p-1 shadow"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Preparing your review ({uploadProgress}%)</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 md:justify-between">
          <Button type="submit" disabled={!canSubmit} className="flex-1 md:flex-none">
            {uploading ? 'Submitting...' : 'Submit review'}
          </Button>
          <Link href={`/product/${slug}`} className="text-sm text-muted-foreground underline">
            Back to product
          </Link>
        </div>

        {status && (
          <p className={`text-sm ${status.ok ? 'text-green-600' : 'text-rose-600'}`}>
            {status.msg}
          </p>
        )}
      </form>
    </section>
  );
};

export default AddReviewClient;
