import type { FollowUpIntentType, FollowUpStatus } from './types';
import { INTENT_LABELS, STATUS_LABELS } from './types';

export function formatDueAt(dueAt: string, hasExplicitTime: boolean): string {
  const d = new Date(dueAt);
  const dateStr = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!hasExplicitTime) {
    return dateStr;
  }
  const h = d.getHours();
  const m = d.getMinutes();
  const amPm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${dateStr} at ${hour12}:${String(m).padStart(2, '0')} ${amPm}`;
}

export function formatIntentLabel(intentType: FollowUpIntentType): string {
  return INTENT_LABELS[intentType] ?? intentType;
}

export function formatStatusLabel(status: FollowUpStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function isDuePast(dueAt: string): boolean {
  return new Date(dueAt) < new Date();
}

export function daysUntilDue(dueAt: string): number {
  const now = new Date();
  const due = new Date(dueAt);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
