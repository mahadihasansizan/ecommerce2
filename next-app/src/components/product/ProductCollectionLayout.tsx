import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { WooProduct, WooVariation, getProductVariations } from "@/lib/woocommerce";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { Button } from "@/components/ui/button";
import ProductActionButtons from "./ProductActionButtons";
import ProductBottomMenu from "@/components/mobile/ProductBottomMenu";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { parseVariablePriceRange, formatBDT, numbersFromString, cleanPriceHtml, getCurrencySymbolSync } from '@/lib/utils';
import { WP_BASE_URL, WP_API_BASE } from '@/lib/config';
import { Capacitor } from '@capacitor/core';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { toast as sonnerToast } from 'sonner';

/* Global declarations */
declare global {
  interface Window {
    dataLayer: any[] | undefined;
  }
}

/* Helpers */
const getAttrLabel = (attr: any) => {
  if (attr.name) return attr.name;
  if (attr.taxonomy && attr.taxonomy.startsWith("pa_"))
    return attr.taxonomy.replace("pa_", "").replace(/^\w/, c => c.toUpperCase());
  return attr.taxonomy || "Attribute";
};

const stripHtml = (html?: string) =>
  (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
;

const decodeEntities = (input?: string) => {
  if (!input) return "";
  if (typeof window !== "undefined" && "DOMParser" in window) {
    const doc = new DOMParser().parseFromString(input, "text/html");
    const txt = doc.documentElement.textContent || "";
    return txt.replace(/[’]/g, "'").replace(/[“”]/g, '"');
  }
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"');
};
const toPlainText = (html?: string) => decodeEntities(stripHtml(html));

/* Component */
import { proxyRequest } from '@/lib/woocommerce';

const ProductCollectionLayout = memo(({ product }: { product: WooProduct }) => {
  const router = useRouter();
  const { addToCart, openCart } = useCartStore();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlistStore();
  const isWishlisted = isInWishlist(product.id);

  /* Layout Settings State */
  const [layoutSettings, setLayoutSettings] = useState<{
    product_layout: string;
    boxes_per_row: number;
    mobile_boxes_per_row: number;
    box_percentage: number;
    mobile_box_percentage: number;
  } | null>(null);
  const [loadingLayout, setLoadingLayout] = useState(false);

  /* Fetch Layout Settings */
  useEffect(() => {
    const fetchLayoutSettings = async () => {
      setLoadingLayout(true);
      try {
        const url = `${WP_API_BASE}/layout-settings?product_id=${encodeURIComponent(product.id)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Layout settings error ${res.status}`);
        }
        const data = await res.json();

        // Convert backend response to frontend format
        const productLayout = data.product_layout || 'normal';
        const mobileWidth = data.variation_width_mobile || 100;
        const desktopWidth = data.variation_width_desktop || 100;

        // Calculate boxes per row from percentages
        const mobileBoxesPerRow = colsFromPercent(mobileWidth);
        const desktopBoxesPerRow = colsFromPercent(desktopWidth);

        setLayoutSettings({
          product_layout: productLayout,
          boxes_per_row: desktopBoxesPerRow,
          mobile_boxes_per_row: mobileBoxesPerRow,
          box_percentage: Math.min(100, Math.max(10, desktopWidth)),
          mobile_box_percentage: Math.min(100, Math.max(10, mobileWidth))
        });
      } catch (error) {
        console.warn('Failed to fetch layout settings, using defaults:', error);
        // Fallback to default settings
        setLayoutSettings({
          product_layout: 'normal',
          boxes_per_row: 4,
          mobile_boxes_per_row: 2,
          box_percentage: 25,
          mobile_box_percentage: 50
        });
      } finally {
        setLoadingLayout(false);
      }
    };

    fetchLayoutSettings();
  }, [product.id, product.categories, product.tags]);

  /* GA4 / GTM helpers */
  const toNumber = (v: any): number | null => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const effectivePrice = (p: WooProduct, v?: WooVariation | null): number | undefined => {
    const pick = (x: any) =>
      x?.sale_price && x.sale_price !== x.regular_price
        ? x.sale_price
        : (x?.price ?? x?.regular_price);
    return toNumber(pick(v) ?? pick(p) ?? null) ?? undefined;
  };

  const variantLabel = (v?: WooVariation | null) =>
    (v?.attributes || [])
      .map(a => a?.option)
      .filter(Boolean)
      .join(" / ") || undefined;

  const buildGa4Item = (p: WooProduct, v?: WooVariation | null) => {
    const cats = (p as any)?.categories?.map((c: any) => c?.name).filter(Boolean) || [];
    return {
      item_id: v?.id ?? p.id,
      item_name: p.name,
      sku: v?.sku || p.sku || undefined,
      item_variant: variantLabel(v),
      price: effectivePrice(p, v),
      quantity: 1,
      item_category: cats[0],
      item_category2: cats[1],
      item_category3: cats[2],
      item_category4: cats[3],
      item_category5: cats[4],
      google_business_vertical: "retail"
    };
  };

  /* Images */
  const images = useMemo(
    () => (product.images?.length ? product.images : [{ src: "/placeholder.svg", id: 0 }]),
    [product.images]
  );
  const [sliderIndex, setSliderIndex] = useState(0);
  const nextImage = () => setSliderIndex(i => (i + 1) % images.length);
  const prevImage = () => setSliderIndex(i => (i - 1 + images.length) % images.length);

  /* Add state for quantity selector */
  const [quantity, setQuantity] = useState(1);

  /* Add state for custom labels */

  /* Add collapsible states for description/reviews */
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(true);

  /* Add review modal states */
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewPopupOpen, setReviewPopupOpen] = useState(false);
  const [reviewLightbox, setReviewLightbox] = useState<{ images: string[]; index: number } | null>(null);

  /* Add review form state for image uploads */
  const [revForm, setRevForm] = useState<{
    name: string;
    email: string;
    review: string;
    rating: number;
    images: File[];
    previews: string[];
    uploading: boolean;
    uploadProgress: number;
  }>({ name: "", email: "", review: "", rating: 5, images: [], previews: [], uploading: false, uploadProgress: 0 });

  /* Refs */
  const variationBoxRef = useRef<HTMLDivElement | null>(null);
  const mobileThumbsRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<HTMLDivElement | null>(null);


  /* Variations */
  const [variations, setVariations] = useState<WooVariation[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);
  const [openDesc, setOpenDesc] = useState<Record<number, boolean>>({});

  const [variationAttributes, setVariationAttributes] = useState<
    { key: string; label: string; options: string[] }[]
  >([]);
  const [selectedAttrs, setSelectedAttrs] = useState<{ [k: string]: string | null }>({});

  useEffect(() => {
    if (product.type === "variable" && Array.isArray(product.attributes)) {
      const attrs = product.attributes
        .filter((a: any) => a.variation)
        .map((a: any) => ({
          key: a.taxonomy || a.name,
          label: getAttrLabel(a),
          options: a.options || []
        }));
      setVariationAttributes(attrs);
      const init: any = {};
      attrs.forEach(a => (init[a.key] = null));
      setSelectedAttrs(init);
    } else {
      setVariationAttributes([]);
      setSelectedAttrs({});
    }
  }, [product]);

  const getVariationMeta = (v: any, key: string) => {
    const meta = (v?.meta_data || []).find((m: any) => m?.key === key)?.value;
    if (meta !== undefined && meta !== null) return meta;
    // Fallback to top-level field (our REST adds layout_order, recommendation, description_title directly)
    return (v as any)?.[key] ?? null;
  };

  const getVariationOrder = useCallback((v: any): number => {
    const raw = getVariationMeta(v, "layout_order");
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
    if (!Number.isNaN(n)) return n;
    if (typeof v?.menu_order === "number") return v.menu_order;
    return Number.MAX_SAFE_INTEGER;
  }, []);

  /* Load variations (no auto-select) */
  useEffect(() => {
    let active = true;
    async function run() {
      if (product.type !== "variable") {
        setVariations([]);
        setSelectedVariationId(null);
        return;
      }
      try {
        const vars = await getProductVariations(product.id);
        if (!active) return;
        const sorted = (vars || [])
          .slice()
          .sort((a: any, b: any) => {
            const ao = getVariationOrder(a);
            const bo = getVariationOrder(b);
            if (ao !== bo) return ao - bo;
            const am = typeof a?.menu_order === "number" ? a.menu_order : Number.MAX_SAFE_INTEGER;
            const bm = typeof b?.menu_order === "number" ? b.menu_order : Number.MAX_SAFE_INTEGER;
            if (am !== bm) return am - bm;
            return (a?.id || 0) - (b?.id || 0);
          });
        setVariations(sorted);
      } catch {
        if (!active) return;
        setVariations([]);
      }
    }
    run();
    return () => {
      active = false;
    };
  }, [product.id, product.type, getVariationOrder]);

  const clearSelection = () => {
    setSelectedAttrs(prev => {
      const c: any = {};
      Object.keys(prev).forEach(k => (c[k] = null));
      return c;
    });
  };

  const handleSelectChange = (k: string, v: string) => setSelectedAttrs(p => ({ ...p, [k]: v || null }));

  const handleImagesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxImages = 6;

    const validFiles: File[] = [];
    const previews: string[] = [];

    // Validate files
    for (let i = 0; i < Math.min(files.length, maxImages - revForm.images.length); i++) {
      const file = files[i];

      // Check file type
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: `${file.name} is not a supported image format. Only JPEG, JPG, PNG, and WebP are allowed.`
        });
        continue;
      }

      // Check file size
      if (file.size > maxFileSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum size is 10MB per image.`
        });
        continue;
      }

      validFiles.push(file);

      // Create preview
      try {
        const preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        previews.push(preview);
      } catch (error) {
        console.warn('Failed to create preview for', file.name);
      }
    }

    if (validFiles.length === 0) return;

    // Update form state
    setRevForm(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles],
      previews: [...prev.previews, ...previews]
    }));

    // Show success message
    if (validFiles.length === 1) {
      toast({
        title: "Image added",
        description: `${validFiles[0].name} has been added to your review.`
      });
    } else {
      toast({
        title: "Images added",
        description: `${validFiles.length} images have been added to your review.`
      });
    }
  };

  const removePreview = (idx: number) => {
    const images = [...revForm.images];
    const previews = [...revForm.previews];
    images.splice(idx, 1);
    previews.splice(idx, 1);
    setRevForm(f => ({ ...f, images, previews }));
  };

  const submitReviewWithImages = async () => {
    if (!revForm.name || !revForm.email || !revForm.review) {
      toast({ variant: "destructive", title: "Fill required fields." });
      return;
    }

    if (revForm.uploading) return;

    setRevForm(prev => ({ ...prev, uploading: true, uploadProgress: 0 }));

    try {
      // Convert images to base64
      const imagesBase64: string[] = [];

      for (let i = 0; i < revForm.images.length; i++) {
        const file = revForm.images[i];
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              // Validate the base64 format
              if (result && result.startsWith('data:image/')) {
                resolve(result);
              } else {
                reject(new Error('Invalid image format'));
              }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });

          imagesBase64.push(base64);

          // Update progress
          setRevForm(prev => ({
            ...prev,
            uploadProgress: Math.round(((i + 1) / revForm.images.length) * 100)
          }));

        } catch (error) {
          console.warn(`Failed to process image ${file.name}:`, error);
          toast({
            variant: "destructive",
            title: "Image processing failed",
            description: `Failed to process ${file.name}. Please try again.`
          });
          setRevForm(prev => ({ ...prev, uploading: false, uploadProgress: 0 }));
          return;
        }
      }

      // Submit review with images via proxy
      const data = await proxyRequest('/msds_headless_custom_review/v1/reviews', {
        product_id: product.id,
        name: revForm.name,
        email: revForm.email,
        review: revForm.review,
        rating: revForm.rating,
        images_base64: imagesBase64
      }, 'POST');

      if (data.success) {
        toast({
          title: "Review submitted successfully!",
          description: "Your review with images has been submitted and is pending approval."
        });
        setReviewModalOpen(false);
        setRevForm({
          name: "",
          email: "",
          review: "",
          rating: 5,
          images: [],
          previews: [],
          uploading: false,
          uploadProgress: 0
        });
        fetchReviews();
      } else {
        throw new Error(data.message || "Failed to submit review");
      }

    } catch (error: any) {
      console.error('Review submission error:', error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message || "Please try again later."
      });
    } finally {
      setRevForm(prev => ({ ...prev, uploading: false, uploadProgress: 0 }));
    }
  };

  /* Reviews + FAQs */
    // Accordion Tabs State (Description / Reviews / FAQs)
    const [openTabs, setOpenTabs] = useState<{ desc: boolean; reviews: boolean; faqs: boolean }>({
      desc: true,
      reviews: false,
      faqs: false
    });
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [faqOpenIndex, setFaqOpenIndex] = useState(0);
  const [ratingSummary, setRatingSummary] = useState<{ avg:number; count:number }>({ avg:0, count:0 });
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  // API: Reviews
  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const data = await proxyRequest('/msds_headless_custom_review/v1/reviews', { product_id: product.id });
      if (Array.isArray(data)) {
        const norm = data.map((rv: any) => ({
          id: rv.id,
          author: rv.author,
          content: rv.content,
          rating: rv.rating,
          verified: !!rv.verified,
          images: rv.images || [],
          date: rv.date
        }));
        setReviews(norm);
      } else {
        setReviews([]);
      }
    } catch (error) {
      // Silently handle invalid endpoint errors (endpoint may not be available)
      if (error instanceof Error && error.name !== 'InvalidEndpointError') {
        console.warn('Failed to fetch reviews:', error);
      }
      setReviews([]);
    }
    setLoadingReviews(false);
  }, [product.id]);
  useEffect(() => {
    fetchReviews();
  }, [product.id, fetchReviews]);

  // API: Rating Summary
  const fetchRatingSummary = useCallback(async () => {
    try {
      const data = await proxyRequest('/msds_headless_custom_review/v1/rating-summary', { product_id: product.id });
      if (data && typeof data.average === 'number') {
        setRatingSummary({ avg: data.average, count: data.count });
      }
    } catch (error) {
      // Silently handle invalid endpoint errors (endpoint may not be available)
      if (error instanceof Error && error.name !== 'InvalidEndpointError') {
        console.warn('Failed to fetch rating summary:', error);
      }
    }
  }, [product.id]);
  useEffect(() => {
    fetchRatingSummary();
  }, [product.id, fetchRatingSummary]);

  // API: FAQs
  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const res = await fetch(`${WP_API_BASE}/faqs?product_id=${encodeURIComponent(product.id)}`);
      if (!res.ok) {
        throw new Error(`FAQ fetch failed ${res.status}`);
      }
      const data = await res.json();
      let fetchedFaqs: any[] = [];
      if (Array.isArray(data)) {
        fetchedFaqs = data;
      } else if (data && Array.isArray(data.faqs)) {
        fetchedFaqs = data.faqs;
      } else if (data && data.success && Array.isArray(data.data?.faqs)) {
        fetchedFaqs = data.data.faqs;
      }
      setFaqs(fetchedFaqs);
      
      // Update window history state to notify Header component
      if (typeof window !== 'undefined') {
        const currentState = window.history.state || {};
        window.history.replaceState(
          { ...currentState, faqCount: fetchedFaqs.length },
          '',
          window.location.href
        );
        
        // Dispatch custom event for Header to listen to
        window.dispatchEvent(new CustomEvent('faqCountUpdated', { detail: { count: fetchedFaqs.length } }));
      }
    } catch (e) {
      setFaqs([]);
      // Update state even on error
      if (typeof window !== 'undefined') {
        const currentState = window.history.state || {};
        window.history.replaceState(
          { ...currentState, faqCount: 0 },
          '',
          window.location.href
        );
        window.dispatchEvent(new CustomEvent('faqCountUpdated', { detail: { count: 0 } }));
      }
    }
    setLoadingFaqs(false);
  }, [product.id]);
  useEffect(() => {
    fetchFaqs();
  }, [product.id, fetchFaqs]);

  // API: Custom Labels
  const fetchCustomLabels = useCallback(async () => {
    setLoadingLabels(true);
    try {
      const res = await fetch(`${WP_API_BASE}/custom-labels?product_id=${encodeURIComponent(product.id)}`);
      if (!res.ok) {
        throw new Error(`Labels fetch failed ${res.status}`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.labels)) {
        setCustomLabels(data.labels);
      } else if (Array.isArray((data as any))) {
        setCustomLabels(data as any);
      } else if (data && data.success && Array.isArray((data as any).data?.labels)) {
        setCustomLabels((data as any).data.labels);
      } else {
        setCustomLabels([]);
      }
    } catch (error) {
      setCustomLabels([]);
    } finally {
      setLoadingLabels(false);
    }
  }, [product.id]);
  useEffect(() => {
    fetchCustomLabels();
  }, [product.id, fetchCustomLabels]);
  const toggleTab = (k: keyof typeof openTabs) =>
    setOpenTabs(p => ({ ...p, [k]: !p[k] }));

  // Listen for header section open events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.section) return;
      // The 'info' key corresponds to the description tab
      if (detail.section === 'info') setOpenTabs(t => ({ ...t, desc: true }));
      if (detail.section === 'reviews') setOpenTabs(t => ({ ...t, reviews: true }));
      if (detail.section === 'faqs') setOpenTabs(t => ({ ...t, faqs: true }));
    };
    window.addEventListener('kh-open-section', handler as EventListener);
    return () => window.removeEventListener('kh-open-section', handler as EventListener);
  }, []);

  /* Review form state */
  const [reviewForm, setReviewForm] = useState({
    name: "",
    email: "",
    rating: 0,
    comment: ""
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleReviewField = (field: keyof typeof reviewForm, value: string | number) =>
    setReviewForm(f => ({ ...f, [field]: value }));

  const canSubmitReview =
    reviewForm.name.trim() &&
    reviewForm.email.trim() &&
    reviewForm.rating > 0 &&
    reviewForm.comment.trim().length > 5;

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitReview || submittingReview) return;
    setSubmittingReview(true);
    try {
      // Plugin expects POST /msds_headless_custom_review/v1/reviews with: product_id,name,email,review,rating,(images_base64?)
      const data = await proxyRequest('/msds_headless_custom_review/v1/reviews', {
        product_id: product.id,
        name: reviewForm.name,
        email: reviewForm.email,
        rating: reviewForm.rating,
        review: reviewForm.comment
      }, 'POST');
      if (!data?.success) throw new Error(data?.message || "Failed to submit review");
      // Optimistic (pending) review
      setReviews(prev => [
        {
          id: Date.now(),
          author: reviewForm.name,
          content: `<p>${reviewForm.comment.replace(/\n+/g,"<br/>")}</p>`,
          rating: reviewForm.rating,
          verified: data.verified === "yes",
          pending: true,
          images: []
        },
        ...prev
      ]);
      setReviewForm({ name: "", email: "", rating: 0, comment: "" });
      setOpenTabs(p => ({ ...p, reviews: true }));
      toast({ title: "Review submitted", description: "Awaiting admin approval." });
      setReviewPopupOpen(false); // Close popup on success
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not submit review",
        description: err.message || "Try again later."
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  /* Rating summary */
  // Prefer server summary (published reviews only). Fallback to local published reviews (exclude optimistic pending).
  const publishedLocal = reviews.filter(r => !r.pending);
  const totalReviews = ratingSummary.count || publishedLocal.length;
  const avgRating = ratingSummary.avg > 0
    ? ratingSummary.avg
    : (publishedLocal.length
        ? publishedLocal.reduce((s, r) => s + (r.rating || 0), 0) / publishedLocal.length
        : 0);

  const renderDetailRating = useCallback(() => {
    if (!totalReviews || avgRating <= 0) return null;
    const full = Math.floor(avgRating);
    const hasHalf = avgRating - full >= 0.5;
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < 5; i++) {
      const half = hasHalf && i === full;
      const filled = i < full;
      stars.push(
        <svg key={i} viewBox="0 0 20 20" className="w-5 h-5">
          {half ? (
            <defs>
              <linearGradient id={`half-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#d1d5db" />
              </linearGradient>
            </defs>
          ) : null}
          <path
            fill={half ? `url(#half-${i})` : filled ? "#f59e0b" : "#d1d5db"}
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 0 0 .95.69h4.175c.97 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 0 0-.364 1.118l1.287 3.966c.3.922-.756 1.688-1.54 1.118l-3.38-2.454a1 1 0 0 0-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 0 0-.364-1.118L2.04 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 0 0 .95-.69l1.286-3.967Z"
          />
        </svg>
      );
    }
    return (
      <div className="flex items-center gap-2 mt-1">
        <div className="flex">{stars}</div>
        <span className="text-sm text-muted-foreground">
          {avgRating.toFixed(1)} ({totalReviews})
        </span>
      </div>
    );
  }, [avgRating, totalReviews]);

  const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg
      className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );

  /* Touch slider (mobile) */
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const SWIPE_THRESHOLD = 40;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (touchStartX.current == null) return;
    if (touchDeltaX.current > SWIPE_THRESHOLD) prevImage();
    else if (touchDeltaX.current < -SWIPE_THRESHOLD) nextImage();
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  /* Mobile thumbnails */
  const SHOW_MOBILE_THUMBS = true;
  const SHOW_DESKTOP_THUMBS = true;
  const mobileVirtualThumbs = useMemo(
    () =>
      images.map((img, i) => ({
        key: `m-${img.id ?? i}`,
        idx: i,
        src: img.src
      })),
    [images]
  );
  const handleMobileThumbsScroll = () => {};

  /* Variation card desc toggle */
  const toggleDesc = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenDesc(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /* Cart handlers with quantity support */
  const addToCartInProgressRef = useRef<boolean>(false);

  const selectedVariation =
    product.type === "variable"
      ? variations.find(v => v.id === selectedVariationId)
      : null;

  // Scroll to variations function
  const scrollToVariations = () => {
    if (variationBoxRef.current) {
      variationBoxRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  // Helper: compute number of columns from a percent width (clamped 10-100).
  const colsFromPercent = (w: any) => {
    if (w == null) return 1;
    // Accept values like '25', '25%', ' 25 %'
    const raw = String(w).trim();
    const m = raw.match(/-?\d+(?:\.\d+)?/);
    if (!m) return 1;
    const n = parseFloat(m[0]);
    if (!Number.isFinite(n) || n <= 0) return 1;
    const clamped = Math.min(100, Math.max(10, Math.round(n)));
    return Math.max(1, Math.floor(100 / clamped));
  };

  // Determine mobile/desktop widths (fallback to legacy variation_width)
  const mobileWidth = (product as any).variation_width_mobile ?? (product as any).variation_width ?? 100;
  const desktopWidth = (product as any).variation_width_desktop ?? (product as any).variation_width ?? 100;

  const renderBoxCard = (v: any) => {
    const selected = v.id === selectedVariationId;
    const title = (v as any).name?.toString().trim() || (Array.isArray(v.attributes) && v.attributes.map((a:any) => a.option).filter(Boolean).join(" / ")) || "Option";
    const imgSrc = (v.image && (v as any).image.src) || images[0]?.src || "/placeholder.svg";
    const onSale = !!(v.sale_price && v.sale_price !== "" && v.sale_price !== v.regular_price);

    return (
      <div
        key={v.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedVariationId(selected ? null : v.id)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedVariationId(selected ? null : v.id);
          }
        }}
        className={`relative rounded-lg border p-4 transition-all cursor-pointer ${selected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-gray-300 bg-gray-50 hover:border-primary/60"}`}
      >
        <img src={imgSrc} alt={title} className="w-full h-32 object-cover mb-2 rounded" loading="lazy" width={300} height={128} decoding="async" />
        <div className="text-sm font-semibold mb-1 break-words">{title}</div>
        <div className="text-sm text-primary">
          {onSale ? (
            <>{formatBDT(Number((v as any).sale_price) || Number((v as any).price) || 0)}</>
          ) : (
            <>{formatBDT(Number((v as any).price) || Number((v as any).regular_price) || 0)}</>
          )}
        </div>
        {selected && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm my-1 ">
            ✓
          </div>
        )}
      </div>
    );
  };

  let bottomPriceContent: React.ReactNode | null = null;
  if (product.type === "variable") {
    if (selectedVariation) {
      const effective =
        (selectedVariation.sale_price &&
          selectedVariation.sale_price !== selectedVariation.regular_price &&
          selectedVariation.sale_price) ||
        selectedVariation.price ||
        selectedVariation.regular_price;
      if (effective) {
        bottomPriceContent = <span className="text-base font-semibold">{formatBDT(Number(effective) || 0)}</span>;
      }
    }
  } else {
    const effective =
      (product.sale_price &&
        product.sale_price !== product.regular_price &&
        product.sale_price) ||
      product.price ||
      product.regular_price;
    if (effective) {
      bottomPriceContent = <span className="text-base font-semibold">{formatBDT(Number(effective) || 0)}</span>;
    }
  }

