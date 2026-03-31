/**
 * Mock Recruiting Data — Canonical governance-aligned buckets
 *
 * Buckets: OPTED_IN → AWAITING_CANDIDATE_ACTION → MW4H_APPROVED → PRE_DISPATCH → DISPATCHED → CLOSED
 * Customer Approval is a GATE (not a bucket).
 * Trade count semantics: Open / Total Required
 * Open changes ONLY at Dispatch or No-Show
 */

export type Trade = {
  id: string;
  name: string;
  totalRequired: number;
  dispatched: number; // Only dispatched workers reduce "open"
};

export type Certification = {
  id: string;
  name: string;
  verified: boolean;
};

export type ClosedDisposition = 'NOT_SELECTED' | 'REJECTED';

export type AltTradeInfo = {
  tradeName: string;
  accepted: boolean;
  confirmationMethod?: 'PHONE' | 'MAGIC_LINK' | 'APP_NOTIFICATION';
  confirmedAt?: string;
  confirmedByName?: string;
  note?: string;
};

export type CandidateSignals = {
  candidateStatus: 'ACTIVE' | 'INACTIVE' | 'DO_NOT_DISPATCH';
  readiness: 'READY' | 'BLOCKED' | 'PENDING';
  blockers: string[];
  hardGates: {
    certifications: { met: number; total: number };
    compliance: { met: number; total: number };
  };
  softSignals: {
    tools: { met: number; total: number; deferred?: boolean };
    ppe: { met: number; total: number };
    capabilities: { matched: number; total: number };
  };
  availability?: {
    available: boolean;
    reason?: string;
    conflictingOrderId?: string;
  };
};

export type CustomerApprovalStatusType = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type AssignmentInfo = {
  assignmentId: string;
  assignmentStatus: string;
  dispatchedAt: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
};

export type Candidate = {
  id: string;
  candidateId?: string;
  orderTradeRequirementId?: string;
  name: string;
  tradeId: string;
  tradeName: string;
  phone: string;
  email: string;
  distance: number;
  matchConfidence?: number;
  sourceType: 'system' | 'recruiter';
  certifications: Certification[];
  availability: 'available' | 'partial' | 'unavailable';
  dispatchStartDate?: string;
  notes?: string;
  closedDisposition?: ClosedDisposition;
  originalTradeName?: string;
  altTrade?: AltTradeInfo;
  signals?: CandidateSignals;
  customerApprovalStatus?: CustomerApprovalStatusType;
  selectedForDispatch?: boolean;
  selectedAt?: string;
  assignment?: AssignmentInfo;
};

export type BucketId =
  | 'OPTED_IN'
  | 'AWAITING_CANDIDATE_ACTION'
  | 'MW4H_APPROVED'
  | 'PRE_DISPATCH'
  | 'DISPATCHED'
  | 'CLOSED';

export type Bucket = {
  id: BucketId;
  name: string;
  description: string;
  candidates: Candidate[];
  isConditional?: boolean; // true for Customer-Held
};

export type Order = {
  id: string;
  projectName: string;
  customerName: string;
  location: string;
  startDate: string;
  endDate: string;
  requiresCustomerPreApproval: boolean;
  trades: Trade[];
  buckets: Bucket[];
};

// Mock Trades for the order
const mockTrades: Trade[] = [
  { id: 'trade_elec', name: 'Electrician', totalRequired: 8, dispatched: 3 },
  { id: 'trade_plumb', name: 'Plumber', totalRequired: 4, dispatched: 2 },
  { id: 'trade_hvac', name: 'HVAC Tech', totalRequired: 3, dispatched: 1 },
  { id: 'trade_carp', name: 'Carpenter', totalRequired: 6, dispatched: 2 },
];

// Helper to calculate open slots
export function getOpenSlots(trade: Trade): number {
  return trade.totalRequired - trade.dispatched;
}

