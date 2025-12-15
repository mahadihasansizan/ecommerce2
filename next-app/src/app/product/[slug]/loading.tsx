import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-8 pb-32 md:pb-8">
            <nav className="text-sm mb-4 text-muted-foreground">
                <Skeleton className="h-4 w-64" />
            </nav>

            <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {/* Left: Images Skeleton */}
                    <div className="flex flex-col gap-4">
                        <Skeleton className="w-full aspect-square rounded-lg" />
                        <div className="hidden md:flex gap-2">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="w-20 h-20 rounded" />
                            ))}
                        </div>
                    </div>

                    {/* Right: Details Skeleton */}
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>

                        <Skeleton className="h-4 w-32" /> {/* Rating */}
                        <Skeleton className="h-4 w-24" /> {/* SKU */}
                        <Skeleton className="h-8 w-40" /> {/* Price */}

                        <div className="flex gap-2">
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                        </div>

                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>

                        {/* Variations Skeleton */}
                        <div className="space-y-3 mt-4">
                            <Skeleton className="h-5 w-32" />
                            <div className="grid grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                                ))}
                            </div>
                        </div>

                        {/* Actions Skeleton */}
                        <div className="flex gap-4 mt-6">
                            <Skeleton className="h-12 w-32" /> {/* Quantity */}
                            <Skeleton className="h-12 flex-1" /> {/* Add to Cart */}
                            <Skeleton className="h-12 flex-1" /> {/* Buy Now */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
