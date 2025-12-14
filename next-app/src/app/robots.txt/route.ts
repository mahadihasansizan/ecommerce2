import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/utils';

export function GET() {
  const siteUrl = getSiteUrl();
  const contentLines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /account',
    'Disallow: /orders',
    'Disallow: /wishlist',
    'Disallow: /search',
    'Disallow: /wp-admin/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ];
  return new NextResponse(contentLines.join('\n'), {
    headers: { 'Content-Type': 'text/plain' },
  });
}
