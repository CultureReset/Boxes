import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Menu Builder - QR Menu System',
  description: 'Create and customize beautiful digital menus with QR codes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
