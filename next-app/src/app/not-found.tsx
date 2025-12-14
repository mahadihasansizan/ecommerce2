import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Home, Search, ArrowLeft } from 'lucide-react';
import { getSiteName } from '@/lib/tenant-config';
import { getSiteUrl } from '@/lib/utils';
import { generateWebsiteSchema, generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/schema-generator';

export const metadata: Metadata = {
  title: '404 Not Found',
  description: 'The page you are looking for does not exist. Return home to continue browsing.',
  robots: 'noindex',
};

const NotFoundPage = () => {
  const siteUrl = getSiteUrl();
  const siteName = getSiteName();
  const structuredData = [
    generateWebsiteSchema(),
    generateOrganizationSchema(),
    generateBreadcrumbSchema([
      { name: 'Home', url: siteUrl },
      { name: '404', url: `${siteUrl}/404` },
    ]),
  ];

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="text-7xl font-bold tracking-[0.2em] text-primary/20 select-none">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-16 h-16 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Page Not Found</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              The page you are trying to reach does not exist on {siteName}. Try visiting our homepage or browse the product catalog.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/products" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Browse products
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
};

export default NotFoundPage;
