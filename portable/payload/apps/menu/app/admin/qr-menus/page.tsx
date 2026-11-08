'use client'

import { QRCodeCanvas } from 'qrcode.react'
import { useMemo, useState } from 'react'

interface RestaurantForm {
  restaurantName: string
  slug: string
  address: string
  phone: string
  website: string
  description: string
  logoUrl: string
  heroImageUrl: string
  hours: string
}

interface ReviewItem {
  id: string
  category: string
  name: string
  description: string
  price: string
  imageUrl: string
}

interface PromoControl {
  id: string
  type: 'special' | 'catch_of_the_day' | 'happy_hour' | 'event' | 'promo_banner'
  title: string
  description: string
  imageUrl: string
  startDate: string
  endDate: string
}

interface CreatedMenu {
  id: string
  slug: string
  pin?: string
}

const initialRestaurant: RestaurantForm = {
  restaurantName: '',
  slug: '',
  address: '',
  phone: '',
  website: '',
  description: '',
  logoUrl: '',
  heroImageUrl: '',
  hours: '',
}

const promoLabels: Record<PromoControl['type'], string> = {
  special: 'Special',
  catch_of_the_day: 'Catch of the Day',
  happy_hour: 'Happy Hour',
  event: 'Event',
  promo_banner: 'Promo Banner',
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function emptyItem(): ReviewItem {
  return {
    id: makeId('item'),
    category: '',
    name: '',
    description: '',
    price: '',
    imageUrl: '',
  }
}

function emptyPromo(type: PromoControl['type'] = 'special'): PromoControl {
  return {
    id: makeId('promo'),
    type,
    title: '',
    description: '',
    imageUrl: '',
    startDate: '',
    endDate: '',
  }
}

function normalizeExtractedItems(payload: any): ReviewItem[] {
  const candidateItems = Array.isArray(payload)
    ? payload
    : payload?.items || payload?.menu_items || payload?.menu?.items || []

  if (!Array.isArray(candidateItems)) return []

  return candidateItems.map((item: any) => ({
    id: makeId('item'),
    category: String(item.category || item.section || 'Menu'),
    name: String(item.name || item.title || ''),
    description: String(item.description || ''),
    price:
      item.price === undefined || item.price === null
        ? ''
        : String(item.price).replace(/[^0-9.]/g, ''),
    imageUrl: String(item.image_url || item.imageUrl || ''),
  }))
}

interface ThemeConfig {
  primaryColor: string
  accentColor: string
  bgColor: string
  textColor: string
  cardBg: string
  headerBg: string
  headerText: string
  font: string
  layout: string
  cardStyle: string
  heroStyle: string
  vibe: string
}

export default function QrMenusAdminPage() {
  const [restaurant, setRestaurant] = useState<RestaurantForm>(initialRestaurant)
  const [menuText, setMenuText] = useState('')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([emptyItem()])
  const [promos, setPromos] = useState<PromoControl[]>([])
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [createdMenu, setCreatedMenu] = useState<CreatedMenu | null>(null)
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null)
  const [themePrompt, setThemePrompt] = useState('')
  const [generatingTheme, setGeneratingTheme] = useState(false)

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const liveUrl = createdMenu ? `${origin}/menu/${createdMenu.slug}` : ''
  const editUrl = createdMenu ? `${origin}/edit/${createdMenu.slug}` : ''

  const validItems = useMemo(
    () => reviewItems.filter((item) => item.name.trim() && item.category.trim() && item.price.trim()),
    [reviewItems]
  )

  const updateRestaurant = (field: keyof RestaurantForm, value: string) => {
    setRestaurant((current) => ({
      ...current,
      [field]: value,
      ...(field === 'restaurantName' && !current.slug
        ? { slug: slugify(value) }
        : {}),
    }))
  }

  const handleMenuFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setMenuText(text)
  }

  const runAiExtraction = async () => {
    setExtracting(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/ai/extract-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: menuText }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'AI extraction failed')
      }

      const extractedItems = normalizeExtractedItems(payload)
      if (extractedItems.length === 0) {
        throw new Error('AI extraction returned no menu items to review')
      }

      setReviewItems(extractedItems)
      setMessage(`Extracted ${extractedItems.length} menu item${extractedItems.length === 1 ? '' : 's'} for review.`)
    } catch (err: any) {
      setError(err.message || 'AI extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  const generateTheme = async () => {
    if (!themePrompt.trim()) return
    setGeneratingTheme(true)
    setError('')
    try {
      const response = await fetch('/api/ai/generate-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: themePrompt,
          menuData: {
            restaurant_name: restaurant.restaurantName || undefined,
            description: restaurant.description || undefined,
            items: reviewItems.filter((i) => i.name.trim()),
          },
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Theme generation failed')
      setThemeConfig(payload)
    } catch (err: any) {
      setError(err.message || 'Theme generation failed')
    } finally {
      setGeneratingTheme(false)
    }
  }

  const updateReviewItem = <K extends keyof ReviewItem>(
    id: string,
    field: K,
    value: ReviewItem[K]
  ) => {
    setReviewItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const updatePromo = <K extends keyof PromoControl>(
    id: string,
    field: K,
    value: PromoControl[K]
  ) => {
    setPromos((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setMessage('Copied to clipboard.')
  }

  const downloadQrCode = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-menu-code canvas')
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `${createdMenu?.slug || restaurant.slug || 'menu'}-qr-code.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const saveMenu = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    setCreatedMenu(null)

    try {
      if (!restaurant.restaurantName.trim()) {
        throw new Error('Restaurant name is required')
      }

      if (!restaurant.slug.trim()) {
        throw new Error('Slug is required')
      }

      const createResponse = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: restaurant.restaurantName,
          slug: restaurant.slug,
          address: restaurant.address || undefined,
          phone: restaurant.phone || undefined,
          website: restaurant.website || undefined,
          description: restaurant.description || undefined,
          logo_url: restaurant.logoUrl || undefined,
          hero_image_url: restaurant.heroImageUrl || undefined,
          image_url: restaurant.heroImageUrl || restaurant.logoUrl || undefined,
          hours: restaurant.hours || undefined,
          theme_config: themeConfig || undefined,
        }),
      })
      const menuPayload = await createResponse.json().catch(() => ({}))

      if (!createResponse.ok) {
        throw new Error(menuPayload.error || 'Failed to create restaurant')
      }

      const pin = menuPayload.pin
      if (!pin) {
        throw new Error('Created restaurant did not return a PIN for related records')
      }

      for (const [index, item] of validItems.entries()) {
        const response = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_id: menuPayload.id,
            pin,
            category: item.category,
            name: item.name,
            description: item.description || undefined,
            price: Number.parseFloat(item.price),
            image_url: item.imageUrl || undefined,
            display_order: index + 1,
          }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload.error || `Failed to save item: ${item.name}`)
        }
      }

      for (const [index, promo] of promos.filter((entry) => entry.title.trim()).entries()) {
        const response = await fetch('/api/specials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_id: menuPayload.id,
            pin,
            title: promo.title,
            description: promo.description,
            image_url: promo.imageUrl || undefined,
            type: promo.type,
            start_date: promo.startDate || undefined,
            end_date: promo.endDate || undefined,
            display_order: index + 1,
          }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload.error || `Failed to save ${promoLabels[promo.type]}: ${promo.title}`)
        }
      }

      setCreatedMenu({ id: menuPayload.id, slug: menuPayload.slug, pin })
      setMessage('Restaurant menu saved. Share the live URL or download the QR code below.')
    } catch (err: any) {
      setError(err.message || 'Failed to save restaurant menu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Admin</p>
          <h1 className="mt-2 text-4xl font-bold">Create QR Menu</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Build a restaurant profile, import menu text with AI, review extracted items, and publish a live customer menu with a QR code.
          </p>
        </div>

        <form onSubmit={saveMenu} className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-8">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-semibold">Restaurant details</h2>
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Restaurant name *</span>
                  <input
                    value={restaurant.restaurantName}
                    onChange={(event) => updateRestaurant('restaurantName', event.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Harbor Bistro"
                  />
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Menu URL</span>
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                    <span className="mr-1 text-slate-400">/menu/</span>
                    <span className="font-mono text-slate-700">{restaurant.slug || '—'}</span>
                  </div>
                  <p className="text-xs text-slate-400">Auto-generated from restaurant name</p>
                </div>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Address</span>
                  <input
                    value={restaurant.address}
                    onChange={(event) => updateRestaurant('address', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="123 Main St, City, ST"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Phone</span>
                  <input
                    value={restaurant.phone}
                    onChange={(event) => updateRestaurant('phone', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="(555) 123-4567"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Website</span>
                  <input
                    value={restaurant.website}
                    onChange={(event) => updateRestaurant('website', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="https://example.com"
                  />
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Logo</span>
                  <input
                    value={restaurant.logoUrl}
                    onChange={(event) => updateRestaurant('logoUrl', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Logo image URL"
                  />
                  {restaurant.logoUrl && (
                    <img src={restaurant.logoUrl} alt="Logo preview" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Hero image</span>
                  <input
                    value={restaurant.heroImageUrl}
                    onChange={(event) => updateRestaurant('heroImageUrl', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Hero image URL"
                  />
                  {restaurant.heroImageUrl && (
                    <img src={restaurant.heroImageUrl} alt="Hero preview" className="h-24 w-full rounded-lg object-cover ring-1 ring-slate-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                </div>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                  <textarea
                    value={restaurant.description}
                    onChange={(event) => updateRestaurant('description', event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Short restaurant description"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Hours</span>
                  <textarea
                    value={restaurant.hours}
                    onChange={(event) => updateRestaurant('hours', event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Mon-Fri 11am-9pm\nSat-Sun 10am-10pm"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Menu import</h2>
                  <p className="mt-2 text-sm text-slate-600">Upload a text file or paste raw menu copy, then run AI extraction.</p>
                </div>
                <button
                  type="button"
                  onClick={runAiExtraction}
                  disabled={extracting || !menuText.trim()}
                  className="rounded-lg bg-purple-600 px-5 py-2 font-semibold text-white transition hover:bg-purple-700 disabled:bg-slate-300"
                >
                  {extracting ? 'Extracting...' : 'Run AI extraction'}
                </button>
              </div>
              <div className="mt-6 space-y-4">
                <input
                  type="file"
                  accept=".txt,.md,.csv,text/plain"
                  onChange={handleMenuFile}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                <textarea
                  value={menuText}
                  onChange={(event) => setMenuText(event.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Paste menu text here..."
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Design</h2>
                  <p className="mt-2 text-sm text-slate-600">Describe your restaurant vibe and AI will generate a matching color scheme and layout.</p>
                </div>
                <button
                  type="button"
                  onClick={generateTheme}
                  disabled={generatingTheme || !themePrompt.trim()}
                  className="rounded-lg bg-violet-600 px-5 py-2 font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-300"
                >
                  {generatingTheme ? 'Generating...' : themeConfig ? 'Regenerate' : 'Generate design with AI'}
                </button>
              </div>
              <div className="mt-6 space-y-4">
                <textarea
                  value={themePrompt}
                  onChange={(e) => setThemePrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="Describe your restaurant vibe... e.g. 'cozy Italian trattoria with warm candlelight and rustic wooden tables'"
                />
                {themeConfig && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    {themeConfig.vibe && (
                      <p className="text-sm text-slate-700 italic">&quot;{themeConfig.vibe}&quot;</p>
                    )}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Colors</span>
                      {([
                        { key: 'primaryColor', label: 'Primary' },
                        { key: 'accentColor', label: 'Accent' },
                        { key: 'bgColor', label: 'Background' },
                        { key: 'cardBg', label: 'Card' },
                        { key: 'headerBg', label: 'Header' },
                      ] as { key: keyof ThemeConfig; label: string }[]).map(({ key, label }) => (
                        <span
                          key={key}
                          title={`${label}: ${themeConfig[key]}`}
                          className="flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-1 text-xs text-slate-600"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-slate-300 flex-shrink-0"
                            style={{ backgroundColor: themeConfig[key] as string }}
                          />
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1 capitalize">Font: {themeConfig.font}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1 capitalize">Layout: {themeConfig.layout}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1 capitalize">Cards: {themeConfig.cardStyle}</span>
                      <span className="rounded-full bg-white border border-slate-200 px-2 py-1 capitalize">Hero: {themeConfig.heroStyle}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Review extracted menu</h2>
                  <p className="mt-2 text-sm text-slate-600">Edit AI extracted menu data before saving to Supabase.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewItems((items) => [...items, emptyItem()])}
                  className="rounded-lg border border-blue-200 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Add item
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {reviewItems.map((item, index) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold">{item.name.trim() || `Item ${index + 1}`}</h3>
                      <button
                        type="button"
                        onClick={() => setReviewItems((items) => items.filter((entry) => entry.id !== item.id))}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <input value={item.category} onChange={(event) => updateReviewItem(item.id, 'category', event.target.value)} placeholder="Category" className="rounded-lg border border-slate-300 px-3 py-2" />
                      <input value={item.name} onChange={(event) => updateReviewItem(item.id, 'name', event.target.value)} placeholder="Item name" className="rounded-lg border border-slate-300 px-3 py-2" />
                      <input value={item.price} onChange={(event) => updateReviewItem(item.id, 'price', event.target.value)} placeholder="Price" inputMode="decimal" className="rounded-lg border border-slate-300 px-3 py-2" />
                      <input value={item.imageUrl} onChange={(event) => updateReviewItem(item.id, 'imageUrl', event.target.value)} placeholder="Image URL" className="rounded-lg border border-slate-300 px-3 py-2" />
                      <textarea value={item.description} onChange={(event) => updateReviewItem(item.id, 'description', event.target.value)} placeholder="Description" rows={2} className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Promotions and events</h2>
                  <p className="mt-2 text-sm text-slate-600">Create specials, Catch of the Day options, happy hour, events, and promo banners.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPromos((items) => [...items, emptyPromo()])}
                  className="rounded-lg border border-blue-200 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Add promo
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {promos.map((promo) => (
                  <div key={promo.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <select value={promo.type} onChange={(event) => updatePromo(promo.id, 'type', event.target.value as PromoControl['type'])} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold">
                        {Object.entries(promoLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setPromos((items) => items.filter((entry) => entry.id !== promo.id))} className="text-sm font-medium text-red-600 hover:text-red-700">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <input value={promo.title} onChange={(event) => updatePromo(promo.id, 'title', event.target.value)} placeholder="Title" className="rounded-lg border border-slate-300 px-3 py-2" />
                      <input value={promo.imageUrl} onChange={(event) => updatePromo(promo.id, 'imageUrl', event.target.value)} placeholder="Image URL" className="rounded-lg border border-slate-300 px-3 py-2" />
                      <input type="datetime-local" value={promo.startDate} onChange={(event) => updatePromo(promo.id, 'startDate', event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
                      <input type="datetime-local" value={promo.endDate} onChange={(event) => updatePromo(promo.id, 'endDate', event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
                      <textarea value={promo.description} onChange={(event) => updatePromo(promo.id, 'description', event.target.value)} placeholder="Description" rows={2} className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold">Publish</h2>
              <p className="mt-2 text-sm text-slate-600">Saving creates the restaurant and related menu records in Supabase.</p>
              <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                <p><span className="font-semibold">Ready items:</span> {validItems.length}</p>
                <p><span className="font-semibold">Promos:</span> {promos.filter((promo) => promo.title.trim()).length}</p>
              </div>
              {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {message && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
              <button type="submit" disabled={saving} className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300">
                {saving ? 'Saving...' : 'Save and generate QR'}
              </button>
            </section>

            {createdMenu && (
              <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-semibold">Generated links</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <span className="text-sm font-medium text-slate-700">Live URL</span>
                    <div className="mt-1 flex gap-2">
                      <input readOnly value={liveUrl} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
                      <button type="button" onClick={() => copyText(liveUrl)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Copy</button>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700">Edit URL</span>
                    <div className="mt-1 flex gap-2">
                      <input readOnly value={editUrl} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
                      <button type="button" onClick={() => copyText(editUrl)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Copy</button>
                    </div>
                  </div>
                  {createdMenu.pin && <p className="text-sm text-slate-600">Edit PIN: <span className="font-semibold">{createdMenu.pin}</span></p>}
                </div>
              </section>
            )}

            {createdMenu && (
              <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-semibold">QR code</h2>
                <p className="mt-2 text-sm text-slate-600">Points to the live customer menu.</p>
                <div id="qr-menu-code" className="mt-5 inline-block rounded-xl border border-slate-200 bg-white p-4">
                  <QRCodeCanvas value={liveUrl} size={220} includeMargin />
                </div>
                <button type="button" onClick={downloadQrCode} className="mt-5 w-full rounded-lg border border-blue-200 px-5 py-2 font-semibold text-blue-700 hover:bg-blue-50">
                  Download QR
                </button>
              </section>
            )}
          </aside>
        </form>
      </div>
    </main>
  )
}
