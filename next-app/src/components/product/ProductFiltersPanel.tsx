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
  showHeading = false
}: Props) {
  return (
    <div className="space-y-6">
      {showHeading && <h3 className="text-lg font-semibold">Filters</h3>}

      {/* Category */}
      <div>
        <label className="block mb-1 text-sm font-medium">Categories</label>
        <Select value={category} onValueChange={(v) => onCategoryChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent 
            className="!z-[1000001]" 
            style={{ zIndex: 1000001, position: 'relative' }}
          >
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
      <div>
        <label className="block mb-1 text-sm font-medium">Price Range</label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="block mb-1 text-sm font-medium">Sort By</label>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger>
            <SelectValue placeholder="Newest First" />
          </SelectTrigger>
          <SelectContent 
            className="!z-[1000001]" 
            style={{ zIndex: 1000001, position: 'relative' }}
          >
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}