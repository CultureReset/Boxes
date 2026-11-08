'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface ThemeConfig {
  primaryColor: string
  accentColor: string
  bgColor: string
  textColor: string
  cardBg: string
  headerBg: string
  headerText: string
  font: 'serif' | 'sans' | 'display'
  layout: 'list' | 'grid' | 'magazine'
  cardStyle: 'shadow' | 'border' | 'flat'
  heroStyle: 'full-bleed' | 'compact' | 'none'
  vibe: string
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#2563eb',
  accentColor: '#f59e0b',
  bgColor: '#f8fafc',
  textColor: '#0f172a',
  cardBg: '#ffffff',
  headerBg: '#2563eb',
  headerText: '#ffffff',
  font: 'sans',
  layout: 'list',
  cardStyle: 'shadow',
  heroStyle: 'compact',
  vibe: '',
}

interface MenuData {
  id: string
  restaurant_name: string
  description?: string
  address?: string
  phone?: string
  website?: string
  hours?: string
  logo_url?: string
  hero_image_url?: string
  theme_color?: string
  theme_config?: ThemeConfig | null
  items?: any[]
  categories?: any[]
  specials?: any[]
}

function mergeTheme(tc: any): ThemeConfig {
  if (!tc || typeof tc !== 'object') return DEFAULT_THEME
  return {
    primaryColor: tc.primaryColor || DEFAULT_THEME.primaryColor,
    accentColor: tc.accentColor || DEFAULT_THEME.accentColor,
    bgColor: tc.bgColor || DEFAULT_THEME.bgColor,
    textColor: tc.textColor || DEFAULT_THEME.textColor,
    cardBg: tc.cardBg || DEFAULT_THEME.cardBg,
    headerBg: tc.headerBg || DEFAULT_THEME.headerBg,
    headerText: tc.headerText || DEFAULT_THEME.headerText,
    font: tc.font || DEFAULT_THEME.font,
    layout: tc.layout || DEFAULT_THEME.layout,
    cardStyle: tc.cardStyle || DEFAULT_THEME.cardStyle,
    heroStyle: tc.heroStyle || DEFAULT_THEME.heroStyle,
    vibe: tc.vibe || DEFAULT_THEME.vibe,
  }
}

function fontClass(font: ThemeConfig['font']) {
  if (font === 'serif') return 'font-serif'
  if (font === 'display') return 'font-display'
  return 'font-sans'
}

function cardClasses(cardStyle: ThemeConfig['cardStyle']) {
  if (cardStyle === 'shadow') return 'shadow-md'
  if (cardStyle === 'border') return 'border border-slate-200'
  return '' // flat
}

