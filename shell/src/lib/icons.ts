import { Calendar, Users, Music, Plane, Briefcase, Folder, Home, LayoutGrid, Mail, BarChart3, Share2, HelpCircle, Megaphone, Lock, LogOut, Sparkles, MessageSquare, Search, Smartphone, Globe, Heart, RefreshCw, ShieldCheck, Code2, ShoppingCart, Eye, Zap, Star, Package, FileText, Newspaper, Bot, Camera, Tv, Settings, Bell, Sun, Wifi, Image, Film, Gamepad2, BookOpen, Clock, MapPin, Phone, Video, Headphones, PenLine, Building2, GraduationCap, Utensils, Car, Dumbbell, Wallet, Gift } from "lucide-react";

/** Icon names stored in data (shortcuts, personas, automations) resolve here. */
export const ICONS = {
  calendar: Calendar, users: Users, music: Music, plane: Plane, briefcase: Briefcase, folder: Folder, home: Home, grid: LayoutGrid, mail: Mail, "bar-chart": BarChart3, "bar-chart-3": BarChart3, share: Share2, "share-2": Share2, "help-circle": HelpCircle, megaphone: Megaphone, lock: Lock, "log-out": LogOut, sparkles: Sparkles, "message-square": MessageSquare, search: Search, smartphone: Smartphone, globe: Globe, heart: Heart, "refresh-cw": RefreshCw, "shield-check": ShieldCheck, "code-2": Code2, "shopping-cart": ShoppingCart, eye: Eye, zap: Zap, star: Star, package: Package, "file-text": FileText, newspaper: Newspaper, bot: Bot, camera: Camera, tv: Tv, settings: Settings, bell: Bell, sun: Sun, wifi: Wifi, image: Image, film: Film, gamepad: Gamepad2, book: BookOpen, clock: Clock, "map-pin": MapPin, phone: Phone, video: Video, headphones: Headphones, pen: PenLine, building: Building2, school: GraduationCap, food: Utensils, car: Car, fitness: Dumbbell, wallet: Wallet, gift: Gift,
} as const;

export type IconName = keyof typeof ICONS;

export function iconFor(name: string): (typeof ICONS)[IconName] {
  return ICONS[name as IconName] ?? Sparkles;
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[];
