/**
 * Workforce Application - browser API client.
 *
 * A thin transport over the EXISTING production Workforce endpoints. It adds no
 * business rules and duplicates no backend validation: the backend remains the system
 * of record, and every screen reads the stage view the backend returns after a save
 * rather than trusting local state.
 *
 * Types mirror the backend stage contracts so the captured shape and the submitted
 * shape cannot drift.
 */

import { API_BASE } from "@/lib/api";
import {
  clearWorkerSession,
  getWorkerToken,
  saveWorkerSession,
} from "./workerSession";

/* -------------------------------------------------------------------------- */
/*  Transport                                                                  */
/* -------------------------------------------------------------------------- */

/** A backend-reported problem, surfaced to the worker without leaking internals. */
export class WorkforceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: string[] = [],
  ) {
    super(message);
    this.name = "WorkforceApiError";
  }
}

/** Raised when the worker has no usable session, so the caller can route to entry. */
export class WorkerSessionExpiredError extends WorkforceApiError {
  constructor() {
    super("Your application session has ended. Please start again.", 401);
    this.name = "WorkerSessionExpiredError";
  }
}

type Envelope<T> = { ok: true; value: T };

function extractMessage(body: unknown): { message: string; fieldErrors: string[] } {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const raw = record.message;
    if (Array.isArray(raw)) {
      // class-validator returns one message per failed constraint.
      const list = raw.filter((m): m is string => typeof m === "string");
      if (list.length === 1) return { message: list[0], fieldErrors: [] };
      if (list.length > 1) {
        return { message: "Please correct the following.", fieldErrors: list };
      }
      return { message: "Request failed", fieldErrors: [] };
    }
    if (typeof raw === "string") return { message: raw, fieldErrors: [] };
  }
  return { message: "Request failed", fieldErrors: [] };
}

async function workerFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; authenticated?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, authenticated = true } = init;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (authenticated) {
    const token = getWorkerToken();
    if (!token) throw new WorkerSessionExpiredError();
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    if (authenticated) clearWorkerSession();
    throw new WorkerSessionExpiredError();
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const { message, fieldErrors } = extractMessage(payload);
    throw new WorkforceApiError(message, res.status, fieldErrors);
  }

  return (payload as Envelope<T>).value;
}

/* -------------------------------------------------------------------------- */
/*  Entry                                                                      */
/* -------------------------------------------------------------------------- */

export type WorkerAuthSuccess = {
  authenticated: true;
  applicationSessionId: string;
  /** Null for a first-time applicant: no Candidate exists until a recruiter approves. */
  candidateId: string | null;
  requestedIntent: { category: string; recognized: boolean } | null;
  session: { token: string; tokenType: "Bearer"; expiresAt: string };
};

export type WorkerAuthFailure = { authenticated: false; reason: string };

export type WorkerAuthResponse = WorkerAuthSuccess | WorkerAuthFailure;

/**
 * Begin a new Workforce Application and persist the resulting worker session. Used by
 * every inbound source; there is one application and one entry path.
 */
export async function startApplication(
  requestedIntent = "APPLY_FOR_JOB",
): Promise<WorkerAuthSuccess> {
  const result = await workerFetch<WorkerAuthResponse>(
    "/workforce/auth/application/start",
    { method: "POST", body: { requestedIntent }, authenticated: false },
  );
  if (!result.authenticated) {
    throw new WorkforceApiError("Unable to start your application.", 400);
  }
  saveWorkerSession({
    token: result.session.token,
    expiresAt: result.session.expiresAt,
    applicationSessionId: result.applicationSessionId,
    candidateId: result.candidateId,
  });
  return result;
}

/**
 * Resume via a recruiter-issued Workforce link. The link is single-use; a successful
 * consume yields the same worker session as a fresh start.
 */
