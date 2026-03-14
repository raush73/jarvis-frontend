export interface DispatchAssignment {
  assignmentId: string;
  workerId: string;
  workerName: string | null;
  workerEmail: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface DispatchTradeLine {
  orderTradeRequirementId: string;
  tradeId: string;
  tradeName: string | null;
  requestedHeadcount: number | null;
  startDate: string | null;
  expectedEndDate: string | null;
  assignedCount: number;
  openCount: number;
  dispatchedCount: number;
  onAssignmentCount: number;
  completedCount: number;
  assignments: DispatchAssignment[];
}

export interface DispatchRosterResponse {
  orderId: string;
  tradeLines: DispatchTradeLine[];
}

export interface OrderHeaderResponse {
  id: string;
  status: string;
  customerId: string;
  customer?: { id: string; name: string } | null;
  primaryCustomerContactId?: string | null;
  primaryCustomerContact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    officePhone?: string | null;
    cellPhone?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
