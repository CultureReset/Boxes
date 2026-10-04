/** Shapes the daemon's /api/nextgent/* routes return (daemon/src/nextgent/). */

export type SourceState = "ok" | "offline" | "not_connected" | "not_paired" | "no_account" | "not_configured" | "error";

export interface Settled<T> {
  state: SourceState;
  data: T | null;
  error?: string;
}

export interface LinkState {
  online: boolean | null;
  lastOk: string | null;
  lastError: string | null;
}

export interface PairingView {
  phase: "idle" | "waiting" | "paired" | "expired" | "error";
  userCode?: string;
  link?: string | null;
  expiresAt?: string;
  message?: string;
}

export interface NextgentState {
  configured: { paperclip: boolean; gcr: boolean; phone: boolean; events: boolean };
  paired: boolean;
  /** How the screen reaches the owner's account is not decided yet; false until it is. */
  accountLinked: boolean;
  company: { id: string; name: string } | null;
  computer: { id: string; name: string | null } | null;
  pairedAt: string | null;
  brand: string;
  link: LinkState;
  pairing: PairingView;
}

export type CalKind = "booking" | "event" | "availability" | "task" | "approval" | "local";

export interface CalItem {
  id: string;
  kind: CalKind;
  start: string;
  end?: string | null;
  allDay: boolean;
  title: string;
  meta?: string;
  status?: string | null;
  ref?: string;
  details?: Record<string, string>;
}

export interface CalendarResult {
  items: CalItem[];
  sources: Record<string, SourceState>;
  errors: Record<string, string>;
  offline: boolean;
  savedAt: string | null;
  paired: boolean;
  accountLinked: boolean;
}

export type Row = Record<string, unknown> & { id?: string };

export interface Approval extends Row {
  id: string;
  title: string;
  type?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
}

export interface HomeResult {
  paired: boolean;
  accountLinked: boolean;
  bookings?: Settled<Row[]>;
  threads?: Settled<Thread[]>;
  payments?: Settled<Row[]>;
  approvals?: Settled<Approval[]>;
  updates?: Settled<StoreItem[]>;
  receipts?: Settled<Receipt[]>;
  activity?: Settled<ActivityEvent[]>;
  agents?: Settled<Agent[]>;
}

export interface Agent extends Row {
  id: string;
  name: string;
  title?: string | null;
  status?: string;
  role?: string;
  reportsTo?: string | null;
  urlKey?: string;
  lastHeartbeatAt?: string | null;
}

export interface Task extends Row {
  id: string;
  title: string;
  status: string;
  assigneeAgentId?: string | null;
  updatedAt?: string;
}

export interface Comment extends Row {
  id: string;
  body: string;
  createdAt: string;
  authorType?: string;
  authorAgentId?: string | null;
  authorUserId?: string | null;
}

export interface Thread extends Row {
  id: string;
  channel?: string;
  contact?: string;
  last_message?: string | null;
  last_at?: string | null;
  unread?: number;
  handled_by?: "agent" | "owner";
}

export interface Message extends Row {
  id: string;
  direction: "in" | "out";
  text: string;
  at: string;
  author?: string;
  status?: string;
}

export interface Receipt extends Row {
  id: string;
  action?: string;
  target?: string;
  oldValue?: unknown;
  newValue?: unknown;
  device?: string | null;
  verified?: boolean;
  at?: string;
  createdAt?: string;
  taskId?: string | null;
  evidence?: unknown;
}

export interface ActivityEvent extends Row {
  id: string;
  action: string;
  entityType?: string;
  actorType?: string;
  actorId?: string;
  agentId?: string | null;
  createdAt: string;
  details?: Record<string, unknown> | null;
}

export interface StoreItem extends Row {
  id: string;
  key?: string;
  kind: string;
  name: string;
  summary?: string | null;
  iconUrl?: string | null;
  installed: boolean;
  enabled?: boolean | null;
  installedVersion?: string | null;
  latestVersion?: string | null;
  updateAvailable?: boolean;
}

export interface PhoneStatus {
  configured: boolean;
  service: boolean;
  devices: Row[];
  state: (Row & { error?: string }) | null;
}
