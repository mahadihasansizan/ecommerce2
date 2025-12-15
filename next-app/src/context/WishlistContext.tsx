'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { WP_PROXY_BASE_URL } from '@/lib/config';

type WishlistContextType = {
    wishlist: number[];
    addToWishlist: (productId: number) => Promise<void>;
    removeFromWishlist: (productId: number) => Promise<void>;
    isInWishlist: (productId: number) => boolean;
    isLoading: boolean;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'kh-wishlist-guest';

export function WishlistProvider({ children }: { children: ReactNode }) {
    const { session, isAuthenticated } = useAuth();
    const [wishlist, setWishlist] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load initial wishlist
    useEffect(() => {
        if (isAuthenticated && session?.customerId) {
            fetchRemoteWishlist(session.customerId);
        } else {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    setWishlist(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse guest wishlist', e);
                }
            }
        }
    }, [isAuthenticated, session?.customerId]);

    // Sync guest wishlist to local storage
    useEffect(() => {
        if (!isAuthenticated) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
        }
    }, [wishlist, isAuthenticated]);

    const fetchRemoteWishlist = async (userId: number) => {
        setIsLoading(true);
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            const secret = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET;
            if (secret) headers['X-HPM-Secret'] = secret;

            const res = await fetch(`${WP_PROXY_BASE_URL}/wishlist?user_id=${userId}`, {
                headers,
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setWishlist(data.map(Number));
                }
            }
        } catch (error) {
            console.error('Failed to fetch wishlist', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addToWishlist = async (productId: number) => {
        if (wishlist.includes(productId)) return;

        const newWishlist = [...wishlist, productId];
        setWishlist(newWishlist);

        if (isAuthenticated && session?.customerId) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                const secret = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET;
                if (secret) headers['X-HPM-Secret'] = secret;

                await fetch(`${WP_PROXY_BASE_URL}/wishlist/add`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: session.customerId,
                        product_id: productId,
                    }),
                });
            } catch (error) {
                console.error('Failed to add to remote wishlist', error);
                // Revert on error? For now, keep optimistic UI
            }
        }
    };

    const removeFromWishlist = async (productId: number) => {
        const newWishlist = wishlist.filter((id) => id !== productId);
        setWishlist(newWishlist);

        if (isAuthenticated && session?.customerId) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                const secret = process.env.NEXT_PUBLIC_WP_ORDER_PROXY_SECRET;
                if (secret) headers['X-HPM-Secret'] = secret;

                await fetch(`${WP_PROXY_BASE_URL}/wishlist/remove`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: session.customerId,
                        product_id: productId,
                    }),
                });
            } catch (error) {
                console.error('Failed to remove from remote wishlist', error);
            }
        }
    };

    const isInWishlist = (productId: number) => wishlist.includes(productId);

    return (
        <WishlistContext.Provider
            value={{ wishlist, addToWishlist, removeFromWishlist, isInWishlist, isLoading }}
        >
            {children}
        </WishlistContext.Provider>
    );
}

export function useWishlist() {
    const context = useContext(WishlistContext);
    if (context === undefined) {
        throw new Error('useWishlist must be used within a WishlistProvider');
    }
    return context;
}
