'use client';

import React, { useState, useEffect, useRef } from 'react'; // Removed Suspense as it's no longer needed
import Link from 'next/link';
import { Facebook, Instagram, Twitter, MessageCircle, Mail, Phone, MapPin } from 'lucide-react';
import { getCategories, WooCategory } from '@/lib/woocommerce'; // Added import for fetching categories
import { decodeHtmlEntities } from '@/lib/utils';
import { toast } from 'sonner'; // Added for thank you popup
import { WP_BASE_URL } from '@/lib/config';
import { Capacitor } from '@capacitor/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getContactEmail, getSocialUrls } from '@/lib/tenant-config';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [phone, setPhone] = useState(''); // State for phone input
  const [isSubmitting, setIsSubmitting] = useState(false); // State for submission loading
  const footerRef = useRef<HTMLElement>(null);

  // Animate footer on scroll into view
  useEffect(() => {
    if (!footerRef.current) return;

    gsap.fromTo(
      footerRef.current,
      { opacity: 0, y: 50 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  }, []);

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        // Fallback to empty array if fetch fails
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Handle phone subscription submission
  const handlePhoneSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Please enter a valid phone number.');
      return;
    }
    // Basic phone validation (adjust regex as needed for Bangladesh numbers)
    const phoneRegex = /^(\+880|880|0)?[1-9]\d{8,9}$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Please enter a valid phone number (e.g., +8801234567890).');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${WP_BASE_URL}/wp-json/kitchenhero/v1/phone-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone }),
      });
      if (response.ok) {
        toast.success('Thank you for subscribing! We\'ll keep you updated.');
        setPhone(''); // Clear input
      } else {
        toast.error('Failed to subscribe. Please try again.');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNative = Capacitor.isNativePlatform();
  return (
    <footer ref={footerRef} className={`bg-white border-t border-border min-h-[400px] ${isNative ? 'safe-area-bottom safe-area-x' : ''}`} style={{ contain: 'layout style paint' }}>
  <div className="container mx-auto px-4 py-4 text-left">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center">
              <img
                src={`${WP_BASE_URL}/wp-content/uploads/2025/08/Kitchenhero-logo.png`}
                alt="Logo"
                className="w-40"
                loading="lazy"
              />
            </Link>
            <p className="text-muted-foreground text-sm">
              Best Kitchen Items in Bangladesh
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground flex items-center">
                <Mail className="w-4 h-4 mr-2" aria-label="Email" />
                {getContactEmail()}
              </p>
              <p className="text-muted-foreground flex items-center">
                <Phone className="w-4 h-4 mr-2" aria-label="Phone" />
                <a
                  href="https://wa.me/8801835868877"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  01835868877
                </a>
              </p>
              <p className="text-muted-foreground flex items-center">
                <MapPin className="w-4 h-4 mr-2" aria-label="Location" />
                Dhaka, Bangladesh
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-foreground">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link 
                  href="/" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  href="/products" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  All Products
                </Link>
              </li>
              <li>
                <Link 
                  href="/categories" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link 
                  href="/faqs" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories (Fetched from Backend) */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-foreground">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                  <Link 
                    href="/categories" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  All Categories
                </Link>
              </li>
              {loadingCategories ? (
                <li className="text-muted-foreground">Loading categories...</li>
              ) : (
                categories.map((category) => (
                  <li key={category.id}>
                    <Link 
                      href={`/products?category=${category.slug}`} 
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {decodeHtmlEntities(category.name)}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Phone Subscription */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-foreground">Stay Updated</h4>
            <p className="text-muted-foreground text-sm">
              Subscribe with your phone to get special offers, new arrivals, and kitchen essentials!
            </p>
            <form onSubmit={handlePhoneSubscription} className="space-y-4">
              <input
                type="tel"
                placeholder="Phone number (e.g., +8801234567)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white font-medium py-2 px-4 rounded-md text-sm hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>

            {/* Social Media Links */}
            <div className="pt-4">
              <p className="text-muted-foreground text-sm mb-3">Follow us on social media:</p>
              <div className="flex items-center gap-4">
                <a
                  href={getSocialUrls().facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Follow us on Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a
                  href={getSocialUrls().instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Follow us on Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-muted-foreground text-sm">
            © {currentYear} kitchenhero. All rights reserved. | Designed with ❤️ by <a href="https://msdigitalsolution.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">msdigitalsolution.</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
