import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { api, useApi } from "../api/client";
import type { Notification } from "../api/types";
import { Sheet } from "./Sheet";
import { timeAgo } from "../lib/format";
import { Empty } from "./ui";

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { data, reload } = useApi<Notification[]>("/api/notifications", ["notification", "notifications"]);
  const items = data ?? [];
  return (
    <Sheet
      title="Notifications"
      icon={<Bell size={18} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={() => void api.post("/api/notifications/read", { all: true }).then(reload)}>
            <CheckCheck size={15} /> Mark all read
          </button>
          <button type="button" className="btn" onClick={() => void api.post("/api/notifications/clear").then(reload)}>
            <Trash2 size={15} /> Clear
          </button>
        </>
      }
    >
      {items.length === 0 ? (
        <Empty icon={<BellOff size={28} />} title="You're all caught up" hint="Notifications from your apps will show up here." />
      ) : (
        <div className="list">
          {items.map((n) => (
            <div key={n.id} className="list-row" style={{ alignItems: "flex-start" }}>
              <span className={`status-dot ${n.read ? "" : "info"}`} style={{ marginTop: 7 }} />
              <span className="stack grow">
                <span className="t">{n.title || n.app}</span>
                {n.body && <span className="s" style={{ whiteSpace: "pre-wrap" }}>{n.body}</span>}
                <span className="tiny muted">
                  {n.app} · {timeAgo(n.at)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
