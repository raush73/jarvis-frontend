export type ActivityType = "NOTE" | "FOLLOW_UP" | "TASK";

export type TimelineEntry = {
  id: string;
  type: ActivityType;
  timestamp: string;
  title: string;
  body: string | null;
  status: string | null;
  userId: string;
  userName: string;
  metadata: Record<string, any>;
};

export type OpenActivityEntry = {
  id: string;
  type: "FOLLOW_UP" | "TASK";
  dueAt: string | null;
  title: string;
  body: string | null;
  status: string;
  isOverdue: boolean;
  userId: string;
  userName: string;
  metadata: Record<string, any>;
};

export type TimelineResponse = {
  items: TimelineEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type OpenActivitiesResponse = {
  items: OpenActivityEntry[];
};

export const ACTIVITY_FILTER_TABS: { label: string; value: ActivityType | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Follow-Ups", value: "FOLLOW_UP" },
  { label: "Tasks", value: "TASK" },
  { label: "Notes", value: "NOTE" },
];

export const ACTIVITY_TYPE_BADGES: Record<ActivityType, { label: string; bg: string; color: string }> = {
  NOTE: { label: "Note", bg: "#f3e8fd", color: "#7b1fa2" },
  FOLLOW_UP: { label: "Follow-Up", bg: "#fff3e0", color: "#e67e22" },
  TASK: { label: "Task", bg: "#e8f5e9", color: "#2e7d32" },
};

export function formatActivityDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatActivityDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