export async function consumeWorkforceLink(
  token: string,
  requestedIntent = "APPLY_FOR_JOB",
): Promise<WorkerAuthResponse> {
  const result = await workerFetch<WorkerAuthResponse>(
    "/workforce/auth/magic-link/consume",
    { method: "POST", body: { token, requestedIntent }, authenticated: false },
  );
  if (result.authenticated) {
    saveWorkerSession({
      token: result.session.token,
      expiresAt: result.session.expiresAt,
      applicationSessionId: result.applicationSessionId,
      candidateId: result.candidateId,
    });
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Wizard state                                                               */
/* -------------------------------------------------------------------------- */

export type WorkforceApplicationStage =
  | "IDENTITY_INFORMATION"
  | "PRIMARY_TRADE"
  | "WORK_HISTORY"
  | "CERTIFICATIONS_LICENSES"
  | "TOOLS_PPE"
  | "REFERENCES"
  | "LEGAL_ACKNOWLEDGEMENTS"
  | "REVIEW_SUBMIT";

export type WizardStageView = {
  stage: WorkforceApplicationStage;
  title: string;
  order: number;
  status: "COMPLETED" | "CURRENT" | "UPCOMING";
  completed: boolean;
  current: boolean;
};

export type WizardState = {
  applicationSessionId: string;
  candidateId: string | null;
  identityType: string;
  requestedIntent: { category: string; recognized: boolean } | null;
  status: "DRAFT" | "SUBMITTED";
  stages: WizardStageView[];
  navigation: {
    currentStage: WorkforceApplicationStage;
    previousStage: WorkforceApplicationStage | null;
    nextStage: WorkforceApplicationStage | null;
    canAdvance: boolean;
    canRetreat: boolean;
  };
  completedStageCount: number;
  totalStageCount: number;
  completionPercentage: number;
};

export function getWizardState(): Promise<WizardState> {
  return workerFetch<WizardState>("/workforce/application/wizard");
}

export function navigateWizard(
  direction: "NEXT" | "PREVIOUS",
): Promise<WizardState> {
  return workerFetch<WizardState>("/workforce/application/wizard/navigate", {
    method: "POST",
    body: { direction },
  });
}

/** The locked backend stage order. Never reordered; used only to compare positions. */
export const STAGE_ORDER: WorkforceApplicationStage[] = [
  "IDENTITY_INFORMATION",
  "PRIMARY_TRADE",
  "WORK_HISTORY",
  "CERTIFICATIONS_LICENSES",
  "TOOLS_PPE",
  "REFERENCES",
  "LEGAL_ACKNOWLEDGEMENTS",
  "REVIEW_SUBMIT",
];

/**
 * Walk the backend stage cursor forward until it reaches `target`.
 *
 * The browser presents more screens than there are stages, so it advances the cursor
 * only at stage boundaries. Each step is the existing navigate endpoint, which refuses
 * to advance from an incomplete stage and marks the departed stage complete - so this
 * both records real progress and keeps a resumed session pointing at the right place.
 * REFERENCES is passed through here (it collects nothing) rather than shown as a screen.
 *
 * Failure is intentionally silent: the stage data is already saved, and submission
 * readiness is computed from that data, not from this cursor.
 */
export async function syncStageCursor(
  target: WorkforceApplicationStage,
): Promise<void> {
  const targetIndex = STAGE_ORDER.indexOf(target);
  if (targetIndex < 0) return;
  try {
    let state = await getWizardState();
    for (let guard = 0; guard < STAGE_ORDER.length; guard += 1) {
      if (STAGE_ORDER.indexOf(state.navigation.currentStage) >= targetIndex) return;
      state = await navigateWizard("NEXT");
    }
  } catch {
    // Cursor position is presentation state only; never block the worker on it.
  }
}

/* -------------------------------------------------------------------------- */
/*  Identity (atomic: one save carries identity AND contact AND the SSN)        */
/* -------------------------------------------------------------------------- */

export type IdentityStageView = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ssnMasked: string | null;
  ssnProvided: boolean;
};

export type SaveIdentityInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  ssn: string;
};

export function getIdentity(): Promise<IdentityStageView> {
  return workerFetch<IdentityStageView>(
    "/workforce/application/wizard/identity",
  );
}

