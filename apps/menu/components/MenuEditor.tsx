'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

interface MenuData {
  id: string
  restaurant_name: string
  slug: string
  description?: string
  theme_color: string
  items?: any[]
  categories?: any[]
  specials?: any[]
}

interface MenuEditorProps {
  initialMenu?: MenuData
  onMenuCreated?: (menu: MenuData) => void
}

export function MenuEditor({ initialMenu, onMenuCreated }: MenuEditorProps) {
  const [restaurantName, setRestaurantName] = useState(
    initialMenu?.restaurant_name || ''
  )
  const [description, setDescription] = useState(
    initialMenu?.description || ''
  )
  const [themeColor, setThemeColor] = useState(
    initialMenu?.theme_color || '#000000'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const menu = await api.createMenu(restaurantName, description, themeColor)
      setSuccess(`Menu created! PIN: ${menu.pin}`)
      setRestaurantName('')
      setDescription('')
      if (onMenuCreated) {
        onMenuCreated(menu)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Restaurant Name
        </label>
        <input
          type="text"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          required
          placeholder="Your Restaurant Name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description (Optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="About your restaurant..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Brand Color
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
          />
          <span className="text-sm text-gray-500">{themeColor}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 rounded-lg transition"
      >
        {loading ? 'Creating...' : 'Create Menu'}
      </button>
    </form>
  )
}
