export interface SettingsEntry {
  id: string;
  title: string;
  keywords: string[];
  color: string;
}

export const SETTINGS_INDEX: SettingsEntry[] = [
  { id: "worlds", title: "People & Worlds", keywords: ["world", "profile", "family", "business", "environment", "pin", "switch"], color: "#bf5af2" },
  { id: "home", title: "Home Screen", keywords: ["home", "rows", "layout", "widgets", "tv"], color: "#0a84ff" },
  { id: "devices", title: "Phone & Devices", keywords: ["phone", "android", "usb", "scrcpy", "adb", "mirror"], color: "#3ddc84" },
  { id: "wifi", title: "Wi‑Fi", keywords: ["wifi", "network", "internet", "wireless"], color: "#0a84ff" },
  { id: "bluetooth", title: "Bluetooth", keywords: ["bluetooth", "airpods", "headphones", "mouse"], color: "#0a84ff" },
  { id: "sound", title: "Sound", keywords: ["sound", "audio", "volume", "speaker", "microphone"], color: "#ff375f" },
  { id: "display", title: "Display", keywords: ["display", "brightness", "screen", "monitor", "night"], color: "#0a84ff" },
  { id: "appearance", title: "Appearance", keywords: ["theme", "wallpaper", "background", "dark", "look"], color: "#bf5af2" },
  { id: "notifications", title: "Notifications", keywords: ["notifications", "alerts"], color: "#ff453a" },
  { id: "power", title: "Battery & Power", keywords: ["battery", "power", "sleep", "performance"], color: "#30d158" },
  { id: "storage", title: "Storage", keywords: ["storage", "disk", "space"], color: "#8e8e93" },
  { id: "updates", title: "Software Update", keywords: ["update", "upgrade", "packages"], color: "#636e7b" },
  { id: "about", title: "About", keywords: ["about", "version", "system", "kernel"], color: "#636e7b" },
];
