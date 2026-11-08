export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  image_url?: string
  category: string
  is_available: boolean
}

export interface MenuCategory {
  id: string
  name: string
  order: number
}

export interface Menu {
  id: string
  restaurant_name: string
  slug: string
  /** Set by the business, not per-menu. Present so screens can read it. */
  theme_color?: string
  description?: string
  specials?: Special[]
  items: MenuItem[]
  categories: MenuCategory[]
  created_at: string
  updated_at: string
}

export interface Special {
  id: string
  menu_id: string
  title: string
  description: string
  image_url?: string
  start_date: string
  end_date: string
  type: 'special' | 'catch_of_the_day' | 'happy_hour' | 'event' | 'promo_banner'
}
