import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Menu Builder
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Create beautiful, customizable QR menus for your restaurant
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Link
            href="/editor"
            className="block p-8 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            <h2 className="text-2xl font-bold mb-2">Create Menu</h2>
            <p>Start building your restaurant menu with images and pricing</p>
          </Link>

          <Link
            href="/menus"
            className="block p-8 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
          >
            <h2 className="text-2xl font-bold mb-2">View Menus</h2>
            <p>Browse and manage your existing menus</p>
          </Link>
        </div>

        <div className="bg-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Features</h2>
          <ul className="text-slate-200 space-y-2">
            <li>✓ QR Code generation for easy menu sharing</li>
            <li>✓ Upload images for menu items, specials, and events</li>
            <li>✓ Easy-to-edit interface (no login required)</li>
            <li>✓ Fully customizable menu layouts</li>
            <li>✓ Support for specials, happy hours, and seasonal items</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
