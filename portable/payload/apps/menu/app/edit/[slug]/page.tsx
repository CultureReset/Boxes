'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

const promoLabels: Record<string, string> = {
  special: 'Special',
  catch_of_the_day: 'Catch of the Day',
  happy_hour: 'Happy Hour',
  event: 'Event',
  promo_banner: 'Promo Banner',
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  )
}

function ImageUpload({ menuId, pin, currentUrl, onUploaded }: {
  menuId: string
  pin: string
  currentUrl?: string
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('menu_id', menuId)
      formData.append('pin', pin)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onUploaded(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentUrl && (
        <img src={currentUrl} alt="Item" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" onError={(e) => (e.currentTarget.style.display = 'none')} />
      )}
      <div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
        >
          {uploading ? 'Uploading...' : currentUrl ? 'Change photo' : 'Add photo'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

export default function EditMenuPage({ params }: { params: { slug: string } }) {
  const [menu, setMenu] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [pin, setPin] = useState('')
  const [pinVerified, setPinVerified] = useState(false)
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [newItem, setNewItem] = useState({ category: '', name: '', description: '', price: '', image_url: '' })
  const [addingItem, setAddingItem] = useState(false)
  const newItemImgRef = useRef<HTMLInputElement>(null)
  const [newItemUploading, setNewItemUploading] = useState(false)

  useEffect(() => {
    api.getMenu(params.slug)
      .then((data) => {
        setMenu(data)
        setItems(data.items || [])
        setSpecials(data.specials || [])
      })
      .catch(() => setError('Menu not found'))
      .finally(() => setLoading(false))
  }, [params.slug])

  const verifyPin = async () => {
    setPinError('')
    try {
      await api.updateMenu(menu.id, pin, { restaurant_name: menu.restaurant_name })
      setPinVerified(true)
    } catch {
      setPinError('Incorrect PIN. Please try again.')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Remove this item?')) return
    try {
      await api.deleteItem(itemId, pin)
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const handleToggleAvailable = async (item: any) => {
    try {
      await api.updateItem(item.id, pin, { is_available: !item.is_available })
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const handleItemImageUploaded = async (itemId: string, url: string) => {
    try {
      await api.updateItem(itemId, pin, { image_url: url })
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, image_url: url } : i))
      setMessage('Photo updated.')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const handleNewItemImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewItemUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('menu_id', menu.id)
      formData.append('pin', pin)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setNewItem((s) => ({ ...s, image_url: data.url }))
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setNewItemUploading(false)
      if (newItemImgRef.current) newItemImgRef.current.value = ''
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.name.trim() || !newItem.category.trim() || !newItem.price.trim()) {
      setMessage('Name, category, and price are required.')
      return
    }
    setAddingItem(true)
    setMessage('')
    try {
      const added = await api.addItem(menu.id, pin, {
        ...newItem,
        price: parseFloat(newItem.price),
        image_url: newItem.image_url || undefined,
      })
      setItems((prev) => [...prev, added])
      setNewItem({ category: '', name: '', description: '', price: '', image_url: '' })
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setAddingItem(false)
    }
  }

  const handleDeleteSpecial = async (specialId: string) => {
    if (!confirm('Remove this promo?')) return
    try {
      await api.deleteSpecial(specialId, pin)
      setSpecials((prev) => prev.filter((s) => s.id !== specialId))
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-slate-500">Loading menu...</p>
        </div>
      </main>
    )
  }

  if (error || !menu) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-red-600">{error || 'Menu not found'}</p>
      </main>
    )
  }

  if (!pinVerified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold">{menu.restaurant_name}</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your PIN to edit this menu.</p>
          <div className="mt-6 space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
              placeholder="6-digit PIN"
              maxLength={6}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {pinError && <p className="text-sm text-red-600">{pinError}</p>}
            <button
              onClick={verifyPin}
              disabled={pin.length < 6}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              Unlock
            </button>
          </div>
        </div>
      </main>
    )
  }

  const byCategory = items.reduce<Record<string, any[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Editing</p>
            <h1 className="mt-1 text-3xl font-bold">{menu.restaurant_name}</h1>
          </div>
          <a
            href={`/menu/${params.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            View live menu ↗
          </a>
        </div>

        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        {/* Menu Items */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">Menu items ({items.length})</h2>

          {Object.entries(byCategory).map(([category, catItems]) => (
            <div key={category} className="mt-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{category}</h3>
              <div className="space-y-3">
                {catItems.map((item) => (
                  <div key={item.id} className={`rounded-xl border p-4 ${item.is_available === false ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{item.name}</p>
                        {item.description && <p className="text-sm text-slate-500 truncate">{item.description}</p>}
                        <p className="mt-1 text-sm font-semibold text-green-600">${parseFloat(item.price).toFixed(2)}</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-2">
                        <button
                          onClick={() => handleToggleAvailable(item)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${item.is_available === false ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {item.is_available === false ? 'Mark available' : "Mark 86'd"}
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <ImageUpload
                        menuId={menu.id}
                        pin={pin}
                        currentUrl={item.image_url}
                        onUploaded={(url) => handleItemImageUploaded(item.id, url)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">No items yet. Add one below.</p>
          )}
        </section>

        {/* Add Item */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">Add item</h2>
          <form onSubmit={handleAddItem} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Category *" value={newItem.category} onChange={(v) => setNewItem((s) => ({ ...s, category: v }))} placeholder="Appetizers" />
            <Field label="Name *" value={newItem.name} onChange={(v) => setNewItem((s) => ({ ...s, name: v }))} placeholder="Shrimp Po'boy" />
            <Field label="Price *" value={newItem.price} onChange={(v) => setNewItem((s) => ({ ...s, price: v }))} placeholder="12.99" />
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Photo</span>
              <div className="flex items-center gap-3">
                {newItem.image_url && (
                  <img src={newItem.image_url} alt="Preview" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
                )}
                <input ref={newItemImgRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleNewItemImage} />
                <button
                  type="button"
                  onClick={() => newItemImgRef.current?.click()}
                  disabled={newItemUploading}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                >
                  {newItemUploading ? 'Uploading...' : newItem.image_url ? 'Change photo' : 'Add photo'}
                </button>
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
                rows={2}
                placeholder="Optional description"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={addingItem}
                className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {addingItem ? 'Adding...' : 'Add item'}
              </button>
            </div>
          </form>
        </section>

        {/* Specials */}
        {specials.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold">Promos & specials</h2>
            <div className="mt-5 space-y-3">
              {specials.map((special) => (
                <div key={special.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">{promoLabels[special.type] || special.type}</span>
                    <p className="font-semibold">{special.title}</p>
                    {special.description && <p className="text-sm text-slate-500 truncate">{special.description}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteSpecial(special.id)}
                    className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
