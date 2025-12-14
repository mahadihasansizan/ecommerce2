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
- `NEXT_PUBLIC_SITE_URL` - Site URL for the application (optional, uses fallback)
- Backend API configuration required for full functionality

## Notes
- This is a headless frontend - requires WordPress/WooCommerce backend configuration
- Uses legacy-peer-deps for npm install due to React 19 compatibility