export function saveIdentity(
  input: SaveIdentityInput,
): Promise<IdentityStageView> {
  return workerFetch<IdentityStageView>(
    "/workforce/application/wizard/identity",
    { method: "PUT", body: input },
  );
}

/* -------------------------------------------------------------------------- */
/*  Primary Trade                                                              */
/* -------------------------------------------------------------------------- */

export type TradeOption = { id: string; name: string };

export type PrimaryTradeStageView = {
  primaryTradeId: string | null;
  primaryTradeName: string | null;
};

export function getTradeRegistry(): Promise<TradeOption[]> {
  return workerFetch<TradeOption[]>(
    "/workforce/application/wizard/primary-trade/trades",
  );
}

export function getPrimaryTrade(): Promise<PrimaryTradeStageView> {
  return workerFetch<PrimaryTradeStageView>(
    "/workforce/application/wizard/primary-trade",
  );
}

export function savePrimaryTrade(
  primaryTradeId: string,
): Promise<PrimaryTradeStageView> {
  return workerFetch<PrimaryTradeStageView>(
    "/workforce/application/wizard/primary-trade",
    { method: "PUT", body: { primaryTradeId } },
  );
}

/* -------------------------------------------------------------------------- */
/*  Work History                                                               */
/* -------------------------------------------------------------------------- */

export type WorkHistoryEntryView = {
  id: string;
  employerName: string;
  jobTitle: string;
  primaryTradeId: string;
  primaryTradeName: string | null;
  startDate: string;
  endDate: string | null;
  currentlyEmployed: boolean;
  city: string;
  state: string;
  supervisorName: string | null;
  supervisorPhone: string | null;
  description: string;
  reasonForLeaving: string | null;
};

export type WorkHistoryStageView = {
  hasPreviousEmployment: boolean | null;
  entries: WorkHistoryEntryView[];
};

export type WorkHistoryEntryInput = {
  employerName: string;
  jobTitle: string;
  primaryTradeId: string;
  startDate: string;
  endDate?: string;
  currentlyEmployed: boolean;
  city: string;
  state: string;
  supervisorName?: string;
  supervisorPhone?: string;
  description: string;
  reasonForLeaving?: string;
};

export function getWorkHistoryTrades(): Promise<TradeOption[]> {
  return workerFetch<TradeOption[]>(
    "/workforce/application/wizard/work-history/trades",
  );
}

export function getWorkHistory(): Promise<WorkHistoryStageView> {
  return workerFetch<WorkHistoryStageView>(
    "/workforce/application/wizard/work-history",
  );
}

export function setEmploymentDeclaration(
  hasPreviousEmployment: boolean,
): Promise<WorkHistoryStageView> {
  return workerFetch<WorkHistoryStageView>(
    "/workforce/application/wizard/work-history/declaration",
    { method: "PUT", body: { hasPreviousEmployment } },
  );
}

export function addWorkHistoryEntry(
  input: WorkHistoryEntryInput,
): Promise<WorkHistoryStageView> {
  return workerFetch<WorkHistoryStageView>(
    "/workforce/application/wizard/work-history",
    { method: "POST", body: input },
  );
}

export function updateWorkHistoryEntry(
  entryId: string,
  input: WorkHistoryEntryInput,
): Promise<WorkHistoryStageView> {
  return workerFetch<WorkHistoryStageView>(
    `/workforce/application/wizard/work-history/${encodeURIComponent(entryId)}`,
    { method: "PUT", body: input },
  );
}

export function removeWorkHistoryEntry(
  entryId: string,
): Promise<WorkHistoryStageView> {
  return workerFetch<WorkHistoryStageView>(
    `/workforce/application/wizard/work-history/${encodeURIComponent(entryId)}`,
    { method: "DELETE" },
  );
}

/* -------------------------------------------------------------------------- */
/*  Certifications                                                             */
/* -------------------------------------------------------------------------- */

export type CertificationOption = {
  id: string;
  name: string;
  category: string | null;
};

