import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getCategories, WooCategory } from '@/lib/woocommerce'
import { decodeHtmlEntities } from '@/lib/utils'
import { deferStateUpdate } from '@/lib/utils'

export interface FilterValues {
  categories: string[]
  priceRange: [number, number]
  sortBy: string
}

export interface FilterOffCanvasProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the new filters when you click Apply or Reset */
  onApplyFilters?: (filters: FilterValues) => void
  /** Initial values to show in the panel */
  initial?: FilterValues
}

const SORT_OPTIONS = [
  { value: 'date', label: 'Newest First' },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'title-asc', label: 'Name A → Z' },
  { value: 'title-desc', label: 'Name Z → A' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'rating', label: 'Top Rated' },
]

const DEFAULT: FilterValues = {
  categories: [],
  priceRange: [0, 100000],
  sortBy: 'date',
}

export default function FilterOffCanvas({
  isOpen,
  onClose,
  onApplyFilters = () => {},
  initial = DEFAULT,
}: FilterOffCanvasProps) {
  const [cats, setCats] = useState<WooCategory[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial.categories)
  const [sortBy, setSortBy] = useState<string>(initial.sortBy)
  const [priceMin, setPriceMin] = useState<number>(initial.priceRange[0])
  const [priceMax, setPriceMax] = useState<number>(initial.priceRange[1])

  // when opened, re-init UI from `initial` and reload categories
  useEffect(() => {
    if (!isOpen) return

    deferStateUpdate(() => {
      setSelectedCategories(initial.categories)
      setSortBy(initial.sortBy)
      setPriceMin(initial.priceRange[0])
      setPriceMax(initial.priceRange[1])
    })

    getCategories()
      .then((categories) => {
        const validCats = categories.filter(c => c.slug && c.slug.trim() !== '')
        setCats(validCats)
      })
      .catch((error) => {
        console.error('Failed to load categories:', error)
        setCats([])
      })
  }, [isOpen, initial])

  // Prevent body scrolling when filter offcanvas is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY
      // Lock body scroll
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      
      return () => {
        // Restore scroll position
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  const toggleCategory = (slug: string, checked: boolean) => {
    if (!slug || slug.trim() === '') return
    setSelectedCategories((prev) => {
      if (checked) {
        // Add category if not already selected
        return prev.includes(slug) ? prev : [...prev, slug]
      } else {
        // Remove category
        return prev.filter((s) => s !== slug)
      }
    })
  }

  const handleApply = () => {
    const min = Math.max(0, priceMin)
    const max = Math.max(min, priceMax)
    onApplyFilters({ categories: selectedCategories, priceRange: [min, max], sortBy })
    onClose()
  }

  const handleReset = () => {
    onApplyFilters(DEFAULT)
    onClose()
  }

  if (!isOpen) return null

  const filterContent = (
    <div 
      className="fixed inset-0 z-[999998] flex" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        zIndex: 999998
      }}
    >
      {/* Drawer panel (80% width) - LEFT SIDE */}
      <div 
        className="h-screen bg-white shadow-xl w-[80%] max-w-[420px] flex flex-col border-r relative" 
        style={{ 
          height: '100vh',
          zIndex: 999999,
          order: 1
        }}
      >
        {/* Header - fixed at top */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button onClick={onClose} aria-label="Close" className="text-xl text-gray-500 hover:text-primary">
            ×
          </button>
        </div>

        {/* Scrollable content area - with padding-bottom for fixed buttons */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-8" style={{ paddingBottom: '100px' }}>
          {/* Price Range */}
          <section>
            <h3 className="font-semibold mb-2">Price Range</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={priceMin}
                onChange={(e) => setPriceMin(Number(e.target.value))}
                placeholder="Min"
              />
              <span>-</span>
              <input
                type="number"
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={priceMax}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                placeholder="Max"
              />
            </div>
          </section>

          {/* Categories */}
          <section>
            <h3 className="font-semibold mb-2">Categories</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {cats.map((c) => {
                const isChecked = selectedCategories.includes(c.slug)
                const count = typeof c.count === 'number' ? c.count : 0
                return (
                  <div 
                    key={c.id} 
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                  <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        toggleCategory(c.slug, checked === true)
                      }}
                    id={`cat-${c.id}`}
                  />
                    <label 
                      htmlFor={`cat-${c.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      {decodeHtmlEntities(c.name)} ({count})
                </label>
                  </div>
                )
              })}
              {!cats.length && <p className="text-xs text-muted-foreground">Loading…</p>}
            </div>
          </section>

          {/* Sort By */}
          <section>
            <h3 className="font-semibold mb-2">Sort By</h3>
            <div className="grid gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`text-left px-3 py-2 rounded border text-sm ${
                    sortBy === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 hover:border-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Fixed buttons at bottom - above MobileBottomMenu */}
        <div className="absolute bottom-0 left-0 right-0 flex gap-3 px-5 py-4 border-t bg-white shadow-lg" style={{ zIndex: 1000000 }}>
          <Button variant="outline" className="flex-1 h-11" onClick={handleReset}>
            Reset
          </Button>
          <Button className="flex-1 h-11" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      {/* Overlay - RIGHT SIDE */}
      <div 
        className="flex-1 bg-black/20" 
        onClick={onClose}
        style={{ zIndex: 999998, order: 2 }}
      />
    </div>
  )

  // Render using portal to ensure it's outside any parent containers
  if (typeof window !== 'undefined' && document.body) {
    return createPortal(filterContent, document.body)
  }

  return null
}
