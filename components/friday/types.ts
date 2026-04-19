export type FollowUpStatus = 'OPEN' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export type FollowUpIntentType =
  | 'CALLBACK'
  | 'QUOTE_FOLLOWUP'
  | 'MSA_FOLLOWUP'
  | 'CHECK_IN'
  | 'DECISION_PENDING'
  | 'INFORMATION_SENT'
  | 'GENERAL';

// New 3-CTA model (locked design)
export type NextActionType =
  | 'follow-up'
  | 'recycle-lead'
  | 'do-not-call';

// Outcome (required, Step 1 of modal)
export type CallOutcome =
  | 'NO_ANSWER'
  | 'LEFT_VOICEMAIL'
  | 'SPOKE_NO_OPPORTUNITY'
  | 'OPPORTUNITY_IDENTIFIED'
  | 'FOLLOW_UP_REQUIRED'
  | 'CLOSED_NO_INTEREST';

// Recycle reasons with BD mapping
export type RecycleReason =
  | 'NO_CONTACT'
  | 'COULD_NOT_REACH_DM'
  | 'NO_TRACTION'
  | 'BETTER_SUITED_OTHER_REP';

export type ConflictResolutionAction =
  | 'reschedule-existing'
  | 'update-existing'
  | 'mark-complete'
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
  action: ConflictResolutionAction;
  existingFollowUpId: string;
  newDueAt?: string;
  hasExplicitTime?: boolean;
  newContext?: string;
  overrideReason?: string;
}

export interface CompleteCallPayload {
  callOutcome: CallOutcome;
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
  recyclePayload?: {
    reason: RecycleReason;
  };
  conflictResolution?: ResolveConflictPayload;
}

export interface ConflictResponse {
  existingFollowUp: FollowUp;
  message: string;
  resolutionOptions: ConflictResolutionAction[];
}

// Context endpoint response
export interface CallCompletionContext {
  noteHistory: Array<{ text: string; author: string; date: string; source: string }>;
  callHistory: Array<{ date: string; repName: string; outcome: string | null }>;
  activeFollowUp: {
    id: string;
    intentType: FollowUpIntentType;
    dueAt: string;
    context: string;
  } | null;
  attemptCount: number;
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

// ─── Company Call History (main page panel) ─────────────────────────

export interface CompanyCallHistoryEntry {
  id: string;
  startedAt: string;
  outcome: string | null;
  repName: string;
}

export interface CompanyCallHistoryResponse {
  ok: boolean;
  customerId: string;
  history: CompanyCallHistoryEntry[];
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

export interface DeferResult {
  ok: boolean;
  deferred: boolean;
  conflict?: {
    existingFollowUp: Record<string, unknown>;
    resolutionOptions: string[];
    message: string;
  };
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

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  NO_ANSWER: 'No Answer',
  LEFT_VOICEMAIL: 'Left Voicemail',
  SPOKE_NO_OPPORTUNITY: 'Spoke — No Opportunity',
  OPPORTUNITY_IDENTIFIED: 'Opportunity Identified',
  FOLLOW_UP_REQUIRED: 'Follow-Up Required',
  CLOSED_NO_INTEREST: 'Closed — No Interest',
};

export const CTA_LABELS: Record<NextActionType, string> = {
  'follow-up': 'Follow-Up / Claim',
  'recycle-lead': 'Recycle Lead',
  'do-not-call': 'Do Not Call',
};

export const RECYCLE_REASON_LABELS: Record<RecycleReason, string> = {
  NO_CONTACT: 'No contact (1 business day)',
  COULD_NOT_REACH_DM: 'Could not reach decision maker (3 business days)',
  NO_TRACTION: 'No traction (10 business days)',
  BETTER_SUITED_OTHER_REP: 'Better suited for another rep (10 business days)',
};

export const RECYCLE_REASON_BD: Record<RecycleReason, number> = {
  NO_CONTACT: 1,
  COULD_NOT_REACH_DM: 3,
  NO_TRACTION: 10,
  BETTER_SUITED_OTHER_REP: 10,
};

export const ALL_OUTCOMES: CallOutcome[] = [
  'NO_ANSWER',
  'LEFT_VOICEMAIL',
  'SPOKE_NO_OPPORTUNITY',
  'OPPORTUNITY_IDENTIFIED',
  'FOLLOW_UP_REQUIRED',
  'CLOSED_NO_INTEREST',
];

export const ALL_CTAS: NextActionType[] = [
  'follow-up',
  'recycle-lead',
  'do-not-call',
];

export const ALL_RECYCLE_REASONS: RecycleReason[] = [
  'NO_CONTACT',
  'COULD_NOT_REACH_DM',
  'NO_TRACTION',
  'BETTER_SUITED_OTHER_REP',
];

export const ALL_INTENT_TYPES: FollowUpIntentType[] = [
  'CALLBACK',
  'QUOTE_FOLLOWUP',
  'MSA_FOLLOWUP',
  'CHECK_IN',
  'DECISION_PENDING',
  'INFORMATION_SENT',
  'GENERAL',
];

// Kept for backward compat in any code that still references these
export const NEXT_ACTION_LABELS = CTA_LABELS;
export const ALL_NEXT_ACTIONS = ALL_CTAS;
export type ConflictResolution = ConflictResolutionAction;
