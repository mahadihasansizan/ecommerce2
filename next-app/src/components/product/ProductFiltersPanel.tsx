import { WooCategory } from '@/lib/woocommerce'
import { decodeHtmlEntities } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface Props {
  categories: WooCategory[]
  category: string
  minPrice: string
  maxPrice: string
  sortBy: string
  onCategoryChange: (v: string) => void
  onMinPriceChange: (v: string) => void
  onMaxPriceChange: (v: string) => void
  onSortChange: (v: string) => void
  onReset: () => void
  showHeading?: boolean
}

const SORT_OPTIONS = [
  { value: 'date', label: 'Newest First' },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'title-asc', label: 'Name A → Z' },
  { value: 'title-desc', label: 'Name Z → A' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'rating', label: 'Top Rated' }
]

export default function ProductFiltersPanel({
  categories,
  category,
  minPrice,
  maxPrice,
  sortBy,
  onCategoryChange,
  onMinPriceChange,
  onMaxPriceChange,
  onSortChange,
  onReset,
  showHeading = false
}: Props) {
  return (
    <div className="space-y-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
      {showHeading && <h3 className="text-lg font-bold text-gray-900">Filters</h3>}

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Categories</label>
        <Select value={category} onValueChange={(v) => onCategoryChange(v)}>
          <SelectTrigger className="w-full bg-gray-50 border-gray-200 focus:ring-primary/20">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => {
              const count = typeof c.count === 'number' ? c.count : 0;
              const displayName = `${decodeHtmlEntities(c.name)} (${count})`;
              return (
                <SelectItem key={c.id} value={c.slug}>
                  {displayName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Price */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Price Range</label>
        <div className="flex gap-3">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value)}
            className="bg-gray-50 border-gray-200 focus:ring-primary/20"
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
            className="bg-gray-50 border-gray-200 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Sort By</label>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-full bg-gray-50 border-gray-200 focus:ring-primary/20">
            <SelectValue placeholder="Newest First" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reset Button */}
      <div className="pt-2">
        <button
          onClick={onReset}
          className="text-sm font-medium text-gray-600 hover:text-primary transition-colors flex items-center gap-1"
        >
          Reset
        </button>
      </div>
    </div>
  )
}