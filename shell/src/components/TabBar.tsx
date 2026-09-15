import { MoreHorizontal } from "lucide-react";
import { navigate } from "../lib/router";
import { SCREENS } from "../modules/registry";

/** Phone-width navigation: tabs along the bottom, like iOS. Built from the screen registry. */
export function TabBar({ active }: { active: string }) {
  const tabs = SCREENS.filter((s) => s.tab && s.id !== "settings").slice(0, 4);
  const inMore = !tabs.some((t) => t.id === active);
  return (
    <nav className="tabbar" aria-label="Sections">
      {tabs.map(({ id, title, icon: Icon }) => (
        <button key={id} type="button" className={active === id ? "active" : ""} onClick={() => navigate(id)}>
          <Icon size={22} strokeWidth={active === id ? 2.4 : 1.8} />
          {title}
        </button>
      ))}
      <button type="button" className={inMore ? "active" : ""} onClick={() => navigate("settings")}>
        <MoreHorizontal size={22} strokeWidth={inMore ? 2.4 : 1.8} />
        More
      </button>
    </nav>
  );
}
