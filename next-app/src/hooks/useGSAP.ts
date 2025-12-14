import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Custom hook for GSAP animations
 */
export const useGSAP = (
  animationFn: (ctx: gsap.Context) => void | gsap.core.Tween | gsap.core.Timeline,
  dependencies: React.DependencyList = []
) => {
  const scopeRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (!scopeRef.current) return;

    // Create GSAP context
    ctxRef.current = gsap.context(() => {
      animationFn(ctxRef.current!);
    }, scopeRef.current);

    // Cleanup
    return () => {
      if (ctxRef.current) {
        ctxRef.current.revert();
      }
    };
  }, dependencies);

  return scopeRef;
};

/**
 * Hook for scroll-triggered animations
 */
export const useScrollAnimation = (
  elementRef: React.RefObject<HTMLElement>,
  animation: 'fadeIn' | 'slideUp' | 'slideDown' = 'fadeIn',
  start = 'top 80%'
) => {
  useEffect(() => {
    if (!elementRef.current) return;

    const animations = {
      fadeIn: { opacity: 0 },
      slideUp: { y: 60, opacity: 0 },
      slideDown: { y: -60, opacity: 0 },
    };

    const toProps = {
      fadeIn: { opacity: 1 },
      slideUp: { y: 0, opacity: 1 },
      slideDown: { y: 0, opacity: 1 },
    };

    const anim = gsap.fromTo(
      elementRef.current,
      animations[animation],
      {
        ...toProps[animation],
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: elementRef.current,
          start,
          toggleActions: 'play none none reverse',
        },
      }
    );

    return () => {
      anim.kill();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger === elementRef.current) {
          trigger.kill();
        }
      });
    };
  }, [elementRef, animation, start]);
};