// Mock Candidates
const mockCandidates: Record<BucketId, Candidate[]> = {
  CLOSED: [
    {
      id: 'cand_closed_001',
      name: 'Frank Morrison',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 700-1001',
      email: 'frank.m@email.com',
      distance: 19,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_cl1', name: 'Journeyman Electrician', verified: true },
      ],
      availability: 'available',
      closedDisposition: 'NOT_SELECTED',
      originalTradeName: 'Electrician',
    },
    {
      id: 'cand_closed_002',
      name: 'Janet Cooper',
      tradeId: 'trade_plumb',
      tradeName: 'Plumber',
      phone: '(555) 700-1002',
      email: 'janet.c@email.com',
      distance: 28,
      sourceType: 'system',
      matchConfidence: 72,
      certifications: [],
      availability: 'unavailable',
      closedDisposition: 'REJECTED',
      originalTradeName: 'Plumber',
    },
    {
      id: 'cand_closed_003',
      name: 'Gary Simmons',
      tradeId: 'trade_carp',
      tradeName: 'Carpenter',
      phone: '(555) 700-1003',
      email: 'gary.s@email.com',
      distance: 14,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_cl2', name: 'Finish Carpenter', verified: true },
      ],
      availability: 'available',
      closedDisposition: 'NOT_SELECTED',
      originalTradeName: 'Carpenter',
      altTrade: {
        tradeName: 'HVAC Tech',
        accepted: false,
      },
    },
    {
      id: 'cand_closed_004',
      name: 'Susan Price',
      tradeId: 'trade_hvac',
      tradeName: 'HVAC Tech',
      phone: '(555) 700-1004',
      email: 'susan.p@email.com',
      distance: 10,
      sourceType: 'system',
      matchConfidence: 80,
      certifications: [
        { id: 'cert_cl3', name: 'EPA 608 Universal', verified: true },
      ],
      availability: 'available',
      closedDisposition: 'NOT_SELECTED',
      originalTradeName: 'Electrician',
      altTrade: {
        tradeName: 'HVAC Tech',
        accepted: true,
        confirmationMethod: 'PHONE',
        confirmedAt: '2026-02-01T14:30:00Z',
        confirmedByName: 'Mike Recruiter',
        note: 'Worker agreed to HVAC Tech role at adjusted rate',
      },
    },
  ],
  OPTED_IN: [
    {
      id: 'cand_001',
      name: 'Marcus Johnson',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 123-4567',
      email: 'marcus.j@email.com',
      distance: 12,
      matchConfidence: 94,
      sourceType: 'system',
      certifications: [
        { id: 'cert_1', name: 'Journeyman Electrician', verified: true },
        { id: 'cert_2', name: 'OSHA 30', verified: true },
      ],
      availability: 'available',
    },
    {
      id: 'cand_002',
      name: 'Sarah Chen',
      tradeId: 'trade_plumb',
      tradeName: 'Plumber',
      phone: '(555) 234-5678',
      email: 'sarah.c@email.com',
      distance: 8,
      matchConfidence: 87,
      sourceType: 'system',
      certifications: [
        { id: 'cert_3', name: 'Master Plumber', verified: true },
      ],
      availability: 'available',
    },
    {
      id: 'cand_003',
      name: 'Derek Williams',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 345-6789',
      email: 'derek.w@email.com',
      distance: 22,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_4', name: 'Apprentice Electrician', verified: true },
      ],
      availability: 'partial',
    },
  ],
  AWAITING_CANDIDATE_ACTION: [
    {
      id: 'cand_004',
      name: 'Elena Rodriguez',
      tradeId: 'trade_hvac',
      tradeName: 'HVAC Tech',
      phone: '(555) 456-7890',
      email: 'elena.r@email.com',
      distance: 15,
      matchConfidence: 91,
      sourceType: 'system',
      certifications: [
        { id: 'cert_5', name: 'EPA 608 Universal', verified: true },
        { id: 'cert_6', name: 'NATE Certified', verified: true },
      ],
      availability: 'available',
    },
    {
      id: 'cand_005',
      name: 'James O\'Brien',
      tradeId: 'trade_carp',
      tradeName: 'Carpenter',
      phone: '(555) 567-8901',
      email: 'james.ob@email.com',
      distance: 5,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_7', name: 'Finish Carpenter', verified: true },
      ],
      availability: 'available',
    },
  ],
  MW4H_APPROVED: [
    {
      id: 'cand_006',
      name: 'Aisha Patel',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 678-9012',
      email: 'aisha.p@email.com',
      distance: 10,
      matchConfidence: 96,
      sourceType: 'system',
      certifications: [
        { id: 'cert_8', name: 'Master Electrician', verified: true },
        { id: 'cert_9', name: 'OSHA 30', verified: true },
        { id: 'cert_10', name: 'First Aid/CPR', verified: true },
      ],
      availability: 'available',
      notes: 'MW4H Approved - Strong references',
    },
    {
      id: 'cand_007',
      name: 'Michael Torres',
      tradeId: 'trade_plumb',
      tradeName: 'Plumber',
      phone: '(555) 789-0123',
      email: 'michael.t@email.com',
      distance: 18,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_11', name: 'Journeyman Plumber', verified: true },
      ],
      availability: 'available',
      notes: 'MW4H Approved',
    },
  ],
  PRE_DISPATCH: [
    {
      id: 'cand_009',
      name: 'Robert Kim',
      tradeId: 'trade_hvac',
      tradeName: 'HVAC Tech',
      phone: '(555) 901-2345',
      email: 'robert.k@email.com',
      distance: 11,
      matchConfidence: 93,
      sourceType: 'system',
      certifications: [
        { id: 'cert_13', name: 'EPA 608 Universal', verified: true },
        { id: 'cert_14', name: 'R-410A Certified', verified: true },
      ],
      availability: 'available',
      notes: 'Ready for dispatch - all certs verified',
    },
    {
      id: 'cand_010',
      name: 'Christina Alvarez',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 012-3456',
      email: 'christina.a@email.com',
      distance: 14,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_15', name: 'Journeyman Electrician', verified: true },
        { id: 'cert_16', name: 'Low Voltage Specialist', verified: true },
      ],
      availability: 'available',
    },
  ],
  DISPATCHED: [
    {
      id: 'cand_011',
      name: 'Thomas Washington',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 111-2222',
      email: 'thomas.w@email.com',
      distance: 9,
      matchConfidence: 98,
      sourceType: 'system',
      certifications: [
        { id: 'cert_17', name: 'Master Electrician', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-03',
    },
    {
      id: 'cand_012',
      name: 'Jessica Park',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 222-3333',
      email: 'jessica.p@email.com',
      distance: 6,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_18', name: 'Journeyman Electrician', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-03',
    },
    {
      id: 'cand_013',
      name: 'David Martinez',
      tradeId: 'trade_elec',
      tradeName: 'Electrician',
      phone: '(555) 333-4444',
      email: 'david.m@email.com',
      distance: 20,
      matchConfidence: 85,
      sourceType: 'system',
      certifications: [
        { id: 'cert_19', name: 'Apprentice Electrician', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-05',
    },
    {
      id: 'cand_014',
      name: 'Amanda Foster',
      tradeId: 'trade_plumb',
      tradeName: 'Plumber',
      phone: '(555) 444-5555',
      email: 'amanda.f@email.com',
      distance: 13,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_20', name: 'Master Plumber', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-03',
    },
    {
      id: 'cand_015',
      name: 'Kevin Nguyen',
      tradeId: 'trade_plumb',
      tradeName: 'Plumber',
      phone: '(555) 555-6666',
      email: 'kevin.n@email.com',
      distance: 4,
      matchConfidence: 92,
      sourceType: 'system',
      certifications: [
        { id: 'cert_21', name: 'Journeyman Plumber', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-04',
    },
    {
      id: 'cand_016',
      name: 'Rachel Green',
      tradeId: 'trade_hvac',
      tradeName: 'HVAC Tech',
      phone: '(555) 666-7777',
      email: 'rachel.g@email.com',
      distance: 16,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_22', name: 'EPA 608 Universal', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-03',
    },
    {
      id: 'cand_017',
      name: 'Brian Lee',
      tradeId: 'trade_carp',
      tradeName: 'Carpenter',
      phone: '(555) 777-8888',
      email: 'brian.l@email.com',
      distance: 8,
      matchConfidence: 88,
      sourceType: 'system',
      certifications: [
        { id: 'cert_23', name: 'Finish Carpenter', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-03',
    },
    {
      id: 'cand_018',
      name: 'Nicole Harris',
      tradeId: 'trade_carp',
      tradeName: 'Carpenter',
      phone: '(555) 888-9999',
      email: 'nicole.h@email.com',
      distance: 11,
      sourceType: 'recruiter',
      certifications: [
        { id: 'cert_24', name: 'Framing Specialist', verified: true },
      ],
      availability: 'available',
      dispatchStartDate: '2026-02-05',
    },
  ],
};

// Bucket definitions — canonical governance-aligned names
const bucketDefinitions: Omit<Bucket, 'candidates'>[] = [
  {
    id: 'OPTED_IN',
    name: 'Opted-In',
    description: 'Candidates who opted in for this specific job',
  },
  {
    id: 'AWAITING_CANDIDATE_ACTION',
    name: 'Awaiting Candidate Action',
    description: 'Worker-blocked: docs, certs, reconfirm needed',
  },
  {
    id: 'MW4H_APPROVED',
    name: 'MW4H Approved',
    description: 'Approved candidates ready for consideration',
  },
  {
    id: 'PRE_DISPATCH',
    name: 'Pre-Dispatch',
    description: 'Ready for dispatch assignment',
  },
  {
    id: 'DISPATCHED',
    name: 'Dispatched',
    description: 'Actively dispatched to job site',
  },
  {
    id: 'CLOSED',
    name: 'Closed',
    description: 'No longer in active recruiting flow',
  },
];

// Assemble mock order
export const mockOrder: Order = {
  id: 'ord_001',
  projectName: 'Metro Center Tower Renovation',
  customerName: 'Apex Construction Group',
  location: '1250 Commerce Blvd, Denver, CO 80202',
  startDate: '2026-02-03',
  endDate: '2026-04-15',
  requiresCustomerPreApproval: true,
  trades: mockTrades,
  buckets: bucketDefinitions.map(def => ({
    ...def,
    candidates: mockCandidates[def.id],
  })),
};

// Mock employee search results (for manual recruiter search)
export const mockSearchResults: Candidate[] = [
  {
    id: 'search_001',
    name: 'Anthony Blake',
    tradeId: 'trade_elec',
    tradeName: 'Electrician',
    phone: '(555) 100-2001',
    email: 'anthony.b@email.com',
    distance: 25,
    sourceType: 'recruiter',
    certifications: [
      { id: 'cert_s1', name: 'Journeyman Electrician', verified: true },
    ],
    availability: 'available',
  },
  {
    id: 'search_002',
    name: 'Maria Santos',
    tradeId: 'trade_plumb',
    tradeName: 'Plumber',
    phone: '(555) 100-2002',
    email: 'maria.s@email.com',
    distance: 30,
    sourceType: 'recruiter',
    certifications: [
      { id: 'cert_s2', name: 'Apprentice Plumber', verified: true },
    ],
    availability: 'partial',
  },
  {
    id: 'search_003',
    name: 'William Chen',
    tradeId: 'trade_hvac',
    tradeName: 'HVAC Tech',
    phone: '(555) 100-2003',
    email: 'william.c@email.com',
    distance: 18,
    sourceType: 'recruiter',
    certifications: [
      { id: 'cert_s3', name: 'EPA 608 Universal', verified: true },
      { id: 'cert_s4', name: 'NATE Certified', verified: false },
    ],
    availability: 'available',
  },
  {
    id: 'search_004',
    name: 'Patricia Moore',
    tradeId: 'trade_carp',
    tradeName: 'Carpenter',
    phone: '(555) 100-2004',
    email: 'patricia.m@email.com',
    distance: 12,
    sourceType: 'recruiter',
    certifications: [
      { id: 'cert_s5', name: 'Finish Carpenter', verified: true },
    ],
    availability: 'available',
  },
];

// Mock Jarvis system match results
export const mockJarvisMatches: Candidate[] = [
  {
    id: 'jarvis_001',
    name: 'Steven Wright',
    tradeId: 'trade_elec',
    tradeName: 'Electrician',
    phone: '(555) 200-3001',
    email: 'steven.w@email.com',
    distance: 8,
    matchConfidence: 97,
    sourceType: 'system',
    certifications: [
      { id: 'cert_j1', name: 'Master Electrician', verified: true },
      { id: 'cert_j2', name: 'OSHA 30', verified: true },
    ],
    availability: 'available',
  },
  {
    id: 'jarvis_002',
    name: 'Laura Thompson',
    tradeId: 'trade_plumb',
    tradeName: 'Plumber',
    phone: '(555) 200-3002',
    email: 'laura.t@email.com',
    distance: 14,
    matchConfidence: 91,
    sourceType: 'system',
    certifications: [
      { id: 'cert_j3', name: 'Journeyman Plumber', verified: true },
    ],
    availability: 'available',
  },
  {
    id: 'jarvis_003',
    name: 'Daniel Garcia',
    tradeId: 'trade_carp',
    tradeName: 'Carpenter',
    phone: '(555) 200-3003',
    email: 'daniel.g@email.com',
    distance: 22,
    matchConfidence: 84,
    sourceType: 'system',
    certifications: [
      { id: 'cert_j4', name: 'Framing Specialist', verified: true },
    ],
    availability: 'partial',
  },
];

// Helper: Get trade breakdown for a bucket
export function getBucketTradeBreakdown(
  bucket: Bucket,
  trades: Trade[]
): { trade: Trade; countInBucket: number }[] {
  return trades.map(trade => ({
    trade,
    countInBucket: bucket.candidates.filter(c => c.tradeId === trade.id).length,
  }));
}

// Helper: Check if trade is overbooked in a bucket
export function isTradeOverbooked(
  countInBucket: number,
  openSlots: number
): boolean {
  return countInBucket > openSlots;
}