const CURRENCY = getCurrencySymbolSync();

const renderPrice = () => {
  if (product.type === "variable" && product.price_html) {
    // Prefer parsed numbers from price_html (ins/del), otherwise clean the HTML and show as text
    const parsed = parseVariablePriceRange(product.price_html || "");
    if (typeof parsed.min === "number" && typeof parsed.max === "number") {
      if (parsed.min === parsed.max) return <span className="text-primary">{formatBDT(parsed.min)}</span>;
      return <span className="text-primary">{formatBDT(parsed.min)}-{formatBDT(parsed.max)}</span>;
    }
    const cleaned = cleanPriceHtml(product.price_html || "");
    // If cleaned contains numbers, format them
    const nums = numbersFromString(cleaned || "");
    if (nums.length === 1) return <span className="text-primary">{formatBDT(nums[0])}</span>;
    if (nums.length >= 2) return <span className="text-primary">{formatBDT(Math.min(...nums))}-{formatBDT(Math.max(...nums))}</span>;
    // Fallback: render cleaned text without raw currency duplication
    return <span className="text-primary">{cleaned}</span>;
  }

  if (product.sale_price && product.sale_price !== product.regular_price)
    return (
      <>
        <span className="text-primary">{formatBDT(Number(product.sale_price) || 0)}</span>
        <span className="ml-2 line-through text-muted-foreground text-base">{formatBDT(Number(product.regular_price) || 0)}</span>
      </>
    );
  return <span className="text-primary">{formatBDT(Number(product.price) || 0)}</span>;
};

  // Pass review count to header via location state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          reviewCount: totalReviews
        },
        ''
      );
    }
  }, [totalReviews]);

  const Breadcrumb = () => (
    <nav className="text-sm mb-4 text-muted-foreground">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="flex items-center gap-1 text-primary font-medium hover:underline"
            onClick={() => router.back()}
            aria-label="Back"
            type="button"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          <span className="hover:underline cursor-pointer whitespace-nowrap flex-shrink-0" onClick={() => router.push("/")}>Home</span>
          <span className="mx-1 flex-shrink-0">/</span>
          <span className="hover:underline cursor-pointer whitespace-nowrap flex-shrink-0" onClick={() => router.push("/products")}>Products</span>
          <span className="mx-1 flex-shrink-0">/</span>
          <span className="text-primary truncate" title={product.name}>{product.name}</span>
        </div>
      </div>
    </nav>
  );

  /* Render */
  const isNative = Capacitor.isNativePlatform();
  return (
  <div className={`container mx-auto px-4 md:px-4 py-8 pb-32 md:pb-8 text-left ${isNative ? 'safe-area-x' : ''}`}>
      <Breadcrumb />

      <div id="info-section" className="scroll-mt-24 h-0" />
      <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Left: Images */}
          <div className="flex flex-col">
            {/* Mobile main slider */}
            <div
              className="md:hidden relative w-full aspect-square bg-white border rounded-lg overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <img
                src={images[sliderIndex]?.src}
                alt={`Product image ${sliderIndex + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                width={800}
                height={800}
                decoding="async"
              />
              {/* Free Delivery Overlay */}
              {(product as any).free_delivery && (
                <div className="absolute top-3 right-3 z-10">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg"
                    style={{ backgroundColor: '#22c55e' }}
                  >
                    Free Delivery
                  </span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    onClick={e => {
                      e.stopPropagation();
                      prevImage();
                    }}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    onClick={e => {
                      e.stopPropagation();
                      nextImage();
                    }}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Go to image ${i + 1}`}
                        onClick={() => setSliderIndex(i)}
                        className={`w-2 h-2 rounded-full ${
                          i === sliderIndex ? "bg-primary" : "bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Mobile thumbnails */}
            {SHOW_MOBILE_THUMBS && images.length > 1 && (
              <div className="md:hidden mt-3">
                <div
                  ref={mobileThumbsRef}
                  onScroll={handleMobileThumbsScroll}
                  className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
                  role="list"
                >
                  {mobileVirtualThumbs.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSliderIndex(t.idx)}
                      className={`shrink-0 w-16 h-16 rounded border overflow-hidden ${
                        t.idx === sliderIndex
                          ? "ring-2 ring-primary border-primary"
                          : "border-gray-300"
                      }`}
                    >
                      <img
                        src={t.src}
                        alt={`Thumbnail ${t.idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        width={100}
                        height={100}
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop image + thumbs */}
            <div className="hidden md:flex flex-col">
              <div className="relative w-full aspect-square bg-white border rounded-lg overflow-hidden">
                <img
                  src={images[sliderIndex]?.src}
                  alt={`Product image ${sliderIndex + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  width={800}
                  height={800}
                  decoding="async"
                />
                {/* Free Delivery Overlay */}
                {(product as any).free_delivery && (
                  <div className="absolute top-4 right-4 z-10">
                    <span
                      className="inline-block px-4 py-2 rounded-full text-sm font-semibold text-white shadow-lg"
                      style={{ backgroundColor: '#22c55e' }}
                    >
                      Free Delivery
                    </span>
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      aria-label="Next image"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {SHOW_DESKTOP_THUMBS && images.length > 1 && (
                <div className="relative mt-3">
                  <div
                    ref={thumbsRef}
                    className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1"
                    role="list"
                  >
                    {images.map((img, idx) => (
                      <button
                        key={img.id ?? idx}
                        type="button"
                        onClick={() => setSliderIndex(idx)}
                        className={`shrink-0 w-20 h-20 rounded border overflow-hidden snap-start ${
                          idx === sliderIndex
                            ? "ring-2 ring-primary border-primary"
                            : "border-gray-300"
                        }`}
                      >
                        <img
                          src={img.src}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          width={100}
                          height={100}
                          decoding="async"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold flex-1">{product.name}</h1>
              <button
                onClick={() => {
                  if (isWishlisted) {
                    removeFromWishlist(product.id);
                    sonnerToast.success('Removed from wishlist');
                  } else {
                    addToWishlist(product);
                    sonnerToast.success('Added to wishlist');
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                {isWishlisted ? (
                  <HeartIconSolid className="h-6 w-6 text-red-500" />
                ) : (
                  <HeartIcon className="h-6 w-6 text-gray-600 hover:text-red-500" />
                )}
              </button>
            </div>
            {renderDetailRating()}
            <div className="mb-2 mt-2 text-sm text-muted-foreground">SKU: {product.sku || "N/A"}</div>
            <div className="mb-4 text-xl font-semibold text-primary">{renderPrice()}</div>
            {/* Stock status badge with custom labels */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {product.stock_status === "instock" ? (
                <span className="inline-block px-2 py-0.5 rounded-full text-sm bg-green-100 text-green-800">In stock</span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded-full text-sm bg-orange-100 text-orange-800">Out of stock</span>
              )}
              {customLabels.map((label, index) => {
                // Predefined color combinations that Tailwind can detect
                const getChipStyles = (idx: number) => {
                  const colors = [
                    { backgroundColor: '#dbeafe', color: '#1e40af' }, // blue-100, blue-800
                    { backgroundColor: '#faf5ff', color: '#6b21a8' }, // purple-100, purple-800
                    { backgroundColor: '#fdf2f8', color: '#9d174d' }, // pink-100, pink-800
                    { backgroundColor: '#eef2ff', color: '#312e81' }, // indigo-100, indigo-800
                    { backgroundColor: '#f0fdfa', color: '#115e59' }, // teal-100, teal-800
                    { backgroundColor: '#ecfeff', color: '#164e63' }, // cyan-100, cyan-800
                    { backgroundColor: '#f0fdf4', color: '#166534' }, // emerald-100, emerald-800
                    { backgroundColor: '#f7fee7', color: '#3f6212' }, // lime-100, lime-800
                    { backgroundColor: '#fffbeb', color: '#92400e' }, // amber-100, amber-800
                    { backgroundColor: '#fff7ed', color: '#9a3412' }, // orange-100, orange-800
                    { backgroundColor: '#fef2f2', color: '#991b1b' }, // red-100, red-800
                    { backgroundColor: '#fdf2f8', color: '#9f1239' }  // rose-100, rose-800
                  ];
                  return colors[idx % colors.length];
                };

                const chipStyle = getChipStyles(index);
                return (
                  <span
                    key={index}
                    className="inline-block px-2 py-0.5 rounded-full text-sm"
                    style={chipStyle}
                  >
                    {label.trim()}
                  </span>
                );
              })}
            </div>

            <div className="mb-4 text-base text-muted-foreground">
              {product.short_description && (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: product.short_description }}
                />
              )}
            </div>

            {/* Variations */}
            {product.type === "variable" && (
              <>
                {loadingLayout ? (
                  <div className="mb-4 flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading layout settings...</div>
                  </div>
                ) : layoutSettings?.product_layout === 'box' ? (
                  <div className="mb-4">
                    {/* Mobile: use mobile boxes per row */}
                    <div className="md:hidden">
                      {(() => {
                        const boxesPerRow = layoutSettings?.mobile_boxes_per_row || 2;
                        const percentage = layoutSettings?.mobile_box_percentage || 50;
                        const template = `repeat(${boxesPerRow}, minmax(0, 1fr))`;
                        return (
                          <div className="grid gap-3" style={{ gridTemplateColumns: template }}>
                            {variations.map(v => (
                              <div key={v.id}>
                                {renderBoxCard(v)}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Desktop: use desktop boxes per row */}
                    <div className="hidden md:block">
                      {(() => {
                        const boxesPerRow = layoutSettings?.boxes_per_row || 4;
                        const percentage = layoutSettings?.box_percentage || 25;
                        const template = `repeat(${boxesPerRow}, minmax(0, 1fr))`;
                        return (
                          <div className="grid gap-4" style={{ gridTemplateColumns: template }}>
                            {variations.map(v => (
                              <div key={v.id}>
                                {renderBoxCard(v)}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : layoutSettings?.product_layout === 'collection' ? (
                  <div className="mb-4">
                    {/* Collection Layout - Grid with 3 columns on desktop, 2 on mobile */}
                    <div className="md:hidden">
                      <div className="grid grid-cols-2 gap-3">
                        {variations.map(v => (
                          <div key={v.id}>
                            {renderBoxCard(v)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <div className="grid grid-cols-3 gap-4">
                        {variations.map(v => (
                          <div key={v.id}>
                            {renderBoxCard(v)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Normal Layout - Original variation display */
                  <div ref={variationBoxRef} className="mb-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        Select an option{" "}
                        {selectedVariationId == null && <span className="text-red-500">*</span>}
                      </div>
                      {selectedVariationId != null && (
                        <button
                          type="button"
                          onClick={() => setSelectedVariationId(null)}
                          className="text-xs underline text-primary hover:opacity-80"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="grid gap-5">
                      {variations.map(v => {
                        const selected = v.id === selectedVariationId;
                        const title =
                          (v as any).name?.toString().trim() ||
                          (Array.isArray(v.attributes) &&
                            v.attributes.map((a:any) => a.option).filter(Boolean).join(" / ")) ||
                          "Option";
                        const imgSrc =
                          (v as any).image?.src ||
                          images[0]?.src ||
                          "/placeholder.svg";
                        const onSale =
                          !!(v.sale_price &&
                            v.sale_price !== "" &&
                            v.sale_price !== v.regular_price);
                        const htmlDesc =
                          (v as any).variation_description ||
                          (v as any).description ||
                          "";
                        const isOpen = !!openDesc[v.id];
                        const recLabel = toPlainText(
                          String(getVariationMeta(v, "recommendation") || "")
                        ).trim();
                        const descTitle = toPlainText(
                          String(getVariationMeta(v, "description_title") || "")
                        ).trim();
                        const panelId = `var-desc-${v.id}`;

                        return (
                          <div
                            key={v.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedVariationId(selected ? null : v.id)}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedVariationId(selected ? null : v.id);
                              }
                            }}
                            className={`relative rounded-lg border transition-all p-4 ${
                              selected
                                ? "border-primary ring-1 ring-primary bg-primary/5"
                                : "border-gray-300 bg-gray-50 hover:border-primary/60"
                            }`}
                          >
                            {recLabel && (
  <span className="absolute top-0 right-2 bg-yellow-400 text-black text-[8px] font-semibold rounded-full shadow px-3 py-1 z-10">
      {recLabel}
  </span>
)}

                            {/* Mobile layout */}
                            <div className="md:hidden space-y-3">
                              <div className="grid grid-cols-[64px,1fr,auto] items-center gap-3">
                                        <div className="w-16 h-16 rounded overflow-hidden bg-white border">
                                          <img
                                            src={imgSrc}
                                            alt={title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                          />
                                        </div>
                                <div className="min-w-0">
                                  <div className="font-semibold break-words">{title}</div>
                                </div>
                                <div className="text-right">
                                  {onSale ? (
                                    <>
                                      <div className="text-primary text-base font-semibold leading-none">
                                        {formatBDT(Number((v as any).sale_price) || 0)}
                                      </div>
                                      <div className="text-xs line-through text-muted-foreground">
                                        {formatBDT(Number((v as any).regular_price) || 0)}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-primary text-base font-semibold leading-none">
                                      {formatBDT(Number((v as any).price) || Number((v as any).regular_price) || 0)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <hr className="my-2 border-gray-200" />

                              {htmlDesc && descTitle && (
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    className="w-full flex items-center justify-between text-left"
                                    onClick={e => toggleDesc(v.id, e)}
                                    aria-expanded={isOpen}
                                    aria-controls={panelId}
                                  >
                                    <span className="text-sm font-medium">{descTitle}</span>
                                    <ChevronIcon open={isOpen} />
                                  </button>
                                  {isOpen && (
                                    <div
                                      id={panelId}
                                      className="mt-2 text-sm text-muted-foreground prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: htmlDesc }}
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Desktop layout */}
                            <div className="hidden md:grid md:grid-cols-12 md:items-center md:gap-4">
                              <div className="md:col-span-2">
                                <div className="w-20 h-20 rounded overflow-hidden bg-white border">
                                  <img
                                    src={imgSrc}
                                    alt={title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    width={200}
                                    height={200}
                                    decoding="async"
                                  />
                                </div>
                              </div>
                              <div className="md:col-span-7 min-w-0">
                                <div className="font-semibold">{title}</div>
                                {htmlDesc && descTitle && (
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      className="w-full flex items-center justify-between text-left text-sm"
                                      onClick={e => toggleDesc(v.id, e)}
                                      aria-expanded={isOpen}
                                      aria-controls={panelId}
                                    >
                                      <span className="font-medium">{descTitle}</span>
                                      <ChevronIcon open={isOpen} />
                                    </button>
                                    {isOpen && (
                                      <div
                                        id={panelId}
                                        className="prose prose-sm max-w-none text-muted-foreground mt-1"
                                        dangerouslySetInnerHTML={{ __html: htmlDesc }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="md:col-span-3 flex md:justify-end">
                                <div className="text-right">
                                  {onSale ? (
                                    <>
                                      <div className="text-primary text-xl font-semibold leading-none">
                                        {formatBDT(Number((v as any).sale_price) || 0)}
                                      </div>
                                      <div className="text-sm line-through text-muted-foreground">
                                        {formatBDT(Number((v as any).regular_price) || 0)}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-primary text-xl font-semibold leading-none">
                                      {formatBDT(Number((v as any).price) || Number((v as any).regular_price) || 0)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Quantity Selector */}
            <div className="mb-4 flex items-center gap-3">
              <span className="font-medium">Qty:</span>
              <div className="flex items-stretch border rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 flex items-center justify-center text-lg font-semibold hover:bg-muted disabled:opacity-40"
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  –
                </button>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-14 h-9 text-center text-sm border-x outline-none"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-9 h-9 flex items-center justify-center text-lg font-semibold hover:bg-muted"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Desktop Action Buttons */}
            <div className={`mb-8 mt-3 hidden md:flex gap-3`}>
              <ProductActionButtons
                product={product}
                selectedVariation={selectedVariation}
                selectedVariationId={selectedVariationId}
                quantity={quantity}
                disabled={product.stock_status !== "instock"}
                disabledMessage={product.stock_status !== "instock" ? "Out of stock" : ""}
                onScrollToVariations={scrollToVariations}
              />
            </div>

            {/* Product Note - Desktop */}
            {product.product_note && (
              <div className="mb-4 hidden md:block">
                <div
                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: product.product_note }}
                />
              </div>
            )}

            {product.stock_status !== "instock" && (
              <p className="text-sm text-orange-600 text-center mt-2 font-medium hidden md:block">
                Out of stock
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Product Info Accordion */}
      <div className="mt-10 space-y-4">
        {/* Description Tab */}
        <div id="description-section" className="border rounded-lg bg-white overflow-hidden scroll-mt-24">
          <button
            type="button"
            onClick={() => setDescriptionOpen(o => !o)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors ${descriptionOpen ? 'bg-primary/10 text-primary' : ''}`}
            aria-expanded={descriptionOpen}
          >
            <span>Description</span>
            <svg
              className={`w-4 h-4 transition-transform ${descriptionOpen ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {descriptionOpen && (
            <div className="px-4 pb-5 pt-4">
              {product.description ? (
                <div
                  className="prose prose-sm md:prose-base max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: product.description
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No detailed description available.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Reviews Tab */}
        <div id="reviews-section" className="border rounded-lg bg-white overflow-hidden scroll-mt-24">
          <button
            type="button"
            onClick={() => setReviewsOpen(o => !o)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors ${reviewsOpen ? 'bg-primary/10 text-primary' : ''}`}
            aria-expanded={reviewsOpen}
          >
            <span>
              Reviews {totalReviews ? `(${totalReviews})` : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalReviews > 0 && avgRating.toFixed(1)}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${reviewsOpen ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {reviewsOpen && (
            <div className="px-4 pb-5 pt-4 space-y-6">
              {/* Review Summary and Add Button */}
              <div className="flex justify-between items-center p-4 border rounded-md bg-gray-50/50">
                <div>
                  <div className="text-sm font-medium">
                    Total Reviews: <span className="font-bold text-primary">{totalReviews}</span>
                  </div>
                  <div className="text-sm font-medium">
                    Average Rating:{" "}
                    <span className="font-bold text-primary">
                      {totalReviews > 0 ? `${avgRating.toFixed(1)} / 5` : "N/A"}
                    </span>
                  </div>
                </div>
                <div>
                  <Button onClick={() => setReviewModalOpen(true)} size="sm">
                    Add a Review
                  </Button>
                </div>
              </div>

              {/* Existing reviews */}
              {loadingReviews && (
                <p className="text-sm text-muted-foreground">
                  Loading reviews...
                </p>
              )}
              {!loadingReviews && reviews.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No reviews yet.
                </p>
              )}
              {!loadingReviews && reviews.length > 0 && (
                <ul className="space-y-4">
                  {reviews.map((r: any, i: number) => (
                    <li
                      key={r.id || i}
                      className={`border rounded-md p-4 text-sm bg-white ${r.pending ? "opacity-75" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {r.author_name || r.author || "Customer"}
                          </span>
                          {r.verified && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold">
                              Verified
                            </span>
                          )}
                          {r.pending && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, s) => (
                          <svg
                            key={s}
                            className="w-4 h-4"
                            viewBox="0 0 20 20"
                            fill={(r.rating || 0) > s ? "#f59e0b" : "#d1d5db"}
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 0 0 .95.69h4.175c.97 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 0 0-.364 1.118l1.287 3.966c.3.922-.756 1.688-1.54 1.118l-3.38-2.454a1 1 0 0 0-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 0 0-.364-1.118L2.04 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 0 0 .95-.69l1.286-3.967Z" />
                          </svg>
                        ))}
                      </div>
                      {/* Content: plugin gives HTML string in r.content; old code expected r.content.rendered */}
                      <div className="text-muted-foreground leading-relaxed">
                        {typeof r.content === "string" ? (
                          <div
                            className="prose prose-xs max-w-none"
                            dangerouslySetInnerHTML={{ __html: r.content }}
                          />
                        ) : r.content?.rendered ? (
                          <div
                            className="prose prose-xs max-w-none"
                            dangerouslySetInnerHTML={{ __html: r.content.rendered }}
                          />
                        ) : null}
                      </div>
                      {/* Review Images */}
                      {r.images && r.images.length > 0 && (
                        <div className="mt-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {r.images.map((imgSrc: string, imgIdx: number) => (
                              <div key={imgIdx} className="relative group">
                                <img
                                  src={imgSrc}
                                  alt={`Review image ${imgIdx + 1}`}
                                  className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                  width={80}
                                  height={80}
                                  decoding="async"
                                  onClick={() => {
                                    setReviewLightbox({ images: r.images, index: imgIdx });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>        {/* FAQs Tab - Only show if FAQs exist */}
        {(!loadingFaqs && faqs.length > 0) || loadingFaqs ? (
          <div id="faqs-section" className="border rounded-lg bg-white overflow-hidden scroll-mt-24">
            <button
              type="button"
              onClick={() => toggleTab("faqs")}
              className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors ${openTabs.faqs ? 'bg-primary/10 text-primary' : ''}`}
              aria-expanded={openTabs.faqs}
            >
              <span>Product FAQs {faqs.length ? `(${faqs.length})` : ""}</span>
              <svg
                className={`w-4 h-4 transition-transform ${
                  openTabs.faqs ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {openTabs.faqs && (
              <div className="px-4 pb-5 pt-4 space-y-4">
                {loadingFaqs && (
                  <p className="text-sm text-muted-foreground">
                    Loading FAQs...
                  </p>
                )}
                {!loadingFaqs && faqs.length > 0 && (
                  <div className="divide-y border rounded-md bg-white/50">
                    {faqs.map((f, i) => {
                      const open = faqOpenIndex === i;
                      return (
                        <div key={i}>
                          <button
                            type="button"
                            onClick={() =>
                              setFaqOpenIndex(open ? -1 : i)
                            }
                            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/40"
                            aria-expanded={open}
                          >
                            <span>{f.question}</span>
                            <svg
                              className={`w-4 h-4 transition-transform ${
                                open ? "rotate-180" : ""
                              }`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                          {open && (
                            <div className="px-3 pb-3 text-sm text-muted-foreground">
                              {f.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom menu (mobile only - fixed at bottom) */}
      <ProductBottomMenu
        product={product}
        selectedVariation={selectedVariation}
        selectedVariationId={selectedVariationId}
        quantity={quantity}
        disabled={product.stock_status !== "instock"}
        disabledMessage={
          product.stock_status !== "instock"
            ? "Out of stock"
            : ""
        }
        currentQuantity={
          // Calculate current quantity in cart for this product (and variation if applicable)
          useCartStore.getState().items.reduce((sum, item) => {
            if (product.type === "variable") {
              // If a variation is selected, match by variation id
              if (selectedVariationId != null) {
                return item.product.id === product.id && item.variation?.id === selectedVariationId
                  ? sum + item.quantity
                  : sum;
              }
              // If no variation selected, sum all variations of this product
              return item.product.id === product.id ? sum + item.quantity : sum;
            }
            // Simple product
            return item.product.id === product.id ? sum + item.quantity : sum;
          }, 0)
        }
        variationNotSelected={product.type === "variable" && !selectedVariationId}
        onScrollToVariations={scrollToVariations}
      />

      {/* Review Form Popup */}
      {reviewPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4 relative animate-in fade-in-0 zoom-in-95"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-popup-title"
          >
            <button
              type="button"
              onClick={() => setReviewPopupOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <form
              onSubmit={submitReview}
              className="space-y-4"
              noValidate

            >
              <h3 id="review-popup-title" className="text-lg font-semibold">
                Write a Review
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Your Rating:</span>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleReviewField("rating", n)}
                    className="focus:outline-none"
                    aria-label={`Rate ${n}`}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="w-6 h-6 transition-colors"
                      fill={
                        reviewForm.rating >= n ? "#f59e0b" : "#d1d5db"
                      }
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 0 0 .95.69h4.175c.97 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 0 0-.364 1.118l1.287 3.966c.3.922-.756 1.688-1.54 1.118l-3.38-2.454a1 1 0 0 0-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 0 0-.364-1.118L2.04 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 0 0 .95-.69l1.286-3.967Z" />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  placeholder="Name *"
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={reviewForm.name}
                  onChange={e =>
                    handleReviewField("name", e.target.value)
                  }
                  required
                />
                <input
                  type="email"
                  placeholder="Email *"
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={reviewForm.email}
                  onChange={e =>
                    handleReviewField("email", e.target.value)
                  }
                  required
                />
              </div>
              <textarea
                placeholder="Your review (min 6 chars) *"
                className="w-full border rounded px-3 py-2 text-sm resize-vertical min-h-[110px]"
                value={reviewForm.comment}
                onChange={e =>
                  handleReviewField("comment", e.target.value)
                }
                required
              />
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={!canSubmitReview || submittingReview}
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal with Image Uploads */}
      {reviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6 relative">
            <button
              onClick={() => setReviewModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-primary"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-4">Add Review</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Name *</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={revForm.name}
                  onChange={e => setRevForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email *</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={revForm.email}
                  onChange={e => setRevForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Rating *</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRevForm(f => ({ ...f, rating: st }))}
                      className={`w-8 h-8 flex items-center justify-center rounded border ${
                        revForm.rating >= st
                          ? "bg-yellow-400 text-white border-yellow-400"
                          : "border-gray-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Review *</label>
                <textarea
                  rows={4}
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={revForm.review}
                  onChange={e => setRevForm(f => ({ ...f, review: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Photos (up to 6) - Max 10MB each
                </label>
                <div
                  className="border-2 border-dashed rounded p-4 text-center cursor-pointer hover:border-primary transition"
                  onClick={() => document.getElementById("revImagesInput")?.click()}
                >
                  <p className="text-xs text-muted-foreground">
                    Click or drag images here (JPG/PNG/WebP only)
                  </p>
                  {revForm.images.length > 0 && (
                    <p className="text-xs text-primary font-medium mt-1">
                      {revForm.images.length} image{revForm.images.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                  <input
                    id="revImagesInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={e => handleImagesSelected(e.target.files)}
                  />
                </div>
                {revForm.previews.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {revForm.previews.map((src, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={src}
                          alt=""
                          className="w-full h-20 object-cover rounded border"
                          loading="lazy"
                          width={200}
                          height={80}
                          decoding="async"
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-[10px] opacity-0 group-hover:opacity-100 transition"
                          onClick={() => removePreview(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                {revForm.uploading && (
                  <div className="flex-1 mr-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${revForm.uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Processing images... {revForm.uploadProgress}%
                    </p>
                  </div>
                )}
                <Button variant="secondary" onClick={() => setReviewModalOpen(false)} disabled={revForm.uploading}>
                  Cancel
                </Button>
                <Button onClick={submitReviewWithImages} disabled={revForm.uploading || !revForm.name.trim() || !revForm.email.trim() || !revForm.review.trim()}>
                  {revForm.uploading ? "Submitting..." : "Submit"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted reviews require admin approval before appearing publicly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Image Lightbox */}
      {reviewLightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            {/* Close button */}
            <button
              onClick={() => setReviewLightbox(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-2xl font-bold"
              aria-label="Close lightbox"
            >
              ×
            </button>

            {/* Main image */}
            <div className="relative">
              <img
                src={reviewLightbox.images[reviewLightbox.index]}
                alt={`Review image ${reviewLightbox.index + 1}`}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                decoding="async"
              />

              {/* Navigation arrows */}
              {reviewLightbox.images.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      const newIndex = reviewLightbox.index > 0 ? reviewLightbox.index - 1 : reviewLightbox.images.length - 1;
                      setReviewLightbox({ ...reviewLightbox, index: newIndex });
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => {
                      const newIndex = reviewLightbox.index < reviewLightbox.images.length - 1 ? reviewLightbox.index + 1 : 0;
                      setReviewLightbox({ ...reviewLightbox, index: newIndex });
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Image counter */}
              {reviewLightbox.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  {reviewLightbox.index + 1} / {reviewLightbox.images.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {reviewLightbox.images.length > 1 && (
              <div className="mt-4 flex justify-center gap-2 overflow-x-auto max-w-full">
                {reviewLightbox.images.map((imgSrc, idx) => (
                  <button
                    key={idx}
                    onClick={() => setReviewLightbox({ ...reviewLightbox, index: idx })}
                    className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                      idx === reviewLightbox.index ? 'border-white' : 'border-gray-500'
                    }`}
                  >
                    <img
                      src={imgSrc}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      width={100}
                      height={100}
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
});

ProductCollectionLayout.displayName = "ProductCollectionLayout";

export default ProductCollectionLayout;
