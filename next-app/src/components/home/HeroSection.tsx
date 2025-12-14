'use client';

import Link from 'next/link';
import { WP_BASE_URL } from '@/lib/config';
import { useSiteName } from '@/hooks/useSiteInfo';

const HeroSection = () => {
  const siteName = useSiteName();
  return (
    <section className="relative">
      <div className="relative w-full mx-auto rounded-2xl overflow-hidden aspect-[14/5]">
        <Link
          href="/products"
          aria-label="Shop now"
          className="group block w-full h-full"
        >
          <img
            src={`${WP_BASE_URL}/wp-content/uploads/2025/08/Kitchenhero-banner-1400-x-500-px.jpg`}
            alt={`${siteName} banner`}
            className="w-full h-full object-cover transition-transform duration-700"
          />
          <span className="sr-only">Go to shop page</span>
        </Link>
      </div>
    </section>
  );
};

export default HeroSection;
