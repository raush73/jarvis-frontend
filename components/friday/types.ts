export type FollowUpStatus = 'OPEN' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export type FollowUpIntentType =
  | 'CALLBACK'
  | 'QUOTE_FOLLOWUP'
  | 'MSA_FOLLOWUP'
  | 'CHECK_IN'
  | 'DECISION_PENDING'
  | 'INFORMATION_SENT'
  | 'GENERAL';

export type NextActionType =
  | 'create-follow-up'
  | 'reschedule-existing-follow-up'
  | 'create-task'
  | 'mark-closed'
  | 'do-not-call-again';

export type ConflictResolution =
  | 'reschedule-existing'
  | 'update-existing'
  | 'override';

export interface FollowUp {
  id: string;
  customerId: string;
  contactId?: string | null;
  callEventId?: string | null;
  userId: string;
  intentType: FollowUpIntentType;
  dueAt: string;
  hasExplicitTime: boolean;
  context: string;
  status: FollowUpStatus;
  rescheduleCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  missedAt?: string | null;
  cancelledAt?: string | null;
  contact?: CompanyContact | null;
  user?: { id: string; fullName?: string | null; email?: string | null } | null;
}

export interface CompanyContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
}

export interface CreateFollowUpPayload {
  customerId: string;
  contactId?: string;
  callEventId?: string;
  intentType: FollowUpIntentType;
  dueAt: string;
  hasExplicitTime: boolean;
  context: string;
}

export interface RescheduleFollowUpPayload {
  newDueAt: string;
  hasExplicitTime?: boolean;
  reason?: string;
}

export interface ResolveConflictPayload {
  action: ConflictResolution;
  newDueAt?: string;
  hasExplicitTime?: boolean;
  newContext?: string;
  overrideReason?: string;
}

export interface CompleteCallPayload {
  callNoteText: string;
  nextAction: NextActionType;
  intelligenceId?: string;
  noteSource?: 'MANUAL' | 'AI_ASSISTED' | 'AI_GENERATED';
  followUpPayload?: CreateFollowUpPayload;
  reschedulePayload?: {
    followUpId: string;
    newDueAt: string;
    hasExplicitTime?: boolean;
    reason?: string;
  };
  taskPayload?: {
    customerId?: string;
    description: string;
    dueDate?: string;
  };
}

export interface ConflictResponse {
  existingFollowUp: FollowUp;
  message: string;
  resolutionOptions: ConflictResolution[];
}

// ─── Phase 7: Call Intelligence & Email Draft types ─────────────────

export interface CallIntelligence {
  id: string;
  callEventId: string;
  aiSummary: string;
  intentSignals: string[];
  keyTopics: string[];
  suggestedNextAction: NextActionType | null;
  suggestedFollowUp: FollowUpSuggestion | null;
  suggestedTask: TaskSuggestion | null;
  confidenceScore: number | null;
  modelVersion: string;
  createdAt: string;
}

export interface FollowUpSuggestion {
  intentType: FollowUpIntentType;
  dueAt: string;
  hasExplicitTime: boolean;
  context: string;
  reasoning: string;
  rescheduleExistingId: string | null;
}

export interface TaskSuggestion {
  description: string;
  dueDate: string | null;
  reasoning: string;
}

export interface EmailDraft {
  id: string;
  callEventId: string;
  intelligenceId?: string | null;
  contactId: string;
  subject: string;
  body: string;
  status: 'DRAFT' | 'APPROVED' | 'DISCARDED';
  createdAt: string;
  approvedAt: string | null;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    jobTitle: string | null;
  };
}

export interface IntelligenceResponse {
  ok: boolean;
  intelligence: CallIntelligence | null;
  suggestions?: {
    followUp: FollowUpSuggestion | null;
    task: TaskSuggestion | null;
  } | null;
  isExisting?: boolean;
}

// ─── Phase 8: Call Execution types ──────────────────────────────────

export type CallExecutionState =
  | 'NONE'
  | 'IDLE'
  | 'READY'
  | 'IN_CALL'
  | 'COMPLETING'
  | 'BLOCKED';

export interface CallTarget {
  callTargetId: string;
  customerId: string;
  customerName: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  bucket: string;
  bucketReason: string;
  followUpContext: string | null;
  followUpDueAt: string | null;
}

export interface SessionStatus {
  ok: boolean;
  sessionId: string;
  state: CallExecutionState;
  currentCallEventId: string | null;
  nextTarget: CallTarget | null;
  message: string | null;
}

export interface StartCallResult {
  ok: boolean;
  callEventId: string;
  callTarget: CallTarget;
  state: 'IN_CALL';
}

export interface CompleteCallResult {
  ok: boolean;
  state: 'READY' | 'BLOCKED';
  nextTarget: CallTarget | null;
  reason: string | null;
}

export interface DismissGateResult {
  ok: boolean;
  state: 'BLOCKED';
  callEventId: string;
  callTarget: CallTarget | null;
}

export const BUCKET_LABELS: Record<string, string> = {
  OVERDUE: 'Overdue',
  DUE_TODAY: 'Due Today',
  STALE: 'Stale',
  NORMAL: 'Normal',
};

export const BUCKET_COLORS: Record<string, string> = {
  OVERDUE: '#ef4444',
  DUE_TODAY: '#f59e0b',
  STALE: '#8b5cf6',
  NORMAL: '#3b82f6',
};

// ─── Labels & Constants ─────────────────────────────────────────────

export const INTENT_LABELS: Record<FollowUpIntentType, string> = {
  CALLBACK: 'Callback',
  QUOTE_FOLLOWUP: 'Quote Follow-up',
  MSA_FOLLOWUP: 'MSA Follow-up',
  CHECK_IN: 'Check-in',
  DECISION_PENDING: 'Decision Pending',
  INFORMATION_SENT: 'Information Sent',
  GENERAL: 'General',
};

export const STATUS_LABELS: Record<FollowUpStatus, string> = {
  OPEN: 'Open',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  CANCELLED: 'Cancelled',
};

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  'create-follow-up': 'Create Follow-up',
  'reschedule-existing-follow-up': 'Reschedule Existing Follow-up',
  'create-task': 'Create Task',
  'mark-closed': 'Mark Closed',
  'do-not-call-again': 'Do Not Call Again',
};

export const ALL_INTENT_TYPES: FollowUpIntentType[] = [
  'CALLBACK',
  'QUOTE_FOLLOWUP',
  'MSA_FOLLOWUP',
  'CHECK_IN',
  'DECISION_PENDING',
  'INFORMATION_SENT',
  'GENERAL',
];

export const ALL_NEXT_ACTIONS: NextActionType[] = [
  'create-follow-up',
  'reschedule-existing-follow-up',
  'create-task',
  'mark-closed',
  'do-not-call-again',
];
