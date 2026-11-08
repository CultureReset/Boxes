import { FlaskConical } from "lucide-react";
import { useStatus } from "../state/status";

/**
 * Demo mode is never silent. If the shell is showing canned data because there
 * is no desktop underneath it, it says so on every screen, not in a footnote.
 */
export function DemoBanner() {
  const { status } = useStatus();
  if (!status?.demo) return null;
  return (
    <div className="demo-banner" role="status">
      <FlaskConical size={14} />
      <span>
        <b>Demo mode.</b> No desktop session detected, so apps, files, networks and devices below are sample data, not this machine.
      </span>
    </div>
  );
}
