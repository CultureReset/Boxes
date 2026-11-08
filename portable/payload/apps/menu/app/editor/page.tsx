'use client'

import { useState } from 'react'
import { MenuEditor } from '@/components/MenuEditor'
import { MenuItemForm } from '@/components/MenuItemForm'
import { api } from '@/lib/api'

export default function Editor() {
  const [menu, setMenu] = useState<any>(null)
  const [pin, setPin] = useState('')
  const [showPinInput, setShowPinInput] = useState(false)
  const [menuId, setMenuId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMenuCreated = (newMenu: any) => {
    setMenu(newMenu)
    setPin('')
    setMenuId(newMenu.id)
    setItems(newMenu.items || [])
  }

  const handleLoadMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const loadedMenu = await api.getMenu(menuId)
      setMenu(loadedMenu)
      setItems(loadedMenu.items || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleItemAdded = async () => {
    if (!menu) return
    try {
      const updated = await api.getMenu(menu.id)
      setItems(updated.items || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!pin) {
      setError('PIN required to delete items')
      return
    }

    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await api.deleteItem(itemId, pin)
      setItems(items.filter((item) => item.id !== itemId))
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!menu) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Menu Editor</h1>

          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Create New Menu</h2>
              <MenuEditor onMenuCreated={handleMenuCreated} />
            </div>

            <div className="border-t pt-8">
              <h2 className="text-xl font-semibold mb-4">Or Edit Existing Menu</h2>
              <form onSubmit={handleLoadMenu} className="space-y-4 bg-white p-6 rounded-lg shadow">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Menu ID
                  </label>
                  <input
                    type="text"
                    value={menuId}
                    onChange={(e) => setMenuId(e.target.value)}
                    placeholder="Paste your menu ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
                >
                  {loading ? 'Loading...' : 'Load Menu'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{menu.restaurant_name}</h1>
          <p className="text-gray-600">Menu ID: {menu.id}</p>
          <p className="text-lg font-semibold text-green-600 mt-2">PIN: {pin || '••••••'}</p>
        </div>

        {!pin && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 mb-3">Enter your PIN to edit menu items:</p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter 6-digit PIN"
              className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        )}

        {pin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Menu Items ({items.length})</h2>

                {items.length === 0 ? (
                  <p className="text-gray-500">No items yet. Add one below!</p>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 flex gap-4">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-20 w-20 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="text-sm text-gray-600">{item.category}</p>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                          )}
                          <p className="font-semibold text-green-600 mt-2">${item.price.toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <MenuItemForm
                menuId={menu.id}
                pin={pin}
                onItemAdded={handleItemAdded}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
