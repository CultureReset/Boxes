import { useLayout } from "../state/layout";
import { DashboardHome } from "./homes/DashboardHome";
import { LivingHome } from "./homes/LivingHome";
import { CinemaHome } from "./homes/CinemaHome";
import type { ScreenProps } from "../modules/registry";

/**
 * Home is whichever look the active world chose. Each look is a separate
 * composition of the same data and rows; add a look by adding a file here
 * and a card in Settings → Home Screen.
 */
export const LOOKS = {
  dashboard: { title: "Dashboard", description: "Dark, glassy, information-dense rows.", component: DashboardHome },
  living: { title: "Living Room", description: "Light and airy: clock, widgets, big icons.", component: LivingHome },
  cinema: { title: "Cinema", description: "Photo-forward with profiles and colour tiles.", component: CinemaHome },
} as const;

export function Home(props: ScreenProps) {
  const { layout } = useLayout();
  const Look = LOOKS[layout?.look ?? "dashboard"]?.component ?? DashboardHome;
  return <Look {...props} />;
}
