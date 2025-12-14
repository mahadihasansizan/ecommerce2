import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Common GSAP animation utilities for smooth, performant animations
 */

// Fade in animation
export const fadeIn = (element: HTMLElement | string, duration = 0.6, delay = 0) => {
  return gsap.fromTo(
    element,
    { opacity: 0 },
    { opacity: 1, duration, delay, ease: 'power2.out' }
  );
};

// Slide up animation
export const slideUp = (element: HTMLElement | string, duration = 0.6, delay = 0) => {
  return gsap.fromTo(
    element,
    { y: 50, opacity: 0 },
    { y: 0, opacity: 1, duration, delay, ease: 'power3.out' }
  );
};

// Slide down animation
export const slideDown = (element: HTMLElement | string, duration = 0.6, delay = 0) => {
  return gsap.fromTo(
    element,
    { y: -50, opacity: 0 },
    { y: 0, opacity: 1, duration, delay, ease: 'power3.out' }
  );
};

// Scale in animation
export const scaleIn = (element: HTMLElement | string, duration = 0.5, delay = 0) => {
  return gsap.fromTo(
    element,
    { scale: 0.8, opacity: 0 },
    { scale: 1, opacity: 1, duration, delay, ease: 'back.out(1.7)' }
  );
};

// Stagger children animation
export const staggerChildren = (
  parent: HTMLElement | string,
  childSelector: string,
  animation: 'fadeIn' | 'slideUp' | 'scaleIn' = 'fadeIn',
  stagger = 0.1
) => {
  const animations = {
    fadeIn: { opacity: 0 },
    slideUp: { y: 30, opacity: 0 },
    scaleIn: { scale: 0.9, opacity: 0 },
  };

  const toProps = {
    fadeIn: { opacity: 1 },
    slideUp: { y: 0, opacity: 1 },
    scaleIn: { scale: 1, opacity: 1 },
  };

  return gsap.fromTo(
    `${parent} ${childSelector}`,
    animations[animation],
    {
      ...toProps[animation],
      duration: 0.6,
      stagger,
      ease: 'power2.out',
    }
  );
};

// Scroll-triggered animation
export const scrollReveal = (
  element: HTMLElement | string,
  animation: 'fadeIn' | 'slideUp' | 'slideDown' = 'fadeIn',
  trigger = element
) => {
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

  return gsap.fromTo(
    element,
    animations[animation],
    {
      ...toProps[animation],
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: trigger,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse',
      },
    }
  );
};

// Hover scale animation
export const hoverScale = (element: HTMLElement | string, scale = 1.05) => {
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;

  el.addEventListener('mouseenter', () => {
    gsap.to(element, { scale, duration: 0.3, ease: 'power2.out' });
  });

  el.addEventListener('mouseleave', () => {
    gsap.to(element, { scale: 1, duration: 0.3, ease: 'power2.out' });
  });
};

// Page transition animation
export const pageTransition = {
  enter: (element: HTMLElement | string) => {
    return gsap.fromTo(
      element,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
    );
  },
  exit: (element: HTMLElement | string) => {
    return gsap.to(element, {
      opacity: 0,
      y: -20,
      duration: 0.3,
      ease: 'power2.in',
    });
  },
};

// Smooth scroll to element
export const smoothScrollTo = (element: HTMLElement | string, offset = 0) => {
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;

  gsap.to(window, {
    duration: 1,
    scrollTo: { y: el, offsetY: offset },
    ease: 'power2.inOut',
  });
};

// Cleanup function for animations
export const cleanupAnimations = (animations: gsap.core.Tween[]) => {
  animations.forEach((anim) => anim.kill());
};

