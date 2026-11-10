import { useLayout } from "../state/layout";
import { DashboardHome } from "./homes/DashboardHome";
import { LivingHome } from "./homes/LivingHome";
import { CinemaHome } from "./homes/CinemaHome";
import { CleanHome } from "./homes/CleanHome";
import { TvDisplay } from "./homes/TvDisplay";
import type { ScreenProps } from "../modules/registry";
import { AskNode } from "../components/AskNode";
import { CallComputer } from "../components/CallComputer";
import { TalkNode } from "../components/TalkNode";

/**
 * Home is whichever look the active world chose. TV mode is a separate
 * MagicMirror-style board, never the phone or desktop home enlarged.
 * The previous looks stay available in Settings — nothing is removed.
 */
export const LOOKS = {
  clean: { title: "Clean", description: "Sectioned home: Today, Agents, Apps, Automations, System.", component: CleanHome },
  dashboard: { title: "Dashboard", description: "Dark, glassy, information-dense rows.", component: DashboardHome },
  living: { title: "Living Room", description: "Light and airy: clock, widgets, big icons.", component: LivingHome },
  cinema: { title: "Cinema", description: "Photo-forward with profiles and colour tiles.", component: CinemaHome },
} as const;

export function Home(props: ScreenProps) {
  const { layout, tv } = useLayout();
  if (tv) return <TvDisplay {...props} />;
  const forced = new URLSearchParams(location.search).get("look");
  const look = (forced && forced in LOOKS ? forced : layout?.look ?? "clean") as keyof typeof LOOKS;
  const Look = LOOKS[look]?.component ?? CleanHome;
  return <><div className="clean-actions"><CallComputer /><TalkNode /></div><AskNode /><Look {...props} /></>;
}
