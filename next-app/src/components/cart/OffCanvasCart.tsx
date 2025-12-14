'use client';

import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { getCurrencySymbolSync } from '@/lib/utils';

const OffCanvasCart = () => {
  const {
    items, isOpen, closeCart, updateQuantity, removeFromCart,
    getTotalPrice, showAddBanner, hideAddBanner,
    applyCoupon, removeCoupon,
    couponCode, couponDiscount, couponApplied, couponLoading, couponError
  } = useCartStore() as any;


  // Inline notifications (similar style to add banner)
  interface Notice { id: number; message: string; variant?: 'success' | 'error'; }
  const [notices, setNotices] = useState<Notice[]>([]);
  const pushNotice = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setNotices(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setNotices(prev => prev.filter(n => n.id !== id));
    }, 2500);
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    const item = items.find((it: any) => it.id === id);
    if (!item) return;
    if (newQty <= 0) {
      removeFromCart(id);
      pushNotice('Product removed', 'success');
      return;
    }
    updateQuantity(id, newQty);
    pushNotice('Quantity updated');
  };

  const handleRemove = (id: string) => {
    removeFromCart(id);
    pushNotice('Product removed');
  };
  const handleCheckout = () => {
    closeCart();
    // Force page reload for GA tracking instead of SPA navigation
    window.location.href = '/checkout';
  };

  const formatPrice = (price: number) => {
    const symbol = getCurrencySymbolSync();
    if (isNaN(price) || price === null || price === undefined) {
      return `${symbol}0.00`;
    }
    return `${symbol}${price.toFixed(2)}`;
  };
  // REMOVE local coupon state & logic; use store instead

  const handleApplyCoupon = async () => {
    try {
      await applyCoupon(localCouponInput.trim());
      pushNotice('Coupon applied');
    } catch (e: any) {
      pushNotice(e?.message || 'Invalid coupon', 'error');
    } finally {
      setLocalCouponInput('');
    }
  };

  // Local input field only (not stored globally until applied)
  const [localCouponInput, setLocalCouponInput] = useState('');

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-[999999]" 
        onClose={closeCart}
        static={false}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-[999999]"
            onClick={closeCart}
          />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden z-[999999]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10 z-[999999]">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300 sm:duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300 sm:duration-500"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-[80vw] max-w-md z-[999999]">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-6 sm:px-6 bg-gradient-primary text-white">
                      <Dialog.Title className="text-lg font-medium">Shopping Cart</Dialog.Title>
                      <button
                        type="button"
                        className="text-white hover:text-gray-200 transition-colors"
                        onClick={closeCart}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                      {items.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">🛒</div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
                          <p className="text-gray-500 mb-4">Add some awesome T-shirts to get started!</p>
                          <Button onClick={closeCart} className="btn-anime">
                            Continue Shopping
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Stacked transient notices */}
                          {notices.length > 0 && (
                            <div className="mb-4 space-y-2">
                              {notices.map(n => (
                                <div
                                  key={n.id}
                                  className={`rounded-md border px-4 py-2 text-xs font-medium shadow-sm flex items-center justify-between ${n.variant === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}
                                >
                                  <span>{n.message}</span>
                                  <button
                                    type="button"
                                    className="ml-3 text-current hover:opacity-70"
                                    aria-label="Dismiss"
                                    onClick={() => setNotices(prev => prev.filter(x => x.id !== n.id))}
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {showAddBanner && (
                            <div className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-sm flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">Product has been added to the cart</p>
                               
                              </div>
                              <button
                                type="button"
                                aria-label="Dismiss"
                                onClick={hideAddBanner}
                                className="ml-auto text-green-700 hover:text-green-900"
                              >
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                          <div className="space-y-6">
                          {items.map((item) => (
                            <div key={item.id} className="flex space-x-4 p-4 bg-muted/30 rounded-lg">
                              {/* Product Image */}
                              <div className="flex-shrink-0">
                                <img
                                  src={item.image || '/placeholder.svg'}
                                  alt={item.name}
                                  className="h-16 w-16 rounded-md object-cover"
                                  loading="lazy"
                                  width={64}
                                  height={64}
                                  decoding="async"
                                />
                              </div>

                              {/* Info and Actions */}
                              <div className="flex-1 min-w-0 flex flex-col">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {item.name}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    {formatPrice(item.price)}
                                  </p>
                                  {item.attributes && (
                                    <div className="mt-1 text-xs text-gray-400">
                                      {Object.entries(item.attributes).map(([key, value]) => (
                                        <span key={key} className="mr-2">
                                          {key}: {String(value)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Quantity Controls & Remove */}
                                <div className="flex items-center space-x-2 mt-3">
                                  <button
                                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                    className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                                  >
                                    <MinusIcon className="h-4 w-4" />
                                  </button>
                                  <span className="text-sm font-medium w-8 text-center">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                    className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemove(item.id)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <XMarkIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    {items.length > 0 && (
                      <>
                        {/* Coupon Section */}
                        <div className="px-4 py-4 sm:px-6">
                          <h3 className="text-sm font-medium text-gray-900">Have a coupon?</h3>
                          {!couponApplied ? (
                            <div className="mt-2 flex items-stretch gap-2">
                              <input
                                type="text"
                                placeholder="Enter coupon"
                                value={localCouponInput}
                                onChange={(e) => setLocalCouponInput(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 focus:ring focus:ring-primary flex-grow min-w-0 w-[65%] text-sm"
                              />
                              <button
                                onClick={handleApplyCoupon}
                                disabled={couponLoading || !localCouponInput.trim()}
                                className="shrink-0 btn-anime px-4 py-1 text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm font-medium"
                              >
                                {couponLoading ? '...' : 'Apply'}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-3">
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                {couponCode} applied
                              </span>
                              <button
                                type="button"
                                onClick={() => { removeCoupon(); pushNotice('Coupon removed'); }}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                          {couponError && <p className="mt-2 text-sm text-red-600">{couponError}</p>}
                        </div>
                        <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                          <div className="flex justify-between text-sm font-medium text-gray-900 mb-2">
                            <p>Subtotal</p>
                            <p>{formatPrice(getTotalPrice())}</p>
                          </div>
                          {couponApplied && (
                            <div className="flex justify-between text-sm font-medium text-red-600 mb-2">
                              <p>Discount</p>
                              <p>-{formatPrice(couponDiscount)}</p>
                            </div>
                          )}
                          <div className="flex justify-between text-base font-medium text-gray-900 mb-4">
                            <p>Total</p>
                            <p>{formatPrice(getTotalPrice() - (couponApplied ? couponDiscount : 0))}</p>
                          </div>
                          <Button 
                            onClick={handleCheckout}
                            className="w-full btn-anime text-white py-3"
                          >
                            Checkout
                          </Button>
                          <div className="mt-3 text-center">
                            <button
                              type="button"
                              className="text-sm text-primary hover:text-primary/80 transition-colors"
                              onClick={closeCart}
                            >
                              or Continue Shopping
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default OffCanvasCart;
