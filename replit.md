# Next.js E-Commerce Application

## Overview
This is a Next.js 16 e-commerce frontend application with React 19, designed to work as a headless frontend for a WordPress/WooCommerce backend.

## Project Structure
- `/next-app` - Main Next.js application
  - `/src/app` - App router pages
  - `/src/components` - Reusable UI components
  - `/src/context` - React context providers (Auth, Cart)
  - `/src/hooks` - Custom React hooks
  - `/src/lib` - Utility functions and configurations
  - `/src/services` - API service functions
  - `/src/store` - Zustand stores (cart, wishlist)

## Tech Stack
- **Framework**: Next.js 16 with Turbopack
- **UI**: React 19, Tailwind CSS, Radix UI components
- **State Management**: Zustand, React Query
- **Styling**: Tailwind CSS with shadcn/ui components
- **Mobile**: Capacitor for native mobile builds

## Running the Application
```bash
cd next-app && npm run dev
```

The development server runs on port 5000.

## Environment Variables
- `NEXT_PUBLIC_SITE_URL` - Site URL for the application
- `NEXT_PUBLIC_WORDPRESS_BASE_URL` - WordPress base URL
- `NEXT_PUBLIC_WP_PROXY_BASE_URL` - WordPress headless proxy base URL
- `NEXT_PUBLIC_WP_ORDER_PROXY_URL` - Order creation proxy URL
- `NEXT_PUBLIC_WP_ORDER_PROXY_SECRET` - Order proxy secret
- `NEXT_PUBLIC_WC_API_URL` - WooCommerce API URL
- `NEXT_PUBLIC_WC_CONSUMER_KEY` - WooCommerce consumer key
- `NEXT_PUBLIC_WC_CONSUMER_SECRET` - WooCommerce consumer secret
- `NEXT_PUBLIC_GREENWEB_SMS_TOKEN` - SMS token for notifications

## Notes
- This is a headless frontend - requires WordPress/WooCommerce backend configuration
- Uses legacy-peer-deps for npm install due to React 19 compatibility
