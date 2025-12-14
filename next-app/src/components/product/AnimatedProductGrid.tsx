import { useEffect, useRef, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface AnimatedProductGridProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
}

/**
 * Wrapper component that adds stagger animations to product grids
 */
const AnimatedProductGrid = ({ children, className = '', stagger = 0.1 }: AnimatedProductGridProps) => {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;

    const cards = gridRef.current.children;

    // Animate each card with stagger
    gsap.fromTo(
      cards,
      { opacity: 0, y: 50, scale: 0.9 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, [children, stagger]);

  return (
    <div ref={gridRef} className={className}>
      {children}
    </div>
  );
};

export default AnimatedProductGrid;

