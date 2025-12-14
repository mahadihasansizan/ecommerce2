'use client';

import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, HomeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { gsap } from 'gsap';
import { deferStateUpdate } from '@/lib/utils';

/**
 * Native Browser Bar Component
 * Provides standard browser-like header and footer for Capacitor native apps
 * Includes back/forward navigation, home button, and refresh
 */
const NativeBrowserBar = () => {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) return;

    // Animate header and footer in
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { y: -60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }
      );
    }
    if (footerRef.current) {
      gsap.fromTo(
        footerRef.current,
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;

    const updateNavigationState = () => {
      setCanGoBack(window.history.length > 1);
      setCanGoForward(false);
      setCurrentUrl(window.location.pathname);
    };

    deferStateUpdate(updateNavigationState);

    const handlePopState = () => {
      setCanGoBack(window.history.length > 1);
      setCurrentUrl(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isNative, pathname]);

  const handleBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleForward = () => {
    router.forward();
  };

  const handleHome = () => {
    router.push('/');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!isNative) return null;

  return (
    <>
      {/* Top Browser Bar */}
      <div
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-[20] bg-white border-b border-gray-200 safe-area-top"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-12">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={handleForward}
              disabled={!canGoForward}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Go forward"
            >
              <ArrowRightIcon className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={handleHome}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Go to home"
            >
              <HomeIcon className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Refresh page"
            >
              <ArrowPathIcon className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* URL Display */}
          <div className="flex-1 mx-4 min-w-0">
            <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-600 truncate">
              {currentUrl || '/'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Browser Bar */}
      <div
        ref={footerRef}
        className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-200 safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-4 h-14">
          <button
            onClick={handleBack}
            disabled={!canGoBack}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
            <span className="text-xs text-gray-600">Back</span>
          </button>
          <button
            onClick={handleHome}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Go to home"
          >
            <HomeIcon className="w-6 h-6 text-gray-700" />
            <span className="text-xs text-gray-600">Home</span>
          </button>
          <button
            onClick={handleRefresh}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Refresh page"
          >
            <ArrowPathIcon className="w-6 h-6 text-gray-700" />
            <span className="text-xs text-gray-600">Refresh</span>
          </button>
        </div>
      </div>

      {/* Spacers to prevent content overlap */}
      <div className="h-12 safe-area-top" style={{ paddingTop: 'env(safe-area-inset-top)' }} />
      <div className="h-14 safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </>
  );
};

export default NativeBrowserBar;