export type CertificationsStageView = {
  hasCertifications: boolean | null;
  selections: { id: string; name: string | null; category: string | null }[];
};

export function getCertificationRegistry(): Promise<CertificationOption[]> {
  return workerFetch<CertificationOption[]>(
    "/workforce/application/wizard/certifications/registry",
  );
}

export function getCertifications(): Promise<CertificationsStageView> {
  return workerFetch<CertificationsStageView>(
    "/workforce/application/wizard/certifications",
  );
}

export function setCertificationsDeclaration(
  hasCertifications: boolean,
): Promise<CertificationsStageView> {
  return workerFetch<CertificationsStageView>(
    "/workforce/application/wizard/certifications/declaration",
    { method: "PUT", body: { hasCertifications } },
  );
}

export function saveCertifications(
  certificationTypeIds: string[],
): Promise<CertificationsStageView> {
  return workerFetch<CertificationsStageView>(
    "/workforce/application/wizard/certifications",
    { method: "PUT", body: { certificationTypeIds } },
  );
}

/* -------------------------------------------------------------------------- */
/*  Tools & PPE (one backend stage, two worker screens)                        */
/* -------------------------------------------------------------------------- */

export type RegistryOption = { id: string; name: string };

export type ToolsPpeStageView = {
  hasTools: boolean | null;
  tools: { id: string; name: string | null }[];
  hasPpe: boolean | null;
  ppe: { id: string; name: string | null }[];
};

export function getToolRegistry(): Promise<RegistryOption[]> {
  return workerFetch<RegistryOption[]>(
    "/workforce/application/wizard/tools-ppe/tools/registry",
  );
}

export function getPpeRegistry(): Promise<RegistryOption[]> {
  return workerFetch<RegistryOption[]>(
    "/workforce/application/wizard/tools-ppe/ppe/registry",
  );
}

export function getToolsPpe(): Promise<ToolsPpeStageView> {
  return workerFetch<ToolsPpeStageView>(
    "/workforce/application/wizard/tools-ppe",
  );
}

export function setToolsDeclaration(
  hasTools: boolean,
): Promise<ToolsPpeStageView> {
  return workerFetch<ToolsPpeStageView>(
    "/workforce/application/wizard/tools-ppe/tools/declaration",
    { method: "PUT", body: { hasTools } },
  );
}

export function saveTools(toolTypeIds: string[]): Promise<ToolsPpeStageView> {
  return workerFetch<ToolsPpeStageView>(
    "/workforce/application/wizard/tools-ppe/tools",
    { method: "PUT", body: { toolTypeIds } },
  );
}

export function setPpeDeclaration(hasPpe: boolean): Promise<ToolsPpeStageView> {
  return workerFetch<ToolsPpeStageView>(
    "/workforce/application/wizard/tools-ppe/ppe/declaration",
    { method: "PUT", body: { hasPpe } },
  );
}

export function savePpe(ppeTypeIds: string[]): Promise<ToolsPpeStageView> {
  return workerFetch<ToolsPpeStageView>(
    "/workforce/application/wizard/tools-ppe/ppe",
    { method: "PUT", body: { ppeTypeIds } },
  );
}

/* -------------------------------------------------------------------------- */
/*  Military / Union / Legal (one backend stage, three worker screens)         */
/* -------------------------------------------------------------------------- */

export const MILITARY_BRANCHES = [
  { value: "ARMY", label: "Army" },
  { value: "NAVY", label: "Navy" },
  { value: "AIR_FORCE", label: "Air Force" },
  { value: "MARINE_CORPS", label: "Marine Corps" },
  { value: "COAST_GUARD", label: "Coast Guard" },
  { value: "SPACE_FORCE", label: "Space Force" },
] as const;

export const MILITARY_SERVICE_COMPONENTS = [
  { value: "ACTIVE_DUTY", label: "Active Duty" },
  { value: "VETERAN_SEPARATED", label: "Veteran / Separated" },
  { value: "RESERVE", label: "Reserve" },
  { value: "NATIONAL_GUARD", label: "National Guard" },
] as const;

