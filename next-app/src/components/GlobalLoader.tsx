'use client';

import React, { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from 'gsap';

const LoadingScreen = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !logoRef.current || !textRef.current) return;

    // Animate logo entrance
    gsap.fromTo(
      logoRef.current,
      { scale: 0, opacity: 0, rotation: -180 },
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 1,
        ease: 'back.out(1.7)',
      }
    );

    // Animate text entrance
    gsap.fromTo(
      textRef.current,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        delay: 0.3,
        ease: 'power3.out',
      }
    );

    // Continuous pulse animation for logo
    gsap.to(logoRef.current, {
      scale: 1.1,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
      delay: 1,
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center min-h-screen bg-white"
    >
    <div ref={logoRef} className="w-[200px] h-[200px] md:w-[300px] md:h-[300px] mb-6 flex items-center justify-center">
      <div className="w-20 h-20 md:w-24 md:h-24 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
      <div ref={textRef} className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">KitchenHero</h2>
        <p className="text-gray-600 text-sm md:text-base">Loading your favorite products...</p>
      </div>
    </div>
  );
};

const GlobalLoader = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const prevPathnameRef = useRef<string>(pathname);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    // Skip on initial mount to avoid showing loader on first page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPathnameRef.current = pathname;
      setLoading(false); // Ensure loading is false on initial mount
      return;
    }

    const currentPath = pathname;
    
    // Only trigger if pathname actually changed
    if (currentPath !== prevPathnameRef.current) {
      setLoading(true);
      prevPathnameRef.current = currentPath;
      
      // Clear any existing timers
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
      
      // Wait for DOM to be ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Wait for images to load
          const images = Array.from(document.querySelectorAll('img[src]')) as HTMLImageElement[];
          const totalImages = images.length;
          let imagesLoaded = 0;
          let hasSetTimer = false;

          const hideLoader = () => {
            if (!hasSetTimer) {
              hasSetTimer = true;
              timerRef.current = setTimeout(() => {
                setLoading(false);
                if (maxTimerRef.current) {
                  clearTimeout(maxTimerRef.current);
                  maxTimerRef.current = null;
                }
              }, 300);
            }
          };

          if (totalImages === 0) {
            // No images, hide after minimum time
            timerRef.current = setTimeout(() => {
              setLoading(false);
            }, 600);
          } else {
            // Check each image
            images.forEach((img) => {
              if (img.complete) {
                imagesLoaded++;
              } else {
                img.onload = () => {
                  imagesLoaded++;
                  if (imagesLoaded >= totalImages) {
                    hideLoader();
                  }
                };
                img.onerror = () => {
                  imagesLoaded++;
                  if (imagesLoaded >= totalImages) {
                    hideLoader();
                  }
                };
              }
            });

            // If all images are already loaded
            if (imagesLoaded >= totalImages) {
              hideLoader();
            }
          }

          // Maximum timeout to ensure loader ALWAYS hides (safety net - 2.5 seconds)
          maxTimerRef.current = setTimeout(() => {
            setLoading(false);
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }, 2500);
        });
      });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
    };
  }, [pathname]);

  if (loading) return <LoadingScreen />;
  return <>{children}</>;
};

export default GlobalLoader;
