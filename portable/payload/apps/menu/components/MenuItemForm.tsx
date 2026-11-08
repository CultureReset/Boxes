'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

interface MenuItemFormProps {
  menuId: string
  pin: string
  onItemAdded?: () => void
}

export function MenuItemForm({ menuId, pin, onItemAdded }: MenuItemFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const result = await api.uploadImage(menuId, pin, file)
      setImageUrl(result.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.addItem(menuId, pin, {
        name,
        category,
        description: description || undefined,
        price: parseFloat(price),
        image_url: imageUrl || undefined,
      })

      setName('')
      setCategory('')
      setDescription('')
      setPrice('')
      setImageUrl('')
      onItemAdded?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Add Menu Item</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Caesar Salad"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            placeholder="e.g., Appetizers"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Item description..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Price ($) *
        </label>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          placeholder="9.99"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Image
        </label>
        {imageUrl && (
          <div className="mb-3 relative">
            <img
              src={imageUrl}
              alt="Preview"
              className="h-32 w-32 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
            >
              ✕
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={uploading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        {uploading && <p className="text-sm text-blue-500 mt-2">Uploading...</p>}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || uploading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition text-sm"
      >
        {loading ? 'Adding...' : 'Add Item'}
      </button>
    </form>
  )
}