export type MilitaryBranch = (typeof MILITARY_BRANCHES)[number]["value"];
export type MilitaryServiceComponent =
  (typeof MILITARY_SERVICE_COMPONENTS)[number]["value"];

export type AcknowledgmentView = {
  key: string;
  version: string;
  text: string;
  accepted: boolean;
  acceptedAt: string | null;
};

export type LegalStageView = {
  military: {
    hasMilitaryService: boolean | null;
    branch: MilitaryBranch | null;
    branchLabel: string | null;
    serviceComponent: MilitaryServiceComponent | null;
    serviceComponentLabel: string | null;
    serviceStartDate: string | null;
    serviceEndDate: string | null;
    occupationalSpecialty: string | null;
  };
  unionAffiliation: {
    isUnionAffiliated: boolean | null;
    unionName: string | null;
    localNumber: string | null;
  };
  acknowledgments: AcknowledgmentView[];
  allAcknowledgmentsAccepted: boolean;
};

export function getLegal(): Promise<LegalStageView> {
  return workerFetch<LegalStageView>("/workforce/application/wizard/legal");
}

export function setMilitaryDeclaration(
  hasMilitaryService: boolean,
): Promise<LegalStageView> {
  return workerFetch<LegalStageView>(
    "/workforce/application/wizard/legal/military/declaration",
    { method: "PUT", body: { hasMilitaryService } },
  );
}

export function saveMilitary(input: {
  branch: MilitaryBranch;
  serviceComponent: MilitaryServiceComponent;
  serviceStartDate?: string;
  serviceEndDate?: string;
  occupationalSpecialty?: string;
}): Promise<LegalStageView> {
  return workerFetch<LegalStageView>(
    "/workforce/application/wizard/legal/military",
    { method: "PUT", body: input },
  );
}

/** C4C required union-affiliation question. Captured verbatim; no policy applied. */
export function saveUnionAffiliation(input: {
  isUnionAffiliated: boolean;
  unionName?: string;
  localNumber?: string;
}): Promise<LegalStageView> {
  return workerFetch<LegalStageView>(
    "/workforce/application/wizard/legal/union",
    { method: "PUT", body: input },
  );
}

export function acceptAcknowledgments(
  acceptedKeys: string[],
): Promise<LegalStageView> {
  return workerFetch<LegalStageView>(
    "/workforce/application/wizard/legal/acknowledgments",
    { method: "PUT", body: { acceptedKeys } },
  );
}

/* -------------------------------------------------------------------------- */
/*  Review / Submit / Receipt                                                  */
/* -------------------------------------------------------------------------- */

export type IncompleteStageView = {
  stage: WorkforceApplicationStage;
  title: string;
};

export type FinalReviewView = {
  applicationSessionId: string;
  candidateId: string | null;
  status: "DRAFT" | "SUBMITTED";
  requestedIntent: { category: string; recognized: boolean } | null;
  submittedAt: string | null;
  submissionReceiptId: string | null;
  identity: IdentityStageView;
  primaryTrade: PrimaryTradeStageView;
  workHistory: WorkHistoryStageView;
  certifications: CertificationsStageView;
  toolsPpe: ToolsPpeStageView;
  legal: LegalStageView;
  readyToSubmit: boolean;
  incompleteStages: IncompleteStageView[];
};

export type SubmissionReceipt = {
  submitted: boolean;
  status: "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
  submissionReceiptId: string | null;
  message: string;
};

export function getReview(): Promise<FinalReviewView> {
  return workerFetch<FinalReviewView>("/workforce/application/wizard/review");
}

export function submitApplication(): Promise<SubmissionReceipt> {
  return workerFetch<SubmissionReceipt>("/workforce/application/wizard/submit", {
    method: "POST",
  });
}

export function getReceipt(): Promise<SubmissionReceipt> {
  return workerFetch<SubmissionReceipt>("/workforce/application/wizard/receipt");
}
