import React from 'react'

export const SkeletonProductCard: React.FC = () => {
  return (
    <div className="animate-pulse space-y-3">
      <div className="bg-gray-200 dark:bg-slate-700 rounded-md h-48 w-full" />
      <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
      <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-full mt-2" />
    </div>
  )
}

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 8 }) => {
  const items = Array.from({ length: count })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((_, i) => (
        <div key={i}>
          <SkeletonProductCard />
        </div>
      ))}
    </div>
  )
}

export const SkeletonProductDetail: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-gray-200 dark:bg-slate-700 rounded-md h-[420px] w-full animate-pulse" />
          <div className="mt-4 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
          </div>
        </div>
        <div>
          <div className="space-y-3">
            <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-full animate-pulse" />
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SkeletonGrid
