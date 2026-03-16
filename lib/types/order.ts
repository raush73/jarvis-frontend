// ---------------------------------------------------------------------------
// Order Types — minimal frontend types matching backend DTO / response shapes
// ---------------------------------------------------------------------------

export type RequirementPriority = "REQUIRED" | "PREFERRED" | "OPTIONAL";
export type RequirementEnforcement = "FLAG" | "FILTER";

// -- Nested requirement payloads (create) --

export interface CreatePpeRequirement {
  ppeTypeId: string;
  priority?: RequirementPriority;
  enforcement?: RequirementEnforcement;
  notes?: string;
}

export interface CreateToolRequirement {
  toolId: string;
  priority?: RequirementPriority;
  enforcement?: RequirementEnforcement;
  notes?: string;
}

export interface CreateCertRequirement {
  certTypeId: string;
  priority?: RequirementPriority;
  enforcement?: RequirementEnforcement;
  isTrainable?: boolean;
  notes?: string;
}

export interface CreateComplianceRequirement {
  requirementTypeId: string;
  variantId?: string;
  notes?: string;
}

// -- Trade requirement payload (create) --

export interface CreateTradeRequirement {
  tradeId: string;
  basePayRate?: string;
  baseBillRate?: string;
  requestedHeadcount?: number;
  startDate?: string;
  expectedEndDate?: string;
  notes?: string;
  supervisorOverride?: boolean;
  supervisorContactId?: string | null;
  ppeRequirements?: CreatePpeRequirement[];
  toolRequirements?: CreateToolRequirement[];
  certRequirements?: CreateCertRequirement[];
  complianceRequirements?: CreateComplianceRequirement[];
}

// -- Job order contact payload (create) --

export interface CreateJobOrderContactPayload {
  customerContactId: string;
  role: string;
  isPrimary?: boolean;
}

// -- Create order payload --

export interface CreateOrderPayload {
  title?: string;
  customerId: string;
  sdPayDeltaRate?: number;
  sdBillDeltaRate?: number;
  commissionPlanId?: string;
  jobSiteName?: string;
  jobSiteAddress1?: string;
  jobSiteAddress2?: string;
  jobSiteCity?: string;
  jobSiteState?: string;
  jobSiteZip?: string;
  jobSiteNotes?: string;
  contacts?: CreateJobOrderContactPayload[];
  tradeRequirements?: CreateTradeRequirement[];
}

export type ApprovalStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";

// -- GET /orders list item --

export interface OrderListItem {
  id: string;
  title: string | null;
  status: string;
  approvalStatus?: ApprovalStatus;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
}

// -- Create order response (from POST /orders) --

export interface CreateOrderResponse {
  id: string;
  title: string | null;
  status: string;
  customerId: string;
  sdPayDeltaRate: number | null;
  sdBillDeltaRate: number | null;
  commissionPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

// -- GET /orders/:id response shapes --

export interface OrderPpeRequirementResponse {
  id: string;
  ppeTypeId: string;
  ppeType: { id: string; name: string };
  priority: string;
  enforcement: string;
  notes: string | null;
}

export interface OrderToolRequirementResponse {
  id: string;
  toolId: string;
  tool: { id: string; name: string };
  priority: string;
  enforcement: string;
  notes: string | null;
}

export interface OrderCertRequirementResponse {
  id: string;
  certTypeId: string;
  certType: { id: string; name: string; code: string };
  priority: string;
  enforcement: string;
  isTrainable: boolean;
  notes: string | null;
}

export interface OrderComplianceRequirementResponse {
  id: string;
  requirementTypeId: string;
  variantId: string | null;
  requirementType: { id: string; name: string };
  variant: { id: string; name: string } | null;
  notes: string | null;
}

export interface OrderTradeRequirementResponse {
  id: string;
  orderId: string;
  tradeId: string;
  trade: { id: string; name: string };
  priority: string;
  enforcement: string;
  notes: string | null;
  basePayRate: string | null;
  baseBillRate: string | null;
  requestedHeadcount: number | null;
  startDate: string | null;
  expectedEndDate: string | null;
  supervisorOverride: boolean;
  supervisorContactId: string | null;
  supervisorContact?: { id: string; firstName: string; lastName: string } | null;
  assignments: Array<{ id: string; userId: string; status: string; endDate: string | null }>;
  ppeRequirements: OrderPpeRequirementResponse[];
  toolRequirements: OrderToolRequirementResponse[];
  certRequirements: OrderCertRequirementResponse[];
  complianceRequirements: OrderComplianceRequirementResponse[];
}

export interface JobOrderContactResponse {
  id: string;
  contactId: string;
  contactName: string;
  role: string;
  isPrimary: boolean;
}

export interface OrderDetailResponse {
  id: string;
  title: string | null;
  status: string;
  approvalStatus?: ApprovalStatus;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  customerId: string;
  customer: { id: string; name: string };
  jobSiteName?: string | null;
  jobSiteAddress1?: string | null;
  jobSiteAddress2?: string | null;
  jobSiteCity?: string | null;
  jobSiteState?: string | null;
  jobSiteZip?: string | null;
  jobSiteNotes?: string | null;
  jobLocationCode?: string | null;
  jobOrderContacts?: JobOrderContactResponse[];
  tradeRequirements: OrderTradeRequirementResponse[];
  primaryCustomerContactId: string | null;
  primaryCustomerContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    officePhone: string | null;
    cellPhone: string | null;
  } | null;
  sdPayDeltaRate: number | null;
  sdBillDeltaRate: number | null;
  commissionPlanId: string | null;
  commissionPlan: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

// -- Trade list item (for dropdown population) --

export interface TradeListItem {
  id: string;
  name: string;
}

// -- Enforcement display helper --

export const ENFORCEMENT_LABELS: Record<RequirementEnforcement, string> = {
  FILTER: "Block Dispatch",
  FLAG: "Allow Dispatch",
};
