'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Truck, X, Plus, Minus, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { formatBDT } from '@/lib/utils';

interface OrderSummaryProps {
    items: any[];
    subtotal: number;
    shippingCost: number;
    shippingLoading: boolean;
    couponApplied: boolean;
    couponDiscount: number;
    grandTotal: number;
    currencySymbol: string;
    couponLoading: boolean;
    onApplyCoupon: (code: string) => void;
    onRemoveCoupon: () => void;
    onPlaceOrder: () => void;
    isProcessing: boolean;
    paymentMethodTitle: string;
}

const OrderSummary = ({
    items,
    subtotal,
    shippingCost,
    shippingLoading,
    couponApplied,
    couponDiscount,
    grandTotal,
    currencySymbol,
    couponLoading,
    onApplyCoupon,
    onRemoveCoupon,
    onPlaceOrder,
    isProcessing,
    paymentMethodTitle,
}: OrderSummaryProps) => {
    const { updateQuantity, removeFromCart } = useCartStore();
    const [localCouponInput, setLocalCouponInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const formatPrice = (value: number) => `${currencySymbol}${value.toFixed(2)}`;

    const handleApplyCoupon = () => {
        if (localCouponInput.trim()) {
            onApplyCoupon(localCouponInput);
        }
    };

    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

    const renderCartItems = () => (
        <div className="space-y-4">
            {items.map((item) => (
                <div key={item.id} className="flex gap-4 py-2">
                    {/* Product Image */}
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                        <img
                            src={item.image || '/placeholder.svg'}
                            alt={item.name}
                            className="h-full w-full object-cover object-center"
                        />
                    </div>

                    {/* Product Details */}
                    <div className="flex flex-1 flex-col">
                        <div>
                            <div className="flex justify-between text-base font-medium text-gray-900">
                                <h3 className="line-clamp-2 text-sm">{item.name}</h3>
                                <p className="ml-4 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
                            </div>

                            {/* Variations / Attributes */}
                            {item.attributes && Object.entries(item.attributes).length > 0 && (
                                <div className="mt-1 text-xs text-gray-500">
                                    {Object.entries(item.attributes).map(([key, value]) => (
                                        <p key={key}>
                                            <span className="uppercase">{key.replace('pa_', '')}: </span>
                                            {value as React.ReactNode}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-1 items-end justify-between text-sm">
                            {/* Quantity Controls */}
                            <div className="flex items-center border rounded-md">
                                <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    className="p-1 hover:bg-gray-100 text-gray-600"
                                    disabled={item.quantity <= 1}
                                >
                                    <Minus className="h-3 w-3" />
                                </button>
                                <span className="px-2 text-xs font-medium">{item.quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="p-1 hover:bg-gray-100 text-gray-600"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>

                            {/* Remove Button */}
                            <button
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                                className="font-medium text-red-500 hover:text-red-400 p-1"
                                aria-label="Remove item"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderCouponSection = () => (
        <div className="flex gap-2">
            <Input
                value={localCouponInput}
                onChange={(e) => setLocalCouponInput(e.target.value)}
                placeholder="Coupon code"
                className="flex-1"
                disabled={couponApplied}
            />
            {!couponApplied ? (
                <Button
                    variant="secondary"
                    disabled={!localCouponInput.trim() || couponLoading}
                    onClick={handleApplyCoupon}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                    Apply
                </Button>
            ) : (
                <Button variant="destructive" onClick={onRemoveCoupon}>Remove</Button>
            )}
        </div>
    );

    const renderTotalsSection = () => (
        <div className="space-y-2 pt-2 text-sm">
            <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium">
                    {shippingLoading ? 'Calculating...' : shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}
                </span>
            </div>
            {couponApplied && (
                <div className="flex justify-between text-emerald-600">
                    <span>Coupon Discount</span>
                    <span>-{formatPrice(couponDiscount)}</span>
                </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{formatPrice(grandTotal)}</span>
            </div>
        </div>
    );

    const renderPlaceOrderButton = () => (
        <div className="pt-2">
            <p className="text-sm text-gray-600 mb-4 hidden md:block">
                Payment: <span className="font-medium text-gray-900">{paymentMethodTitle}</span>
            </p>
            <Button
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white h-12 text-base"
                onClick={onPlaceOrder}
                disabled={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Place Order'}
            </Button>
        </div>
    );

    return (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
            {/* Desktop Header */}
            <CardHeader className="hidden md:flex flex-row items-center gap-2 border-b pb-4">
                <Truck className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg font-semibold text-gray-900">Order Summary</CardTitle>
            </CardHeader>

            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-gray-50 border-b">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    <Truck className="h-5 w-5" />
                    <span>Order Summary</span>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm text-emerald-600 font-medium hover:underline"
                >
                    {isExpanded ? 'Hide' : 'Show'}
                </button>
            </div>

            {/* Mobile: Collapsible Items & Coupon */}
            <div className={`md:hidden border-b bg-gray-50/50 ${isExpanded ? 'block' : 'hidden'}`}>
                <div className="p-4 space-y-4">
                    {renderCartItems()}
                    {renderCouponSection()}
                </div>
            </div>

            {/* Mobile: Always visible Summary & Button */}
            <div className="md:hidden p-4 space-y-4 bg-white">
                <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between items-center">
                        <span>{totalItems} items</span>
                        <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Shipping</span>
                        <span>{shippingLoading ? '...' : shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span>
                    </div>
                    {couponApplied && (
                        <div className="flex justify-between items-center text-emerald-600">
                            <span>Coupon</span>
                            <span>-{formatPrice(couponDiscount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center font-bold text-gray-900 text-base pt-1">
                        <span>Total</span>
                        <span>{formatPrice(grandTotal)}</span>
                    </div>
                </div>
                {renderPlaceOrderButton()}
            </div>

            {/* Desktop Content */}
            <CardContent className="hidden md:block p-6">
                <div className="space-y-4">
                    {renderCartItems()}
                    <Separator className="my-4" />
                    {renderCouponSection()}
                    {renderTotalsSection()}
                    {renderPlaceOrderButton()}
                </div>
            </CardContent>
        </Card>
    );
};

export default OrderSummary;