export default function MenuPage({ params }: { params: { id: string } }) {
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [itemsByCategory, setItemsByCategory] = useState<Map<string, any[]>>(new Map())

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const data = await api.getMenu(params.id)
        setMenu(data)
        if (data.items) {
          const grouped = new Map<string, any[]>()
          data.items.forEach((item: any) => {
            const cat = item.category || 'Menu'
            if (!grouped.has(cat)) grouped.set(cat, [])
            grouped.get(cat)!.push(item)
          })
          setItemsByCategory(grouped)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadMenu()
  }, [params.id])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading menu...</p>
        </div>
      </main>
    )
  }

  if (error || !menu) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Menu not found'}</p>
          <a href="/" className="text-blue-600 hover:underline">Create a menu</a>
        </div>
      </main>
    )
  }

  const theme = mergeTheme(menu.theme_config)
  const fc = fontClass(theme.font)

  // ── Hero / Header ──────────────────────────────────────────────────────────

  const Hero = () => {
    if (theme.heroStyle === 'full-bleed' && menu.hero_image_url) {
      return (
        <div className="relative w-full h-72 md:h-96 overflow-hidden">
          <img
            src={menu.hero_image_url}
            alt={menu.restaurant_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center px-4 text-center">
            {menu.logo_url && (
              <img src={menu.logo_url} alt="logo" className="h-16 w-16 rounded-full object-cover mb-4 ring-2 ring-white" />
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow">{menu.restaurant_name}</h1>
            {menu.description && <p className="mt-2 text-lg text-white/90 max-w-xl">{menu.description}</p>}
          </div>
        </div>
      )
    }

    if (theme.heroStyle === 'compact') {
      return (
        <div
          className="py-6 px-4 flex items-center gap-4"
          style={{ backgroundColor: theme.headerBg, color: theme.headerText }}
        >
          <div className="max-w-4xl mx-auto w-full flex items-center gap-4">
            {menu.logo_url && (
              <img src={menu.logo_url} alt="logo" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{menu.restaurant_name}</h1>
              {menu.description && <p className="text-sm opacity-80">{menu.description}</p>}
            </div>
          </div>
        </div>
      )
    }

    // none — plain text header
    return (
      <div className="pt-8 pb-4 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold" style={{ color: theme.textColor }}>{menu.restaurant_name}</h1>
          {menu.description && <p className="mt-1 text-base opacity-70" style={{ color: theme.textColor }}>{menu.description}</p>}
        </div>
      </div>
    )
  }

  // ── Restaurant info strip ──────────────────────────────────────────────────

  const InfoStrip = () => {
    const hasInfo = menu.address || menu.phone || menu.website || menu.hours
    if (!hasInfo) return null
    return (
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap gap-4 text-sm" style={{ color: theme.textColor }}>
        {menu.address && (
          <span className="flex items-center gap-1 opacity-70">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {menu.address}
          </span>
        )}
        {menu.phone && (
          <a href={`tel:${menu.phone}`} className="flex items-center gap-1 opacity-70 hover:opacity-100">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
            </svg>
            {menu.phone}
          </a>
        )}
        {menu.website && (
          <a href={menu.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 opacity-70 hover:opacity-100">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            Website
          </a>
        )}
        {menu.hours && (
          <span className="flex items-center gap-1 opacity-70">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="whitespace-pre-line">{menu.hours}</span>
          </span>
        )}
      </div>
    )
  }

  // ── Item card renderers ────────────────────────────────────────────────────

  const cc = cardClasses(theme.cardStyle)

  function ItemCardList({ item }: { item: any }) {
    return (
      <div
        className={`rounded-lg p-4 flex gap-4 ${cc}`}
        style={{ backgroundColor: theme.cardBg, color: theme.textColor }}
      >
        {item.image_url && (
          <img src={item.image_url} alt={item.name} className="h-24 w-24 object-cover rounded-md flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-semibold text-base">{item.name}</h3>
            {item.price != null && (
              <span className="font-bold text-base flex-shrink-0" style={{ color: theme.accentColor }}>
                ${Number(item.price).toFixed(2)}
              </span>
            )}
          </div>
          {item.description && <p className="text-sm mt-1 opacity-70">{item.description}</p>}
          {item.is_available === false && (
            <p className="text-xs font-semibold mt-1" style={{ color: '#ef4444' }}>Unavailable</p>
          )}
        </div>
      </div>
    )
  }

  function ItemCardGrid({ item }: { item: any }) {
    return (
      <div
        className={`rounded-lg overflow-hidden flex flex-col ${cc}`}
        style={{ backgroundColor: theme.cardBg, color: theme.textColor }}
      >
        {item.image_url && (
          <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover" />
        )}
        <div className="p-3 flex flex-col flex-1">
          <div className="flex justify-between items-start gap-1 flex-1">
            <h3 className="font-semibold text-sm">{item.name}</h3>
            {item.price != null && (
              <span className="font-bold text-sm flex-shrink-0" style={{ color: theme.accentColor }}>
                ${Number(item.price).toFixed(2)}
              </span>
            )}
          </div>
          {item.description && <p className="text-xs mt-1 opacity-70 line-clamp-2">{item.description}</p>}
          {item.is_available === false && (
            <p className="text-xs font-semibold mt-1" style={{ color: '#ef4444' }}>Unavailable</p>
          )}
        </div>
      </div>
    )
  }

  function ItemCardMagazine({ item, isFirst }: { item: any; isFirst: boolean }) {
    if (isFirst) {
      return (
        <div
          className={`rounded-lg overflow-hidden flex flex-col md:flex-row gap-0 ${cc}`}
          style={{ backgroundColor: theme.cardBg, color: theme.textColor }}
        >
          {item.image_url && (
            <img src={item.image_url} alt={item.name} className="w-full md:w-64 h-52 md:h-auto object-cover flex-shrink-0" />
          )}
          <div className="p-5 flex flex-col justify-center flex-1">
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-xl font-bold">{item.name}</h3>
              {item.price != null && (
                <span className="text-xl font-bold flex-shrink-0" style={{ color: theme.accentColor }}>
                  ${Number(item.price).toFixed(2)}
                </span>
              )}
            </div>
            {item.description && <p className="text-sm mt-2 opacity-70">{item.description}</p>}
            {item.is_available === false && (
              <p className="text-xs font-semibold mt-2" style={{ color: '#ef4444' }}>Unavailable</p>
            )}
          </div>
        </div>
      )
    }
    return <ItemCardList item={item} />
  }

  // ── Category section renderer ──────────────────────────────────────────────

  function CategorySection({ category, items }: { category: string; items: any[] }) {
    return (
      <section key={category} className="mb-10">
        <h2 className="text-xl font-bold mb-4 pb-2 border-b" style={{ color: theme.primaryColor, borderColor: theme.primaryColor + '33' }}>
          {category}
        </h2>
        {theme.layout === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((item) => <ItemCardGrid key={item.id} item={item} />)}
          </div>
        ) : theme.layout === 'magazine' ? (
          <div className="space-y-4">
            {items.map((item, i) => <ItemCardMagazine key={item.id} item={item} isFirst={i === 0} />)}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => <ItemCardList key={item.id} item={item} />)}
          </div>
        )}
      </section>
    )
  }

  // ── Specials ───────────────────────────────────────────────────────────────

  const Specials = () => {
    if (!menu.specials || menu.specials.length === 0) return null
    return (
      <section className="mb-10">
        <h2 className="text-xl font-bold mb-4" style={{ color: theme.primaryColor }}>
          Special Offers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menu.specials.map((special) => (
            <div
              key={special.id}
              className={`rounded-lg overflow-hidden ${cc}`}
              style={{ backgroundColor: theme.cardBg, color: theme.textColor }}
            >
              {special.image_url && (
                <img src={special.image_url} alt={special.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h3 className="text-base font-bold">{special.title}</h3>
                {special.description && <p className="text-sm opacity-70 mt-1">{special.description}</p>}
                {special.end_date && (
                  <p className="text-xs opacity-50 mt-2">Until {new Date(special.end_date).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <main
      className={`min-h-screen ${fc}`}
      style={{ backgroundColor: theme.bgColor, color: theme.textColor }}
    >
      <style>{`
        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
      `}</style>

      <Hero />
      <InfoStrip />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Specials />

        {Array.from(itemsByCategory.entries()).map(([category, items]) => (
          <CategorySection key={category} category={category} items={items} />
        ))}

        {itemsByCategory.size === 0 && (
          <div className="text-center py-12 opacity-50">
            <p className="text-lg">No menu items yet.</p>
          </div>
        )}
      </div>

      <footer className="mt-12 py-6 text-center text-xs opacity-40" style={{ color: theme.textColor }}>
        Powered by Menu Builder
      </footer>
    </main>
  )
}
