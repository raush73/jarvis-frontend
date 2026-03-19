"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { formatPhone } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import type { OrderListItem } from "@/lib/types/order";
import { getOrderPhase, getPhaseLabel, getPhaseBadgeClass } from "@/lib/order-lifecycle";
import { HEALTH_STATUS_COLORS } from "@/lib/constants/margin-health";

// Trade row type for labor plan
type TradeRow = {
  trade: string;
  headcount: number;
  hours: number;
  basePay: number;
  burdenedPay: number;
  billRate: number;
  gmPerHr: number;
  gmPct: number;
  health: "Good" | "Watch" | "Risk";
  otMultiplier?: number;
};

// Quote type with full data
type Quote = {
  id: string;
  title: string;
  status: string;
  startDate: string;
  expiresAt: string;
  salespersonName: string;
  hasEconomicsSnapshot: boolean;
  notes: string;
  trades: TradeRow[];
  modifiers: {
    perDiem: number;
    travel: number;
    bonuses: number;
  };
};

// Draft quote for form editing
type DraftQuote = {
  id: string;
  title: string;
  status: string;
  startDate: string;
  expiresAt: string;
  salespersonName: string;
  notes: string;
  trades: TradeRow[];
  modifiers: {
    perDiem: number;
    travel: number;
    bonuses: number;
  };
};

// Mock customer details data
const MOCK_CUSTOMER_DETAILS: Record<string, {
  id: string;
  name: string;
  status: string;
  city: string;
  state: string;
  address: string;
  mainPhone: string;
  website: string;
  ownerSalespersonName: string;
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    email: string;
    officePhone: string;
    cellPhone: string;
    notes: string;
    isPrimary: boolean;
  }>;
  tools: string[];
  ppe: string[];
  orders: Array<{
    id: string;
    site: string;
    startDate: string;
    status: string;
  }>;
  quotes: Quote[];
}> = {
  "CUST-001": {
    id: "CUST-001",
    name: "Turner Construction",
    status: "Active",
    city: "Los Angeles",
    state: "CA",
    address: "450 S Grand Ave, Suite 2100, Los Angeles, CA 90071",
    mainPhone: "(213) 555-1000",
    website: "https://turnerconstruction.com",
    ownerSalespersonName: "Jordan Miles",
    contacts: [
      {
        id: "CON-001",
        name: "Michael Torres",
        title: "VP of Operations",
        email: "mtorres@turnerconstruction.com",
        officePhone: "(213) 555-1001",
        cellPhone: "(310) 555-2001",
        notes: "Prefers email communication",
        isPrimary: true,
      },
      {
        id: "CON-002",
        name: "Lisa Chen",
        title: "Project Director",
        email: "lchen@turnerconstruction.com",
        officePhone: "(213) 555-1002",
        cellPhone: "(310) 555-2002",
        notes: "",
        isPrimary: false,
      },
      {
        id: "CON-003",
        name: "Robert Williams",
        title: "Safety Manager",
        email: "rwilliams@turnerconstruction.com",
        officePhone: "(213) 555-1003",
        cellPhone: "(310) 555-2003",
        notes: "Contact for safety certifications",
        isPrimary: false,
      },
      {
        id: "CON-004",
        name: "Amanda Foster",
        title: "Procurement Specialist",
        email: "afoster@turnerconstruction.com",
        officePhone: "(213) 555-1004",
        cellPhone: "(310) 555-2004",
        notes: "Handles equipment requests",
        isPrimary: false,
      },
    ],
    tools: ["Torque Wrenches (Calibrated)", "Laser Alignment Kits", "Rigging Equipment", "Dial Indicators", "Portable Crane (10-ton)"],
    ppe: ["Hard Hat (ANSI Type II)", "Safety Glasses (ANSI Z87.1)", "Steel-Toe Boots", "Hi-Vis Vest (Class 3)", "Cut-Resistant Gloves", "Fall Protection Harness"],
    orders: [
      { id: "ORD-2024-001", site: "Downtown Tower — Los Angeles, CA", startDate: "2024-02-15", status: "Active" },
      { id: "ORD-2024-010", site: "Westside Medical Center — Santa Monica, CA", startDate: "2024-04-01", status: "Pending" },
    ],
    quotes: [
      {
        id: "QTE-2024-003",
        title: "Downtown Tower Phase 2 — Millwright Services",
        status: "Sent",
        startDate: "2024-06-01",
        expiresAt: "2024-07-01",
        salespersonName: "Jordan Miles",
        hasEconomicsSnapshot: true,
        notes: "Priority project for Q2",
        trades: [
          { trade: "Millwright", headcount: 2, hours: 80, basePay: 32, burdenedPay: 38, billRate: 58, gmPerHr: 20, gmPct: 34.5, health: "Good", otMultiplier: 1.5 },
          { trade: "Electrician", headcount: 1, hours: 40, basePay: 36, burdenedPay: 42.5, billRate: 62, gmPerHr: 19.5, gmPct: 31.5, health: "Watch", otMultiplier: 1.5 },
        ],
        modifiers: { perDiem: 125, travel: 0.58, bonuses: 2 },
      },
      {
        id: "QTE-2024-004",
        title: "Westside Medical — Equipment Install",
        status: "Draft",
        startDate: "2024-07-15",
        expiresAt: "2024-08-15",
        salespersonName: "Jordan Miles",
        hasEconomicsSnapshot: false,
        notes: "",
        trades: [
          { trade: "Millwright", headcount: 3, hours: 120, basePay: 32, burdenedPay: 38, billRate: 58, gmPerHr: 20, gmPct: 34.5, health: "Good", otMultiplier: 1.5 },
        ],
        modifiers: { perDiem: 100, travel: 0.58, bonuses: 0 },
      },
      {
        id: "QTE-2024-005",
        title: "LAX Terminal Expansion — Rigging Support",
        status: "Accepted",
        startDate: "2024-05-01",
        expiresAt: "2024-06-01",
        salespersonName: "Sarah Chen",
        hasEconomicsSnapshot: true,
        notes: "Long-term engagement potential",
        trades: [
          { trade: "Rigger", headcount: 4, hours: 160, basePay: 30, burdenedPay: 36, billRate: 55, gmPerHr: 19, gmPct: 34.5, health: "Good", otMultiplier: 1.5 },
          { trade: "Crane Operator", headcount: 2, hours: 80, basePay: 40, burdenedPay: 48, billRate: 72, gmPerHr: 24, gmPct: 33.3, health: "Good", otMultiplier: 1.5 },
        ],
        modifiers: { perDiem: 150, travel: 0.65, bonuses: 5 },
      },
    ],
  },
};

// Default fallback for any customer ID
const DEFAULT_CUSTOMER = {
  id: "CUST-XXX",
  name: "Sample Customer",
  status: "Active",
  city: "City",
  state: "ST",
  address: "123 Main St, Suite 100, City, ST 00000",
  mainPhone: "(000) 000-0000",
  website: "https://example.com",
  ownerSalespersonName: "Sales Rep",
  contacts: [
    {
      id: "CON-001",
      name: "John Smith",
      title: "Operations Manager",
      email: "jsmith@example.com",
      officePhone: "(000) 000-0001",
      cellPhone: "(000) 000-1001",
      notes: "Primary point of contact",
      isPrimary: true,
    },
    {
      id: "CON-002",
      name: "Jane Doe",
      title: "Project Manager",
      email: "jdoe@example.com",
      officePhone: "(000) 000-0002",
      cellPhone: "(000) 000-1002",
      notes: "",
      isPrimary: false,
    },
  ],
  tools: ["Standard Tool Kit", "Measuring Equipment"],
  ppe: ["Hard Hat", "Safety Glasses", "Steel-Toe Boots"],
  orders: [
    { id: "ORD-2024-001", site: "Sample Site — City, ST", startDate: "2024-03-01", status: "Active" },
  ],
  quotes: [
    {
      id: "QTE-2024-001",
      title: "Sample Quote — Millwright Services",
      status: "Draft",
      startDate: "2024-04-01",
      expiresAt: "2024-05-01",
      salespersonName: "Sales Rep",
      hasEconomicsSnapshot: false,
      notes: "",
      trades: [
        { trade: "Millwright", headcount: 1, hours: 40, basePay: 30, burdenedPay: 36, billRate: 55, gmPerHr: 19, gmPct: 34.5, health: "Good" as const, otMultiplier: 1.5 },
      ],
      modifiers: { perDiem: 100, travel: 0.58, bonuses: 0 },
    },
  ],
};

// Available trades for dropdown
const AVAILABLE_TRADES = [
  "Millwright",
  "Electrician",
  "Pipefitter",
  "Welder",
  "Rigger",
  "Crane Operator",
  "HVAC Technician",
  "Ironworker",
  "Carpenter",
  "Plumber",
];

// OT Multiplier minimum value
const OT_MULTIPLIER_MIN = 1.47;
const OT_MULTIPLIER_DEFAULT = 1.5;

type TabKey = "contacts" | "tools" | "toolsByTrade" | "ppe" | "orders" | "quotes" | "invoices";

// Tool list item shape (UI-only, trade-scoped)
type ToolLike = { id: string; name: string; notes: string };

// CustomerToolType API types (Capsule 2 persistence)
type CustomerToolTypeItem = {
  id: string;
  isDefault: boolean;
  notes: string | null;
  toolType: { id: string; name: string; isActive: boolean };
};
type CustomerToolTrade = {
  trade: { id: string; name: string };
  items: CustomerToolTypeItem[];
};

// Base mock tools per trade (read-only; do not mutate)
const MOCK_TOOLS_BY_TRADE: Record<string, string[]> = {
  Millwright: ["Torque Wrenches (Calibrated)", "Laser Alignment Kits", "Rigging Equipment", "Dial Indicators", "Portable Crane (10-ton)"],
  Electrician: ["Multimeter", "Wire Strippers", "Fish Tape"],
  Pipefitter: ["Pipe Threader", "Level", "Tape Measure"],
  Welder: ["Welding Machine", "Grinder", "Clamps"],
  Rigger: ["Slings", "Shackles", "Spreader Bar"],
  "Crane Operator": ["Radio", "Signal Flags"],
  "HVAC Technician": ["Manifold Gauge Set", "Vacuum Pump", "Leak Detector"],
  Ironworker: ["Spud Wrench", "Bull Pin", "Connector"],
  Carpenter: ["Circular Saw", "Drill", "Level"],
  Plumber: ["Pipe Wrench", "Snake", "Torch"],
};
type QuoteMode = "view" | "create" | "edit";

// Helper to generate a new quote ID
function generateQuoteId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 900) + 100;
  return `QTE-${year}-${num}`;
}

// Helper to generate a new order ID
function generateOrderId(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 900) + 100;
  return `ORD-${year}-${num}`;
}

// Helper to get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Helper to get date 30 days from now
function getExpirationDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

// Create empty draft quote
function createEmptyDraft(salesperson: string): DraftQuote {
  return {
    id: generateQuoteId(),
    title: "",
    status: "Draft",
    startDate: getTodayDate(),
    expiresAt: getExpirationDate(),
    salespersonName: salesperson,
    notes: "",
    trades: [
      { trade: "Millwright", headcount: 1, hours: 40, basePay: 30, burdenedPay: 36, billRate: 55, gmPerHr: 19, gmPct: 34.5, health: "Good", otMultiplier: OT_MULTIPLIER_DEFAULT },
    ],
    modifiers: { perDiem: 100, travel: 0.58, bonuses: 0 },
  };
}

// Create draft from existing quote
function createDraftFromQuote(quote: Quote): DraftQuote {
  return {
    id: quote.id,
    title: quote.title,
    status: quote.status,
    startDate: quote.startDate,
    expiresAt: quote.expiresAt,
    salespersonName: quote.salespersonName,
    notes: quote.notes,
    trades: quote.trades.map((t) => ({ ...t, otMultiplier: t.otMultiplier ?? OT_MULTIPLIER_DEFAULT })),
    modifiers: { ...quote.modifiers },
  };
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;


  const [toolNameById, setToolNameById] = useState<Record<string, string>>({});

  // Tools dictionary (id -> name) for inline summary on "Tools [by trade]"
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cats = await apiFetch<any[]>("/tool-categories?activeOnly=true");
        const map: Record<string, string> = {};

        for (const c of cats) {
          const tools = await apiFetch<any[]>(
            `/tools?activeOnly=true&categoryId=${c.id}`
          );
          for (const t of tools) {
            if (t?.id && t?.name) map[t.id] = (t.name ?? t.label ?? t.displayName ?? t.title ?? t.toolName ?? "").toString();
          }
        }

        if (!cancelled) setToolNameById(map);
      } catch (e) {
        if (!cancelled) setToolNameById({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerError, setHeaderError] = useState("");
  const [liveCustomer, setLiveCustomer] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setHeaderLoading(true);
      setHeaderError("");
      try {
        const data = await apiFetch<any>(`/customers/${customerId}`);
        if (!alive) return;
        setLiveCustomer(data);
      } catch (e: any) {
        if (!alive) return;
        setHeaderError(e?.message ?? "Failed to load customer.");
      } finally {
        if (alive) setHeaderLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  const [activeTab, setActiveTab] = useState<TabKey>("contacts");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showInternalTotals, setShowInternalTotals] = useState(false);

  // Customer-level approval toggle (UI-only, non-persistent)
  const [customerApprovalRequired, setCustomerApprovalRequired] = useState(true);

  // Get base customer data
  const baseCustomer = MOCK_CUSTOMER_DETAILS[customerId] || { ...DEFAULT_CUSTOMER, id: customerId };

  // In-memory quotes state (initialized from mock data)
  const [quotes, setQuotes] = useState<Quote[]>(baseCustomer.quotes);

  // Quote form mode and draft
  const [mode, setMode] = useState<QuoteMode>("view");
  const [draftQuote, setDraftQuote] = useState<DraftQuote | null>(null);

  // UI-only contacts state (never initialized from base customer data)
  const [uiContacts, setUiContacts] = useState<Array<{
    id: string;
    name: string;
    title: string;
    email: string;
    officePhone: string;
    cellPhone: string;
    notes: string;
    isPrimary: boolean;
  }>>([]);

  // UI overlays for base/mock contacts (edits and deletes without mutating source)
  const [uiContactOverrides, setUiContactOverrides] = useState<Record<string, {
    id: string;
    name: string;
    title: string;
    email: string;
    officePhone: string;
    cellPhone: string;
    notes: string;
    isPrimary: boolean;
  }>>({});
  const [uiContactHiddenIds, setUiContactHiddenIds] = useState<Set<string>>(new Set());

  // UI-only tools state: trade-keyed (canonical model)
  const [uiToolsByTrade, setUiToolsByTrade] = useState<Record<string, ToolLike[]>>({});
  const [uiToolOverridesByTrade, setUiToolOverridesByTrade] = useState<Record<string, Record<string, ToolLike>>>({});
  const [uiToolHiddenIdsByTrade, setUiToolHiddenIdsByTrade] = useState<Record<string, Set<string>>>({});
  // UI-only default tool selection: trade-keyed (tools marked as default baseline for that trade)
  const [uiToolDefaultIdsByTrade, setUiToolDefaultIdsByTrade] = useState<Record<string, Set<string>>>({});

  // CustomerToolType API state (persisted — Capsule 2)
  const [customerToolTrades, setCustomerToolTrades] = useState<CustomerToolTrade[]>([]);
  const [customerToolsLoaded, setCustomerToolsLoaded] = useState(false);

  // Tool Types dictionary + Customer Trade Baselines (Layer 2, Phase 1 — read-only)
  const [toolTypes, setToolTypes] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const [baselineTrades, setBaselineTrades] = useState<Array<{ id: string; name: string }>>([]);
  const [customerTradeBaselines, setCustomerTradeBaselines] = useState<Record<string, string[]>>({});
  const [customerPpeBaselines, setCustomerPpeBaselines] = useState<Record<string, string[]>>({});

  // PPE dictionary (Layer 1: Admin PPE types loaded from backend)
  const [ppeTypes, setPpeTypes] = useState<Array<{ id: string; name: string; active?: boolean }>>([]);
  const [ppeTypesLoaded, setPpeTypesLoaded] = useState(false);

  // Customer PPE requirements (Layer 2: persisted via backend)
  const [customerPpeReqs, setCustomerPpeReqs] = useState<Array<{
    id: string;
    ppeTypeId: string;
    notes: string | null;
    ppeType?: { id: string; name: string };
  }>>([]);
  const [customerPpeLoaded, setCustomerPpeLoaded] = useState(false);

  const loadCustomerPpeReqs = async () => {
    try {
      const data = await apiFetch<any>(`/customers/${customerId}/ppe-baseline`);
      setCustomerPpeReqs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Failed to load customer PPE requirements:", e);
      setCustomerPpeReqs([]);
    } finally {
      setCustomerPpeLoaded(true);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<Array<{ id: string; name: string; active?: boolean }>>("/ppe-types?activeOnly=true");
        if (!alive) return;
        if (Array.isArray(data)) {
          setPpeTypes(data);
        } else {
          setPpeTypes([]);
        }
      } catch (e: any) {
        console.error("Failed to load PPE types:", e);
        if (!alive) return;
        setPpeTypes([]);
      } finally {
        if (alive) setPpeTypesLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    loadCustomerPpeReqs();
  }, [customerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tt, tr] = await Promise.all([
          apiFetch<Array<{ id: string; name: string; isActive: boolean }>>("/tool-types"),
          apiFetch<Array<{ id: string; name: string }>>("/trades"),
        ]);
        if (!alive) return;
        setToolTypes(tt ?? []);
        setBaselineTrades(tr ?? []);
      } catch (e: any) {
        console.error("Failed to load tool types / trades:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<{
          customerId: string;
          baselines: Array<{ tradeId: string; toolIds: string[] }>;
        }>(`/customers/${customerId}/tools-baseline`);
        if (!alive) return;
        const map: Record<string, string[]> = {};
        for (const b of data.baselines ?? []) {
          map[b.tradeId] = b.toolIds;
        }
        setCustomerTradeBaselines(map);
      } catch (e: any) {
        console.error("Failed to load customer trade baselines:", e);
        if (alive) setCustomerTradeBaselines({});
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<{
          customerId: string;
          baselines: Array<{ tradeId: string; ppeIds: string[] }>;
        }>(`/customers/${customerId}/ppe-baseline`);
        if (!alive) return;
        const map: Record<string, string[]> = {};
        for (const b of data.baselines ?? []) {
          map[b.tradeId] = b.ppeIds ?? [];
        }
        setCustomerPpeBaselines(map);
      } catch (e: any) {
        console.error("Failed to load customer PPE baselines:", e);
        if (alive) setCustomerPpeBaselines({});
      }
    })();
    return () => { alive = false; };
  }, [customerId]);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [editingContact, setEditingContact] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    email: string;
    officePhone: string;
    cellPhone: string;
    isUiContact: boolean;
  } | null>(null);
  const [deletingContact, setDeletingContact] = useState<{
    id: string;
    name: string;
    isUiContact: boolean;
  } | null>(null);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    email: "",
    officePhone: "",
    cellPhone: "",
  });

  // Tools modal state (trade-aware)
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [showEditToolModal, setShowEditToolModal] = useState(false);  const [addToolForTrade, setAddToolForTrade] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<{
    id: string;
    name: string;
    notes: string;
    isUiTool: boolean;
    toolTypeId?: string;
    apiTradeId?: string;
  } | null>(null);
  const [editingToolTrade, setEditingToolTrade] = useState<string | null>(null);
  const [deletingTool, setDeletingTool] = useState<{
    id: string;
    name: string;
    isUiTool: boolean;
  } | null>(null);
  const [deletingToolTrade, setDeletingToolTrade] = useState<string | null>(null);
  const [newTool, setNewTool] = useState({
    name: "",
    notes: "",
  });

  // PPE modal state
  const [showAddPpeModal, setShowAddPpeModal] = useState(false);
  const [showEditPpeModal, setShowEditPpeModal] = useState(false);
  const [showDeletePpeModal, setShowDeletePpeModal] = useState(false);
  const [editingPpeItem, setEditingPpeItem] = useState<{
    reqId: string;
    ppeTypeId: string;
    ppeName: string;
    notes: string;
  } | null>(null);
  const [deletingPpeItem, setDeletingPpeItem] = useState<{
    reqId: string;
    ppeTypeId: string;
    ppeName: string;
  } | null>(null);
  const [addPpeTypeId, setAddPpeTypeId] = useState<string>("");
  const [addPpeNotes, setAddPpeNotes] = useState<string>("");
  const [addPpeDuplicateWarning, setAddPpeDuplicateWarning] = useState(false);
  const [ppeSaving, setPpeSaving] = useState(false);
  const [ppeError, setPpeError] = useState("");

  // Real orders fetched from backend
  const [fetchedOrders, setFetchedOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setOrdersLoading(true);
        setOrdersError("");
        const all = await apiFetch<OrderListItem[]>("/orders");
        if (!alive) return;
        setFetchedOrders(
          (all ?? []).filter((o) => o.customerId === customerId)
        );
      } catch (e: unknown) {
        if (!alive) return;
        setOrdersError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        if (alive) setOrdersLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  // Merge customer with in-memory quotes
  const customer = { ...baseCustomer, quotes };
  const liveRegistrySalespersonName = (() => {
    const sp = liveCustomer?.registrySalesperson;
    if (!sp) return null;
    const fullName = typeof sp.fullName === "string" ? sp.fullName.trim() : "";
    const firstLast = `${sp.firstName ?? ""} ${sp.lastName ?? ""}`.trim();
    return fullName || firstLast || sp.email || sp.id || null;
  })();
  const effectiveOwnerName = liveRegistrySalespersonName ?? customer.ownerSalespersonName;

  // Collect UI-only draft orders from sessionStorage
  const draftOrders = useMemo(() => {
    if (typeof window === "undefined") return [];
    const drafts: Array<{
      id: string;
      orderName: string;
      site: string | null;
      status: string;
      __isDraft: true;
    }> = [];
    const prefix = `jp.orderDraft.${customerId}.`;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const raw = sessionStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            drafts.push({
              id: parsed.orderId || key.replace(prefix, ""),
              orderName: parsed.orderName || "Untitled Order",
              site: parsed.site || null,
              status: "Draft (UI-only)",
              __isDraft: true,
            });
          }
        } catch {
          // skip malformed entries
        }
      }
    }
    return drafts;
  }, [customerId]);

  const handleBackToCustomers = () => {
    router.push("/customers");
  };

  const refreshLiveCustomer = async () => {
    try {
      const data = await apiFetch<any>(`/customers/${customerId}`);
      setLiveCustomer(data);
    } catch {
      // silent — read flow is not broken by a refresh failure
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "contacts", label: "Contacts" },
        { key: "toolsByTrade", label: "Tools [by trade]" },
    { key: "ppe", label: "PPE" },
    { key: "orders", label: "Orders" },
    { key: "quotes", label: "Quotes" },
    { key: "invoices", label: "Invoices" },
  ];

  // Quote form handlers
  const handleCreateQuote = () => {
    setDraftQuote(createEmptyDraft(effectiveOwnerName));
    setMode("create");
    setSelectedQuoteId(null);
  };

  const handleEditQuote = (quote: Quote) => {
    setDraftQuote(createDraftFromQuote(quote));
    setMode("edit");
  };

  const handleCancelForm = () => {
    setDraftQuote(null);
    setMode("view");
  };

  // Add Contact handlers
  const handleOpenAddContactModal = () => {
    setNewContact({ firstName: "", lastName: "", jobTitle: "", email: "", officePhone: "", cellPhone: "" });
    setContactError("");
    setShowAddContactModal(true);
  };

  const handleCloseAddContactModal = () => {
    setContactError("");
    setShowAddContactModal(false);
  };

  const handleSaveNewContact = async () => {
    if (!newContact.firstName.trim() || !newContact.lastName.trim()) return;
    setContactSaving(true);
    setContactError("");
    try {
      await apiFetch<any>("/customer-contacts", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          firstName: newContact.firstName.trim(),
          lastName: newContact.lastName.trim(),
          ...(newContact.email.trim() && { email: newContact.email.trim() }),
          ...(newContact.officePhone.trim() && { officePhone: newContact.officePhone.trim() }),
          ...(newContact.cellPhone.trim() && { cellPhone: newContact.cellPhone.trim() }),
          ...(newContact.jobTitle.trim() && { jobTitle: newContact.jobTitle.trim() }),
        }),
      });
      setShowAddContactModal(false);
      await refreshLiveCustomer();
    } catch (e: any) {
      setContactError(e?.message ?? "Failed to save contact.");
    } finally {
      setContactSaving(false);
    }
  };

  // Edit Contact handlers
  const handleOpenEditContactModal = (contact: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    title?: string;
    jobTitle?: string;
    email?: string;
    officePhone?: string;
    cellPhone?: string;
    [key: string]: any;
  }, isUiContact: boolean) => {
    const rawName = (contact.name ?? "").trim();
    const spaceIdx = rawName.indexOf(" ");
    const derivedFirst = spaceIdx > -1 ? rawName.slice(0, spaceIdx) : rawName;
    const derivedLast = spaceIdx > -1 ? rawName.slice(spaceIdx + 1) : "";
    setEditingContact({
      id: contact.id,
      firstName: contact.firstName ?? derivedFirst,
      lastName: contact.lastName ?? derivedLast,
      jobTitle: contact.jobTitle ?? contact.title ?? "",
      email: contact.email ?? "",
      officePhone: contact.officePhone ?? "",
      cellPhone: contact.cellPhone ?? "",
      isUiContact,
    });
    setContactError("");
    setShowEditContactModal(true);
  };

  const handleCloseEditContactModal = () => {
    setContactError("");
    setShowEditContactModal(false);
    setEditingContact(null);
  };

  const handleSaveEditContact = async () => {
    if (!editingContact || !editingContact.firstName.trim() || !editingContact.lastName.trim()) return;
    setContactSaving(true);
    setContactError("");
    try {
      await apiFetch<any>(`/customer-contacts/${editingContact.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: editingContact.firstName.trim(),
          lastName: editingContact.lastName.trim(),
          jobTitle: editingContact.jobTitle.trim() || undefined,
          email: editingContact.email.trim() || undefined,
          officePhone: editingContact.officePhone.trim() || undefined,
          cellPhone: editingContact.cellPhone.trim() || undefined,
        }),
      });
      setShowEditContactModal(false);
      setEditingContact(null);
      await refreshLiveCustomer();
    } catch (e: any) {
      setContactError(e?.message ?? "Failed to save contact.");
    } finally {
      setContactSaving(false);
    }
  };

  // Delete Contact handlers
  const handleOpenDeleteContactModal = (contact: {
    id: string;
    name: string;
  }, isUiContact: boolean) => {
    setDeletingContact({
      id: contact.id,
      name: contact.name,
      isUiContact,
    });
    setContactError("");
    setShowDeleteContactModal(true);
  };

  const handleCloseDeleteContactModal = () => {
    setContactError("");
    setShowDeleteContactModal(false);
    setDeletingContact(null);
  };

  const handleConfirmDeleteContact = async () => {
    if (!deletingContact) return;
    setContactSaving(true);
    setContactError("");
    try {
      await apiFetch<any>(`/customer-contacts/${deletingContact.id}`, {
        method: "DELETE",
      });
      setShowDeleteContactModal(false);
      setDeletingContact(null);
      await refreshLiveCustomer();
    } catch (e: any) {
      setContactError(e?.message ?? "Failed to deactivate contact.");
    } finally {
      setContactSaving(false);
    }
  };

  // Compute rendered contacts: base contacts (filtered, with overrides) + uiContacts
  const renderedContacts = useMemo(() => {
    const liveContactsRaw = Array.isArray(liveCustomer?.contacts)
      ? liveCustomer.contacts
      : null;
    const liveBaseContacts = (liveContactsRaw ?? []).map((c: any) => {
      const first = (c?.firstName ?? "").toString().trim();
      const last = (c?.lastName ?? "").toString().trim();
      const fullName = `${first} ${last}`.trim() || "—";
      return {
        id: (c?.id ?? `LIVE-CONTACT-${fullName}`).toString(),
        firstName: first,
        lastName: last,
        name: fullName,
        jobTitle: (c?.jobTitle ?? "").toString().trim(),
        title: (c?.jobTitle ?? "").toString().trim(),
        email: (c?.email ?? "").toString().trim(),
        officePhone: (c?.officePhone ?? "").toString().trim(),
        cellPhone: (c?.cellPhone ?? "").toString().trim(),
        notes: "",
        isPrimary: false,
      };
    });

    // Start with base contacts, filter out hidden, apply overrides
    const baseSource =
      liveBaseContacts.length > 0 ? liveBaseContacts : baseCustomer.contacts;
    const baseRendered = baseSource
      .filter((c: any) => !uiContactHiddenIds.has(c.id))
      .map((c: any) => ({
        ...c,
        ...(uiContactOverrides[c.id] || {}),
        isUiContact: false,
      }));

    // Append uiContacts
    const uiRendered = uiContacts.map((c) => ({
      ...c,
      isUiContact: true,
    }));

    return [...baseRendered, ...uiRendered];
  }, [
    liveCustomer?.contacts,
    baseCustomer.contacts,
    uiContactHiddenIds,
    uiContactOverrides,
    uiContacts,
  ]);

  // ========== TOOLS HANDLERS ==========

  // Add Tool handlers
  const handleOpenAddToolModal = (tradeId: string) => {
    setAddToolForTrade(tradeId);
    setNewTool({ name: "", notes: "" });
    setShowAddToolModal(true);
  };

  const handleCloseAddToolModal = () => {
    setShowAddToolModal(false);
    setAddToolForTrade(null);
  };

  const handleSaveNewTool = () => {
    if (!newTool.name.trim() || !addToolForTrade) return;
    const tool: ToolLike = {
      id: `UI-TOOL-${Date.now()}`,
      name: newTool.name.trim(),
      notes: newTool.notes.trim(),
    };
    const list = uiToolsByTrade[addToolForTrade] || [];
    setUiToolsByTrade({
      ...uiToolsByTrade,
      [addToolForTrade]: [...list, tool],
    });
    setShowAddToolModal(false);
    setAddToolForTrade(null);
  };

  // Edit Tool handlers (API-backed tools)
  const handleOpenEditToolModal = (item: CustomerToolTypeItem, tradeId: string, tradeName: string) => {
    setEditingTool({
      id: item.id,
      name: item.toolType.name,
      notes: item.notes ?? "",
      isUiTool: false,
      toolTypeId: item.toolType.id,
      apiTradeId: tradeId,
    });
    setEditingToolTrade(tradeName);
    setShowEditToolModal(true);
  };

  const handleCloseEditToolModal = () => {
    setShowEditToolModal(false);
    setEditingTool(null);
    setEditingToolTrade(null);
  };

  const handleSaveEditTool = async () => {
    if (!editingTool || !editingToolTrade) return;
  };

  // Compute rendered tools per trade: base (filtered, overrides) + ui-created for that trade only
  const renderedToolsByTrade = useMemo(() => {
    const result: Record<string, Array<ToolLike & { isUiTool: boolean }>> = {};
    for (const tradeId of AVAILABLE_TRADES) {
      const baseNames = MOCK_TOOLS_BY_TRADE[tradeId] ?? [];
      const overrides = uiToolOverridesByTrade[tradeId] ?? {};
      const hidden = uiToolHiddenIdsByTrade[tradeId] ?? new Set();
      const uiList = uiToolsByTrade[tradeId] ?? [];

      const baseRendered = baseNames
        .map((toolName, idx) => {
          const id = `BASE-TOOL-${tradeId}-${idx}`;
          return { id, name: toolName, notes: "" };
        })
        .filter((t) => !hidden.has(t.id))
        .map((t) => ({
          ...t,
          ...(overrides[t.id] || {}),
          isUiTool: false as const,
        }));

      const uiRendered = uiList.map((t) => ({ ...t, isUiTool: true as const }));
      result[tradeId] = [...baseRendered, ...uiRendered];
    }
    return result;
  }, [uiToolsByTrade, uiToolOverridesByTrade, uiToolHiddenIdsByTrade]);

  // ========== PPE HANDLERS ==========

  const handleOpenAddPpeModal = () => {
    setAddPpeTypeId("");
    setAddPpeNotes("");
    setAddPpeDuplicateWarning(false);
    setPpeError("");
    setShowAddPpeModal(true);
  };

  const handleCloseAddPpeModal = () => {
    setShowAddPpeModal(false);
  };

  const handleSaveNewPpe = async () => {
    if (!addPpeTypeId) return;
    if (customerPpeReqs.some((p) => p.ppeTypeId === addPpeTypeId)) {
      setAddPpeDuplicateWarning(true);
      return;
    }
    setPpeSaving(true);
    setPpeError("");
    try {
      await apiFetch(`/customers/${customerId}/ppe-baseline`, {
        method: "POST",
        body: JSON.stringify({ ppeTypeId: addPpeTypeId, notes: addPpeNotes.trim() || null }),
      });
      setShowAddPpeModal(false);
      loadCustomerPpeReqs();
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.includes("409")) {
        setAddPpeDuplicateWarning(true);
      } else {
        setPpeError(e?.message ?? "Failed to add PPE requirement");
      }
    } finally {
      setPpeSaving(false);
    }
  };

  const handleOpenEditPpeModal = (reqId: string, ppeTypeId: string, ppeName: string, notes: string) => {
    setEditingPpeItem({ reqId, ppeTypeId, ppeName, notes });
    setPpeError("");
    setShowEditPpeModal(true);
  };

  const handleCloseEditPpeModal = () => {
    setShowEditPpeModal(false);
    setEditingPpeItem(null);
  };

  const handleSaveEditPpe = async () => {
    if (!editingPpeItem) return;
    setPpeSaving(true);
    setPpeError("");
    try {
      await apiFetch(`/customers/${customerId}/ppe-baseline/${editingPpeItem.reqId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: editingPpeItem.notes.trim() || null }),
      });
      setShowEditPpeModal(false);
      setEditingPpeItem(null);
      loadCustomerPpeReqs();
    } catch (e: any) {
      setPpeError(e?.message ?? "Failed to update PPE requirement");
    } finally {
      setPpeSaving(false);
    }
  };

  const handleOpenDeletePpeModal = (reqId: string, ppeTypeId: string, ppeName: string) => {
    setDeletingPpeItem({ reqId, ppeTypeId, ppeName });
    setPpeError("");
    setShowDeletePpeModal(true);
  };

  const handleCloseDeletePpeModal = () => {
    setShowDeletePpeModal(false);
    setDeletingPpeItem(null);
  };

  const handleConfirmDeletePpe = async () => {
    if (!deletingPpeItem) return;
    setPpeSaving(true);
    setPpeError("");
    try {
      await apiFetch(`/customers/${customerId}/ppe-baseline/${deletingPpeItem.reqId}`, {
        method: "DELETE",
      });
      setShowDeletePpeModal(false);
      setDeletingPpeItem(null);
      loadCustomerPpeReqs();
    } catch (e: any) {
      setPpeError(e?.message ?? "Failed to delete PPE requirement");
    } finally {
      setPpeSaving(false);
    }
  };

  // Derive rendered PPE from persisted requirements
  const renderedPpe = useMemo(() => {
    const typeMap = new Map(ppeTypes.map((t) => [t.id, t]));
    return customerPpeReqs.map((row) => {
      const reqId = (row.id ?? (row as any).reqId) as string;
      const name = row.ppeType?.name ?? typeMap.get(row.ppeTypeId)?.name ?? `Unknown PPE (ID: ${row.ppeTypeId})`;
      return { reqId, ppeTypeId: row.ppeTypeId, name, notes: row.notes || "" };
    });
  }, [ppeTypes, customerPpeReqs]);

  const handleSaveQuote = () => {
    if (!draftQuote) return;

    const newQuote: Quote = {
      id: draftQuote.id,
      title: draftQuote.title || "Untitled Quote",
      // On create, always set status to Draft; on edit, preserve existing status
      status: mode === "create" ? "Draft" : draftQuote.status,
      startDate: draftQuote.startDate,
      expiresAt: draftQuote.expiresAt,
      salespersonName: draftQuote.salespersonName,
      hasEconomicsSnapshot: false,
      notes: draftQuote.notes,
      trades: draftQuote.trades,
      modifiers: draftQuote.modifiers,
    };

    if (mode === "create") {
      setQuotes([...quotes, newQuote]);
      setSelectedQuoteId(newQuote.id);
    } else {
      setQuotes(quotes.map((q) => (q.id === newQuote.id ? newQuote : q)));
      setSelectedQuoteId(newQuote.id);
    }

    setDraftQuote(null);
    setMode("view");
  };

  // Draft update helpers
  const updateDraftField = (field: keyof DraftQuote, value: string) => {
    if (!draftQuote) return;
    setDraftQuote({ ...draftQuote, [field]: value });
  };

  const updateDraftModifier = (field: keyof DraftQuote["modifiers"], value: number) => {
    if (!draftQuote) return;
    setDraftQuote({
      ...draftQuote,
      modifiers: { ...draftQuote.modifiers, [field]: value },
    });
  };

  const updateTradeRow = (index: number, field: keyof TradeRow, value: string | number) => {
    if (!draftQuote) return;
    const newTrades = [...draftQuote.trades];
    newTrades[index] = { ...newTrades[index], [field]: value };
    setDraftQuote({ ...draftQuote, trades: newTrades });
  };

  // Handler for OT Multiplier with clamping
  const handleOtMultiplierChange = (index: number, inputValue: string) => {
    if (!draftQuote) return;
    const parsed = parseFloat(inputValue);
    let finalValue: number;
    if (isNaN(parsed) || inputValue.trim() === "") {
      // If blank or NaN, fall back to prior value or default, but never below min
      const prior = draftQuote.trades[index].otMultiplier ?? OT_MULTIPLIER_DEFAULT;
      finalValue = Math.max(OT_MULTIPLIER_MIN, prior);
    } else {
      // Clamp to minimum
      finalValue = Math.max(OT_MULTIPLIER_MIN, parsed);
    }
    updateTradeRow(index, "otMultiplier", finalValue);
  };

  const addTradeRow = () => {
    if (!draftQuote) return;
    const newTrade: TradeRow = {
      trade: "Millwright",
      headcount: 1,
      hours: 40,
      basePay: 30,
      burdenedPay: 36,
      billRate: 55,
      gmPerHr: 19,
      gmPct: 34.5,
      health: "Good",
      otMultiplier: OT_MULTIPLIER_DEFAULT,
    };
    setDraftQuote({ ...draftQuote, trades: [...draftQuote.trades, newTrade] });
  };

  const removeTradeRow = (index: number) => {
    if (!draftQuote || draftQuote.trades.length <= 1) return;
    const newTrades = draftQuote.trades.filter((_, i) => i !== index);
    setDraftQuote({ ...draftQuote, trades: newTrades });
  };

  const headerName = liveCustomer?.name ?? customer.name;
  const headerId = liveCustomer?.id ?? customer.id;
  const primaryLoc = liveCustomer?.locations?.[0] ?? null;
  const headerLocation = primaryLoc
    ? [
        [primaryLoc.city, primaryLoc.state].filter(Boolean).join(", "),
        primaryLoc.zip,
      ].filter(Boolean).join(" ")
    : (liveCustomer?.location ?? `${customer.city}, ${customer.state}`);
  const firstContact = liveCustomer?.contacts?.[0] ?? null;
  const headerPhone = liveCustomer?.mainPhone
    ?? firstContact?.officePhone
    ?? firstContact?.cellPhone
    ?? customer.mainPhone;
  const headerWebsite = liveCustomer?.websiteUrl ?? customer.website;
  const headerSalesperson = effectiveOwnerName;
  const isMockCustomer = Boolean(MOCK_CUSTOMER_DETAILS[customerId]);

  const headerStreetAddress =
    primaryLoc?.address1
      ? [primaryLoc.address1, primaryLoc.address2].filter(Boolean).join(", ")
      : (liveCustomer?.address ?? customer.address ?? null);
  return (
    <div className="customer-detail-container">
      {headerLoading && (
        <div className="header-loading-banner">Loading customer&hellip;</div>
      )}
      {headerError && (
        <div className="header-error-banner">{headerError}</div>
      )}

      {/* Page Header */}
      <div className="detail-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleBackToCustomers}>
            ← Back to Customers
          </button>
          <div className="header-title">
            <h1>{headerName}</h1>
            <span className="customer-id-badge">{headerId}</span>
            <span className={`status-badge ${customer.status.toLowerCase()}`}>{customer.status}</span>
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="summary-row">
        <div className="summary-item">
          <span className="summary-label">Ownership</span>
          <div className="summary-value-row">
            {headerSalesperson ? (
              <Link
                href={`/customers/${customerId}/ownership`}
                className="ownership-link"
                style={{ color: "#2563eb", fontWeight: 700, opacity: 1, textDecoration: "none" }}
                aria-label="Edit customer ownership"
              >
                {headerSalesperson}
              </Link>
            ) : (
              <span className="summary-value">—</span>
            )}
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-label">Main Phone</span>
          <span className="summary-value mono">{formatPhone(headerPhone)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Website</span>
          <a href={headerWebsite} className="summary-link" target="_blank" rel="noopener noreferrer">
            {(headerWebsite ?? "").replace(/^https?:\/\//, "") || "\u2014"}
          </a>
        </div>
        <div className="summary-item address-item">
          <span className="summary-label">Location</span>
          <div className="summary-value address-block">
            <div className={headerStreetAddress ? "" : "address-missing"}>
              {headerStreetAddress ??
                (isMockCustomer ? "—" : "Street address not on file")}
            </div>
            <div className="address-city">{headerLocation || "\u2014"}</div>
          </div>
        </div>
      </div>

      {/* Internal Actions Row */}
      <div className="internal-actions-row">
        <button
          className="internal-action-btn"
          onClick={() => router.push(`/customers/${customerId}/approval-package`)}
        >
          <span className="internal-action-label">Approval Package</span>
          <span className="internal-action-helper">Defines what this customer requires before approving workers.</span>
        </button>

        {/* Customer Approval Required Toggle (UI-only) */}
        <div className="customer-approval-toggle-card">
          <div className="customer-approval-toggle-row">
            <label className="customer-approval-toggle-label">
              <input
                type="checkbox"
                checked={customerApprovalRequired}
                onChange={(e) => setCustomerApprovalRequired(e.target.checked)}
              />
              <span className="customer-approval-toggle-text">Customer Approval Required</span>
            </label>
          </div>
          <span className="customer-approval-helper">
            When enabled, workers must be approved by the customer before dispatch unless overridden per order.
          </span>
          <span className="customer-approval-note">
            This sets the default approval behavior for new orders.
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-nav">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => {
              // Invoices tab: immediate navigation to Invoice Hub
              if (tab.key === "invoices") {
                router.push(`/invoices?customerId=${customerId}`);
                return;
              }
              setActiveTab(tab.key);
            }}
          >
            {tab.label}
            {tab.key === "contacts" && (
              <span className="tab-count">{renderedContacts.length}</span>
            )}
            {tab.key === "orders" && (
              <span className="tab-count">{draftOrders.length + fetchedOrders.length}</span>
            )}
            {tab.key === "quotes" && (
              <span className="tab-count">{customer.quotes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div className="contacts-panel">
            <div className="panel-header">
              <h2>Contacts Directory</h2>
              <span className="panel-note">Customer contact sprawl lives here — Job Orders only show PM</span>
              <button className="add-contact-btn" onClick={handleOpenAddContactModal}>
                + Add Contact
              </button>
            </div>
            <div className="contacts-table-wrap">
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Title / Role</th>
                    <th>Email</th>
                    <th>Office Phone</th>
                    <th>Cell Phone</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {renderedContacts.map((contact) => (
                    <tr key={contact.id} className={contact.isPrimary ? "primary-contact" : ""}>
                      <td className="contact-name">
                        <span className="name-text">{contact.name}</span>
                        {contact.isPrimary && (
                          <span className="primary-badge">Primary</span>
                        )}
                      </td>
                      <td className="contact-title">{contact.title}</td>
                      <td className="contact-email">
                        {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}
                      </td>
                      <td className="contact-phone">{contact.officePhone ? formatPhone(contact.officePhone) : "—"}</td>
                      <td className="contact-phone">{contact.cellPhone ? formatPhone(contact.cellPhone) : "—"}</td>
                      <td className="contact-notes">{contact.notes || "—"}</td>
                      <td className="contact-actions">
                        <button
                          className="contact-action-link"
                          onClick={() => handleOpenEditContactModal(contact, contact.isUiContact)}
                        >
                          Edit
                        </button>
                        <button
                          className="contact-action-link contact-action-delete"
                          onClick={() => handleOpenDeleteContactModal(contact, contact.isUiContact)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tools [by trade] Tab — Phase 1 read-only baseline wiring */}
        {activeTab === "toolsByTrade" && (
          <div className="tools-panel">
            <div className="panel-header">
              <div>
                <h2>Tools by Trade</h2>
                <span className="panel-note">
                  Customer tool baselines grouped by trade
                </span>
              </div>
            </div>

            {baselineTrades.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "#9ca3af", fontStyle: "italic" }}>
                Loading trades…
              </div>
            ) : (
              baselineTrades.map((trade) => {
                const tools = customerTradeBaselines[trade.id] ?? [];
                const hasTools = tools.length > 0;

                return (
                  <details
                    key={trade.id}
                    className="tools-trade-section"
                    open={hasTools}
                  >
                    <summary className="tools-trade-section-header" style={{ cursor: "pointer" }}>
                      <div className="tools-trade-header-left">
                        <h3 className="tools-trade-title">{trade.name}</h3>
                      </div>
                      <div className="tools-trade-header-right">
                        <span className="tools-trade-counts">
                          {tools.length} tool{tools.length !== 1 ? "s" : ""}
                        </span>
                        <button
                          type="button"
                          className="tool-action-link"
                          style={{ marginLeft: 12 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/customers/${customerId}/tools-baseline/${trade.id}`);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </summary>

                    {hasTools && (
                      <div style={{ padding: "12px 16px 12px 16px", color: "#4b5563" }}>
                        Tools configured for this trade.
<div style={{ marginTop: 8, opacity: 0.95 }}>
  <ul style={{ margin: 0, paddingLeft: 18 }}>
    {(tools || []).slice(0, 12).map((toolId) => (
      <li key={toolId} style={{ margin: "2px 0" }}>
        {toolNameById[toolId] ?? toolId}
      </li>
    ))}
  </ul>
  {tools.length > 12 && (
    <div style={{ marginTop: 6, opacity: 0.7, fontStyle: "italic" }}>
      +{tools.length - 12} more…
    </div>
  )}
</div>
                      <div style={{ marginTop: 8, opacity: 0.95 }}>
                        
                        {tools.length > 12 && (
                          <div style={{ marginTop: 6, fontStyle: "italic", opacity: 0.75 }}>
                            +{tools.length - 12} more
                          </div>
                        )}
                      </div>
                      </div>
                    )}
                  </details>
                );
              })
            )}
          </div>
        )}

        {/* PPE Tab */}{activeTab === "ppe" && (
          <div className="ppe-panel">
            <div className="panel-header">
              <h2>PPE [by trade]</h2>
              <span className="panel-note">PPE requirements for this customer by trade</span>
              
            </div>
            <div style={{ marginTop: 12 }}>
              {baselineTrades.map((trade) => {
                const ppeIds = customerPpeBaselines[trade.id] ?? [];
                const hasPpe = ppeIds.length > 0;
                return (
                  <details key={trade.id} className="tools-trade-section" open={hasPpe}>
                    <summary className="tools-trade-section-header" style={{ cursor: "pointer" }}>
                      <div className="tools-trade-header-left">
                        <h3 className="tools-trade-title">{trade.name}</h3>
                      </div>
                      <div className="tools-trade-header-right">
                        <span className="tools-trade-counts">
                          {ppeIds.length} PPE item{ppeIds.length !== 1 ? "s" : ""}
                        </span>
                        <button
                          className="tool-action-link"
                          style={{ marginLeft: 12 }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/customers/${customerId}/ppe-baseline/${trade.id}`);
                          }}
                        >
                          Edit PPE
                        </button>
                      </div>
                    </summary>

                    {hasPpe && (
                      <div style={{ padding: "12px 16px 12px 16px", color: "#4b5563" }}>
                        PPE configured for this trade.
                        <div style={{ marginTop: 8, opacity: 0.95 }}>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {ppeIds.slice(0, 12).map((ppeId) => (
                              <li key={ppeId} style={{ margin: "2px 0" }}>
                                {ppeTypes.find((p) => p.id === ppeId)?.name ?? ppeId}
                              </li>
                            ))}
                          </ul>
                          {ppeIds.length > 12 && (
                            <div style={{ marginTop: 6, opacity: 0.7, fontStyle: "italic" }}>
                              +{ppeIds.length - 12} more…
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
</div>
)}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="orders-panel">
            <div className="panel-header">
              <h2>Order History</h2>
              <span className="panel-note">All job orders associated with this customer</span>
              <button className="create-order-btn" onClick={() => router.push(`/customers/${customerId}/orders/new`)}>
                + Create Order
              </button>
            </div>
            {ordersLoading && (
              <div className="placeholder-note">
                <span>Loading orders…</span>
              </div>
            )}
            {ordersError && (
              <div className="placeholder-note" style={{ color: "#c0392b" }}>
                <span>Failed to load orders: {ordersError}</span>
              </div>
            )}
            {!ordersLoading && !ordersError && fetchedOrders.length === 0 && draftOrders.length === 0 && (
              <div className="placeholder-note">
                <span className="placeholder-icon">📋</span>
                <span>No orders for this customer yet.</span>
              </div>
            )}
            <div className="orders-list">
              {draftOrders.map((draft) => (
                <div
                  key={draft.id}
                  className="order-card"
                  onClick={() => router.push(`/orders/${draft.id}`)}
                >
                  <div className="order-info">
                    <span className="order-id">{draft.orderName || draft.site || "Untitled Order"}</span>
                    <span className="order-site">{draft.id}</span>
                  </div>
                  <div className="order-meta">
                    <span className={`order-status ${getPhaseBadgeClass(getOrderPhase(draft.status))}`}>
                      {getPhaseLabel(getOrderPhase(draft.status))}
                    </span>
                  </div>
                </div>
              ))}
              {fetchedOrders.map((order) => (
                <div
                  key={order.id}
                  className="order-card"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="order-info">
                    <span className="order-id">{order.title || "Untitled Order"}</span>
                    <span className="order-site">{order.id}</span>
                  </div>
                  <div className="order-meta">
                    <span className="order-date">
                      Created: {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className={`order-status ${getPhaseBadgeClass(getOrderPhase(order.status))}`}>
                      {getPhaseLabel(getOrderPhase(order.status))}
                    </span>
                    {order.marginHealth && (
                      <span
                        className="order-health-badge"
                        style={{
                          color: HEALTH_STATUS_COLORS[order.marginHealth.orderHealthStatus],
                          borderColor: `${HEALTH_STATUS_COLORS[order.marginHealth.orderHealthStatus]}40`,
                        }}
                        title={`Blended Order GM — ${order.marginHealth.orderBlendedMarginPct.toFixed(1)}%`}
                      >
                        <span
                          className="order-health-dot"
                          style={{ background: HEALTH_STATUS_COLORS[order.marginHealth.orderHealthStatus] }}
                        />
                        {order.marginHealth.orderBlendedMarginPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quotes Tab */}
        {activeTab === "quotes" && (
          <div className="quotes-panel">
            <div className="panel-header">
              <h2>Quotes</h2>
              <span className="panel-note">Customer quotes — select to preview details</span>
              <button className="create-quote-btn" onClick={handleCreateQuote}>
                + Create Quote
              </button>
            </div>
            {customer.quotes.length === 0 && mode === "view" ? (
              <div className="placeholder-note">
                <span className="placeholder-icon">📋</span>
                <span>No quotes for this customer yet.</span>
              </div>
            ) : (
              <div className="quotes-split">
                <div className="quote-list">
                  {customer.quotes.map((quote) => {
                    const isSelected = mode === "view" && (selectedQuoteId === quote.id || (selectedQuoteId === null && quote.id === customer.quotes[0]?.id));
                    return (
                      <div
                        key={quote.id}
                        className={`quote-card ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          setSelectedQuoteId(quote.id);
                          setMode("view");
                          setDraftQuote(null);
                        }}
                      >
                        <div className="quote-card-header">
                          <span className="quote-card-id">{quote.id}</span>
                          <span className={`quote-status-badge ${quote.status.toLowerCase()}`}>{quote.status}</span>
                        </div>
                        <div className="quote-card-title">{quote.title}</div>
                        <div className="quote-card-meta">
                          <span>Expires: {new Date(quote.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="quote-detail">
                  {/* CREATE / EDIT FORM */}
                  {(mode === "create" || mode === "edit") && draftQuote ? (
                    <div className="quote-form">
                      <div className="quote-detail-header">
                        <h3>{mode === "create" ? "Create New Quote" : "Edit Quote"}</h3>
                        <span className="quote-detail-id">{draftQuote.id}</span>
                      </div>

                      {/* Metadata Fields */}
                      <div className="form-section">
                        <div className="form-row">
                          <label className="form-label">Quote Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={draftQuote.title}
                            onChange={(e) => updateDraftField("title", e.target.value)}
                            placeholder="e.g., Downtown Tower — Millwright Services"
                          />
                        </div>
                        <div className="form-row-group">
                          <div className="form-row">
                            <label className="form-label">Quote Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={draftQuote.startDate}
                              onChange={(e) => updateDraftField("startDate", e.target.value)}
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Expiration Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={draftQuote.expiresAt}
                              onChange={(e) => updateDraftField("expiresAt", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <label className="form-label">Salesperson</label>
                          <input
                            type="text"
                            className="form-input"
                            value={draftQuote.salespersonName}
                            onChange={(e) => updateDraftField("salespersonName", e.target.value)}
                          />
                        </div>
                        <div className="form-row">
                          <label className="form-label">Notes (optional)</label>
                          <textarea
                            className="form-textarea"
                            value={draftQuote.notes}
                            onChange={(e) => updateDraftField("notes", e.target.value)}
                            placeholder="Internal notes about this quote..."
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Trades Table */}
                      <div className="form-section">
                        <div className="form-section-header">
                          <h4>Labor Plan (Trades)</h4>
                          <button type="button" className="add-row-btn" onClick={addTradeRow}>
                            + Add Trade
                          </button>
                        </div>
                        <div className="trades-table-wrap">
                          <table className="trades-form-table">
                            <thead>
                              <tr>
                                <th>Trade</th>
                                <th>Headcount</th>
                                <th>Hours</th>
                                <th>Base Pay</th>
                                <th>
                                  <span className="th-with-hint">
                                    Burdened Pay
                                    <span className="auto-calc-hint">Auto-calculated</span>
                                  </span>
                                </th>
                                <th>Bill Rate</th>
                                <th>OT Mult</th>
                                <th>
                                  <span className="th-with-hint">
                                    GM $/HR
                                    <span className="auto-calc-hint">Auto-calculated</span>
                                  </span>
                                </th>
                                <th>
                                  <span className="th-with-hint">
                                    GM %
                                    <span className="auto-calc-hint">Auto-calculated</span>
                                  </span>
                                </th>
                                <th>
                                  <span className="th-with-hint">
                                    Health
                                    <span className="auto-calc-hint">Auto-calculated</span>
                                  </span>
                                </th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {draftQuote.trades.map((trade, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <select
                                      className="form-select-sm"
                                      value={trade.trade}
                                      onChange={(e) => updateTradeRow(idx, "trade", e.target.value)}
                                    >
                                      {AVAILABLE_TRADES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm"
                                      value={trade.headcount}
                                      onChange={(e) => updateTradeRow(idx, "headcount", parseFloat(e.target.value) || 0)}
                                      min={1}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm"
                                      value={trade.hours}
                                      onChange={(e) => updateTradeRow(idx, "hours", parseFloat(e.target.value) || 0)}
                                      min={0}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm"
                                      value={trade.basePay}
                                      onChange={(e) => updateTradeRow(idx, "basePay", parseFloat(e.target.value) || 0)}
                                      min={0}
                                      step={0.01}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm form-input-disabled"
                                      value={trade.burdenedPay}
                                      disabled
                                      readOnly
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm"
                                      value={trade.billRate}
                                      onChange={(e) => updateTradeRow(idx, "billRate", parseFloat(e.target.value) || 0)}
                                      min={0}
                                      step={0.01}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm"
                                      value={trade.otMultiplier ?? OT_MULTIPLIER_DEFAULT}
                                      onChange={(e) => {
                                        // Allow typing freely, clamp on blur
                                        const val = e.target.value;
                                        const parsed = parseFloat(val);
                                        if (val === "" || isNaN(parsed)) {
                                          // Temporarily allow empty for typing
                                          updateTradeRow(idx, "otMultiplier", OT_MULTIPLIER_DEFAULT);
                                        } else {
                                          updateTradeRow(idx, "otMultiplier", parsed);
                                        }
                                      }}
                                      onBlur={(e) => handleOtMultiplierChange(idx, e.target.value)}
                                      min={OT_MULTIPLIER_MIN}
                                      step={0.001}
                                      title={`Minimum: ${OT_MULTIPLIER_MIN}`}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm form-input-disabled"
                                      value={trade.gmPerHr}
                                      disabled
                                      readOnly
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-input-sm form-input-disabled"
                                      value={trade.gmPct}
                                      disabled
                                      readOnly
                                    />
                                  </td>
                                  <td>
                                    <span className={`health-badge health-badge-${trade.health.toLowerCase()}`}>
                                      {trade.health}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="remove-row-btn"
                                      onClick={() => removeTradeRow(idx)}
                                      disabled={draftQuote.trades.length <= 1}
                                      title="Remove trade"
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Modifiers */}
                      <div className="form-section">
                        <h4>Pay Modifiers</h4>
                        <div className="modifiers-grid">
                          <div className="form-row">
                            <label className="form-label">Per Diem ($/day)</label>
                            <input
                              type="number"
                              className="form-input"
                              value={draftQuote.modifiers.perDiem}
                              onChange={(e) => updateDraftModifier("perDiem", parseFloat(e.target.value) || 0)}
                              min={0}
                              step={0.01}
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Travel ($/mi)</label>
                            <input
                              type="number"
                              className="form-input"
                              value={draftQuote.modifiers.travel}
                              onChange={(e) => updateDraftModifier("travel", parseFloat(e.target.value) || 0)}
                              min={0}
                              step={0.01}
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Bonuses / Premiums ($/hr)</label>
                            <input
                              type="number"
                              className="form-input"
                              value={draftQuote.modifiers.bonuses}
                              onChange={(e) => updateDraftModifier("bonuses", parseFloat(e.target.value) || 0)}
                              min={0}
                              step={0.01}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={handleCancelForm}>
                          Cancel
                        </button>
                        <button type="button" className="save-btn" onClick={handleSaveQuote}>
                          {mode === "create" ? "Create Quote" : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE */
                    (() => {
                      const selectedQuote = customer.quotes.find((q) => q.id === selectedQuoteId) || customer.quotes[0];
                      if (!selectedQuote) return null;
                      const laborRows = selectedQuote.trades;
                      // Map health values for display
                      const healthMap: Record<string, "green" | "yellow" | "red"> = {
                        Good: "green",
                        Watch: "yellow",
                        Risk: "red",
                      };
                      // Overall quote health = worst-of trade health (any red → red, else any yellow → yellow, else green)
                      const quoteHealth: "green" | "yellow" | "red" = laborRows.some((r) => r.health === "Risk")
                        ? "red"
                        : laborRows.some((r) => r.health === "Watch")
                          ? "yellow"
                          : "green";
                      return (
                        <>
                          <div className="quote-detail-header">
                            <div className="quote-detail-header-top">
                              <div>
                                <h3>{selectedQuote.title}</h3>
                                <span className="quote-detail-id">{selectedQuote.id}</span>
                              </div>
                              <button
                                type="button"
                                className="edit-quote-btn"
                                onClick={() => handleEditQuote(selectedQuote)}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          <div className="quote-detail-row">
                            <span className="quote-detail-label">Status</span>
                            <span className={`quote-status-badge ${selectedQuote.status.toLowerCase()}`}>{selectedQuote.status}</span>
                          </div>
                          <div className="quote-detail-row">
                            <span className="quote-detail-label">Quote Health</span>
                            <span className="quote-detail-value quote-health-cell">
                              <span className={`quote-health-dot ${quoteHealth}`} title={quoteHealth} />
                              {quoteHealth}
                            </span>
                          </div>
                          <div className="quote-detail-row">
                            <span className="quote-detail-label">Salesperson (Owner)</span>
                            <span className="quote-detail-value">{selectedQuote.salespersonName}</span>
                          </div>
                          <div className="quote-detail-row">
                            <span className="quote-detail-label">Quote Date</span>
                            <span className="quote-detail-value">{new Date(selectedQuote.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <div className="quote-detail-row">
                            <span className="quote-detail-label">Expiration Date</span>
                            <span className="quote-detail-value">{new Date(selectedQuote.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <div className="quote-detail-row">
                            <span className="quote-detail-label">Economics Snapshot</span>
                            <span className={`quote-econ-badge ${selectedQuote.hasEconomicsSnapshot ? "generated" : "not-generated"}`}>
                              {selectedQuote.hasEconomicsSnapshot ? "Generated" : "Not generated"}
                            </span>
                          </div>
                          {selectedQuote.notes && (
                            <div className="quote-detail-row">
                              <span className="quote-detail-label">Notes</span>
                              <span className="quote-detail-value">{selectedQuote.notes}</span>
                            </div>
                          )}

                          <div className="labor-plan-section">
                            <h4 className="labor-plan-title">Labor Plan (Trades)</h4>
                            <div className="labor-plan-table-wrap">
                              <table className="labor-plan-table">
                                <thead>
                                  <tr>
                                    <th>Trade</th>
                                    <th>Headcount</th>
                                    <th>Hours</th>
                                    <th>Base Pay Rate</th>
                                    <th>Burdened Pay Rate</th>
                                    <th>Bill Rate</th>
                                    <th>GM $/HR</th>
                                    <th>GM %</th>
                                    <th>Health</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {laborRows.map((row, idx) => (
                                    <tr key={idx}>
                                      <td>{row.trade}</td>
                                      <td>{row.headcount}</td>
                                      <td>{row.hours}</td>
                                      <td>${row.basePay}</td>
                                      <td>${row.burdenedPay}</td>
                                      <td>${row.billRate}</td>
                                      <td>${row.gmPerHr}</td>
                                      <td>{row.gmPct}%</td>
                                      <td><span className={`trade-health-dot ${healthMap[row.health]}`} title={row.health} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="pay-modifiers-section">
                            <h4 className="pay-modifiers-title">Pay Modifiers</h4>
                            <div className="pay-modifiers-list">
                              <div className="pay-modifier-row">
                                <span className="pay-modifier-label">Per diem</span>
                                <span className="pay-modifier-value">${selectedQuote.modifiers.perDiem}/day</span>
                              </div>
                              <div className="pay-modifier-row">
                                <span className="pay-modifier-label">Travel</span>
                                <span className="pay-modifier-value">${selectedQuote.modifiers.travel}/mi</span>
                              </div>
                              <div className="pay-modifier-row">
                                <span className="pay-modifier-label">Bonuses / Premiums</span>
                                <span className="pay-modifier-value">${selectedQuote.modifiers.bonuses}/hr</span>
                              </div>
                            </div>
                          </div>

                          <div className="quote-burden-panel">
                            <div className="burden-panel-header">
                              <span className="burden-panel-title">Burden (Estimate)</span>
                              <span className="burden-panel-note">Mirrors Orders burden panel — UI-only shell</span>
                            </div>
                            <div className="burden-rows">
                              <div className="burden-row">
                                <span className="burden-label">WC + GL + Taxes</span>
                                <span className="burden-value">18.5%</span>
                              </div>
                              <div className="burden-row">
                                <span className="burden-label">Per Diem / Lodging</span>
                                <span className="burden-value">${selectedQuote.modifiers.perDiem}/day</span>
                              </div>
                              <div className="burden-row total">
                                <span className="burden-label">Total Burden Est.</span>
                                <span className="burden-value">~24.2%</span>
                              </div>
                            </div>
                          </div>

                          <div className="internal-totals-toggle-row">
                            <label className="toggle-label">
                              <input
                                type="checkbox"
                                checked={showInternalTotals}
                                onChange={(e) => setShowInternalTotals(e.target.checked)}
                              />
                              <span>Show internal totals</span>
                            </label>
                            {!showInternalTotals && (
                              <span className="totals-hidden-note">Totals hidden (Internal).</span>
                            )}
                          </div>
                          {showInternalTotals && (
                            <div className="internal-totals-mock">
                              <div className="burden-row"><span className="burden-label">Weekly total (mock)</span><span className="burden-value">$4,640</span></div>
                              <div className="burden-row"><span className="burden-label">Line total (mock)</span><span className="burden-value">$18,560</span></div>
                              <div className="burden-row total"><span className="burden-label">Grand total (mock)</span><span className="burden-value">$18,560</span></div>
                            </div>
                          )}

                          <div className="generate-order-row">
                            <button
                              type="button"
                              className="generate-order-btn-active"
                              onClick={() => {
                                const newOrderId = generateOrderId();
                                const payload = {
                                  orderId: newOrderId,
                                  customerId,
                                  orderName: selectedQuote.title || "Untitled Order",
                                  projectDescription: selectedQuote.notes || "",
                                  site: null,
                                  startDate: null,
                                  endDate: null,
                                  status: "Draft",
                                  tradeLines: selectedQuote.trades.map((t) => ({
                                    trade: t.trade,
                                    project: selectedQuote.title,
                                    headcount: t.headcount,
                                    hours: t.hours,
                                    basePay: t.basePay,
                                    billRate: t.billRate,
                                    otMultiplier: t.otMultiplier ?? 1.5,
                                    burdenedPay: t.burdenedPay,
                                    gmPerHr: t.gmPerHr,
                                    gmPct: t.gmPct,
                                    health: t.health,
                                  })),
                                  modifiers: {
                                    perDiem: selectedQuote.modifiers.perDiem,
                                    travel: selectedQuote.modifiers.travel,
                                    bonuses: selectedQuote.modifiers.bonuses,
                                  },
                                  jobRequirements: {
                                    tools: [],
                                    certifications: [],
                                    ppe: [],
                                    useCustomerToolList: false,
                                    useMW4HStandardToolList: false,
                                  },
                                  commissionSplits: [
                                    {
                                      person: effectiveOwnerName,
                                      role: "Sales",
                                      splitPct: 100,
                                    },
                                  ],
                                  origin: { type: "quote", quoteId: selectedQuote.id },
                                };
                                const storageKey = `jp.orderDraft.${customerId}.${newOrderId}`;
                                sessionStorage.setItem(storageKey, JSON.stringify(payload));
                                router.push(`/customers/${customerId}/orders/new?orderId=${newOrderId}`);
                              }}
                            >
                              Generate Order
                            </button>
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="modal-overlay" onClick={handleCloseAddContactModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Contact</h3>
              <button className="modal-close-btn" onClick={handleCloseAddContactModal}>×</button>
            </div>
            <div className="modal-body">
              {contactError && (
                <div className="form-error-banner">{contactError}</div>
              )}
              <div className="form-row-group">
                <div className="form-row">
                  <label className="form-label">First Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={newContact.firstName}
                    onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                    placeholder="First name"
                    autoFocus
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Last Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={newContact.lastName}
                    onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Job Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={newContact.jobTitle}
                  onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
                  placeholder="e.g., Project Manager"
                />
              </div>
              <div className="form-row">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="form-row-group">
                <div className="form-row">
                  <label className="form-label">Office Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newContact.officePhone}
                    onChange={(e) => setNewContact({ ...newContact, officePhone: e.target.value })}
                    placeholder="(000) 000-0000"
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Cell Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newContact.cellPhone}
                    onChange={(e) => setNewContact({ ...newContact, cellPhone: e.target.value })}
                    placeholder="(000) 000-0000"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseAddContactModal} disabled={contactSaving}>Cancel</button>
              <button
                className="save-btn"
                onClick={handleSaveNewContact}
                disabled={contactSaving || !newContact.firstName.trim() || !newContact.lastName.trim()}
              >
                {contactSaving ? "Saving…" : "Save Contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditContactModal && editingContact && (
        <div className="modal-overlay" onClick={handleCloseEditContactModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Contact</h3>
              <button className="modal-close-btn" onClick={handleCloseEditContactModal}>×</button>
            </div>
            <div className="modal-body">
              {contactError && (
                <div className="form-error-banner">{contactError}</div>
              )}
              <div className="form-row-group">
                <div className="form-row">
                  <label className="form-label">First Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingContact.firstName}
                    onChange={(e) => setEditingContact({ ...editingContact, firstName: e.target.value })}
                    placeholder="First name"
                    autoFocus
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Last Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingContact.lastName}
                    onChange={(e) => setEditingContact({ ...editingContact, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Job Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingContact.jobTitle}
                  onChange={(e) => setEditingContact({ ...editingContact, jobTitle: e.target.value })}
                  placeholder="e.g., Project Manager"
                />
              </div>
              <div className="form-row">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={editingContact.email}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="form-row-group">
                <div className="form-row">
                  <label className="form-label">Office Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingContact.officePhone}
                    onChange={(e) => setEditingContact({ ...editingContact, officePhone: e.target.value })}
                    placeholder="(000) 000-0000"
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Cell Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingContact.cellPhone}
                    onChange={(e) => setEditingContact({ ...editingContact, cellPhone: e.target.value })}
                    placeholder="(000) 000-0000"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseEditContactModal} disabled={contactSaving}>Cancel</button>
              <button
                className="save-btn"
                onClick={handleSaveEditContact}
                disabled={contactSaving || !editingContact.firstName.trim() || !editingContact.lastName.trim()}
              >
                {contactSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Contact Modal */}
      {showDeleteContactModal && deletingContact && (
        <div className="modal-overlay" onClick={handleCloseDeleteContactModal}>
          <div className="modal-content modal-content-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Contact</h3>
              <button className="modal-close-btn" onClick={handleCloseDeleteContactModal}>×</button>
            </div>
            <div className="modal-body">
              {contactError && (
                <div className="form-error-banner">{contactError}</div>
              )}
              <p className="delete-confirm-text">
                Are you sure you want to deactivate <strong>{deletingContact.name}</strong>?
              </p>
              <p className="delete-confirm-note">
                This contact will be deactivated and removed from the active contacts list.
              </p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseDeleteContactModal} disabled={contactSaving}>Cancel</button>
              <button
                className="delete-btn"
                onClick={handleConfirmDeleteContact}
                disabled={contactSaving}
              >
                {contactSaving ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tool Modal (trade-aware) */}
      {showAddToolModal && addToolForTrade && (
        <div className="modal-overlay" onClick={handleCloseAddToolModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Tool — {addToolForTrade}</h3>
              <button className="modal-close-btn" onClick={handleCloseAddToolModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">Tool Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={newTool.name}
                  onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  placeholder="e.g., Torque Wrench"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={newTool.notes}
                  onChange={(e) => setNewTool({ ...newTool, notes: e.target.value })}
                  placeholder="Additional notes about this tool..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseAddToolModal}>Cancel</button>
              <button
                className="save-btn"
                onClick={handleSaveNewTool}
                disabled={!newTool.name.trim()}
              >
                Save Tool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tool Modal (trade-aware) */}
      {showEditToolModal && editingTool && editingToolTrade && (
        <div className="modal-overlay" onClick={handleCloseEditToolModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Tool — {editingToolTrade}</h3>
              <button className="modal-close-btn" onClick={handleCloseEditToolModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">Tool Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTool.name}
                  readOnly
                  style={{ opacity: 0.6, cursor: "default" }}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={editingTool.notes}
                  onChange={(e) => setEditingTool({ ...editingTool, notes: e.target.value })}
                  placeholder="Additional notes about this tool..."
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseEditToolModal}>Cancel</button>
              <button
                className="save-btn"
                onClick={handleSaveEditTool}
                disabled={!editingTool.name.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Add PPE Modal */}
      {showAddPpeModal && (
        <div className="modal-overlay" onClick={handleCloseAddPpeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add PPE</h3>
              <button className="modal-close-btn" onClick={handleCloseAddPpeModal}>×</button>
            </div>
            <div className="modal-body">
              {ppeTypes.length === 0 ? (
                <p style={{ color: "#6b7280", fontStyle: "italic", margin: "8px 0" }}>
                  No PPE Types exist yet. Create them in Admin → PPE.
                </p>
              ) : (
                <>
                  <div className="form-row">
                    <label className="form-label">PPE Name <span className="required-star">*</span></label>
                    <select
                      className="form-input"
                      value={addPpeTypeId}
                      onChange={(e) => { setAddPpeTypeId(e.target.value); setAddPpeDuplicateWarning(false); }}
                      autoFocus
                    >
                      <option value="">— Select PPE Type —</option>
                      {ppeTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                      ))}
                    </select>
                    {addPpeDuplicateWarning && (
                      <span style={{ color: "#f59e0b", fontSize: "12px", marginTop: "4px", display: "block" }}>
                        Already added.
                      </span>
                    )}
                  </div>
                  <div className="form-row">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-textarea"
                      value={addPpeNotes}
                      onChange={(e) => setAddPpeNotes(e.target.value)}
                      placeholder="Additional notes about this PPE requirement..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseAddPpeModal}>Cancel</button>
              <button
                className="save-btn"
                onClick={handleSaveNewPpe}
                disabled={!addPpeTypeId || ppeTypes.length === 0 || ppeSaving}
              >
                {ppeSaving ? "Saving…" : "Save PPE"}
              </button>
            </div>
            {ppeError && (
              <div style={{ padding: "0 20px 12px", color: "#f87171", fontSize: "13px" }}>{ppeError}</div>
            )}
          </div>
        </div>
      )}

      {/* Edit PPE Modal */}
      {showEditPpeModal && editingPpeItem && (
        <div className="modal-overlay" onClick={handleCloseEditPpeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit PPE</h3>
              <button className="modal-close-btn" onClick={handleCloseEditPpeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">PPE Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingPpeItem.ppeName}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={editingPpeItem.notes}
                  onChange={(e) => setEditingPpeItem({ ...editingPpeItem, notes: e.target.value })}
                  placeholder="Additional notes about this PPE requirement..."
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseEditPpeModal}>Cancel</button>
              <button
                className="save-btn"
                onClick={handleSaveEditPpe}
                disabled={ppeSaving}
              >
                {ppeSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
            {ppeError && (
              <div style={{ padding: "0 20px 12px", color: "#f87171", fontSize: "13px" }}>{ppeError}</div>
            )}
          </div>
        </div>
      )}

      {/* Delete PPE Modal */}
      {showDeletePpeModal && deletingPpeItem && (
        <div className="modal-overlay" onClick={handleCloseDeletePpeModal}>
          <div className="modal-content modal-content-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete PPE</h3>
              <button className="modal-close-btn" onClick={handleCloseDeletePpeModal}>×</button>
            </div>
            <div className="modal-body">
              <p className="delete-confirm-text">
                Are you sure you want to delete <strong>{deletingPpeItem.ppeName}</strong>?
              </p>
              <p className="delete-confirm-note">
                This will permanently remove this PPE requirement.
              </p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseDeletePpeModal}>Cancel</button>
              <button
                className="delete-btn"
                onClick={handleConfirmDeletePpe}
                disabled={ppeSaving}
              >
                {ppeSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
            {ppeError && (
              <div style={{ padding: "0 20px 12px", color: "#f87171", fontSize: "13px" }}>{ppeError}</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        /* ============================================================
           JARVIS PRIME — INDUSTRIAL LIGHT THEME
           Customer Profile Master Page
           Palette: bg #f8fafc | card #fff | border #e5e7eb
                    text-primary #111827 | text-secondary #4b5563
                    text-muted #6b7280 | blue #2563eb | blue-hover #1d4ed8
        ============================================================ */

        /* --- Page Shell --- */
        .customer-detail-container {
          padding: 24px 40px 60px;
          max-width: 1600px;
          margin: 0 auto;
          background: #f8fafc;
          min-height: 100vh;
        }

        /* --- Banners --- */
        .header-loading-banner {
          margin-bottom: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #4b5563;
          font-size: 14px;
        }
        .header-error-banner {
          margin-bottom: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 14px;
        }

        /* --- Page Header --- */
        .detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }
        .header-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .back-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .header-title h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
        }
        .customer-id-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          border-radius: 6px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        /* --- Summary Cards Row --- */
        .summary-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        .summary-item {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .summary-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .summary-value {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          line-height: 1.4;
        }
        .summary-value-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ownership-link {
          color: #2563eb;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
        }
        .ownership-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
        .summary-link {
          font-size: 14px;
          font-weight: 500;
          color: #2563eb;
          text-decoration: none;
          word-break: break-all;
        }
        .summary-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
        .address-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .address-missing {
          color: #9ca3af;
          font-style: italic;
        }
        .address-city {
          font-size: 13px;
          color: #6b7280;
        }

        /* --- Internal Actions Row --- */
        .internal-actions-row {
          display: flex;
          gap: 14px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .internal-action-btn {
          flex: 1;
          min-width: 200px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px 18px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .internal-action-btn:hover {
          background: #f8fafc;
          border-color: #d1d5db;
        }
        .internal-action-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .internal-action-helper {
          display: block;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }

        /* --- Customer Approval Toggle Card --- */
        .customer-approval-toggle-card {
          flex: 1;
          min-width: 260px;
          padding: 14px 18px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .customer-approval-toggle-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .customer-approval-toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .customer-approval-toggle-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
        }
        .customer-approval-toggle-text {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .customer-approval-helper {
          display: block;
          font-size: 12px;
          color: #4b5563;
          line-height: 1.5;
        }
        .customer-approval-note {
          display: block;
          font-size: 11px;
          color: #6b7280;
          font-style: italic;
        }

        /* --- Tabs Navigation --- */
        .tabs-nav {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          white-space: nowrap;
        }
        .tab-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .tab-btn.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
        }
        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: rgba(0,0,0,0.08);
          font-size: 11px;
          font-weight: 700;
        }
        .tab-btn.active .tab-count {
          background: rgba(255,255,255,0.25);
        }

        /* --- Tab Content Panel --- */
        .tab-content {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 22px;
        }

        /* --- Panel Header (shared across all tabs) --- */
        .panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .panel-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          flex: 1;
        }
        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          flex: 1;
        }
        .panel-note {
          font-size: 13px;
          color: #6b7280;
        }

        /* --- Tables (contacts, orders, quotes labor plan) --- */
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead {
          background: #f1f5f9;
        }
        th {
          padding: 10px 12px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #d1d5db;
          white-space: nowrap;
        }
        td {
          padding: 12px;
          font-size: 13px;
          color: #111827;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        tr:last-child td {
          border-bottom: none;
        }
        tr:hover td {
          background: #f9fafb;
        }

        /* --- Contacts Panel --- */
        .contacts-panel {
          display: flex;
          flex-direction: column;
        }
        .contacts-table-wrap {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .contacts-table {
          min-width: 700px;
        }
        .contact-name {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .name-text {
          font-weight: 600;
          color: #111827;
        }
        .primary-contact td {
          background: #f0f9ff;
        }
        .primary-badge {
          display: inline-flex;
          align-items: center;
          height: 20px;
          padding: 0 8px;
          border-radius: 999px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
        }
        .contact-title {
          color: #111827;
          font-size: 13px;
        }
        .contact-email a {
          color: #2563eb;
          text-decoration: none;
          font-size: 13px;
        }
        .contact-email a:hover {
          text-decoration: underline;
        }
        .contact-phone {
          color: #111827;
          font-size: 13px;
          white-space: nowrap;
        }
        .contact-notes {
          color: #6b7280;
          font-size: 12px;
          max-width: 200px;
        }
        .contact-actions {
          display: flex;
          gap: 10px;
          white-space: nowrap;
        }
        .contact-action-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          font-weight: 500;
          color: #2563eb;
          cursor: pointer;
        }
        .contact-action-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
        .contact-action-delete {
          color: #dc2626;
        }
        .contact-action-delete:hover {
          color: #b91c1c;
        }

        /* --- Add Contact Button --- */
        .add-contact-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          border-radius: 7px;
          border: 1px solid #2563eb;
          background: #2563eb;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
          white-space: nowrap;
        }
        .add-contact-btn:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        /* --- Tools / PPE Trade Section (accordion) --- */
        .tools-panel,
        .ppe-panel {
          display: flex;
          flex-direction: column;
        }
        .tools-trade-section {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 10px;
          overflow: hidden;
        }
        .tools-trade-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f8fafc;
          list-style: none;
          gap: 12px;
        }
        .tools-trade-section-header::-webkit-details-marker {
          display: none;
        }
        .tools-trade-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tools-trade-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tools-trade-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }
        .tools-trade-counts {
          font-size: 12px;
          color: #6b7280;
          background: #f1f5f9;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 2px 9px;
        }
        .tool-action-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          font-weight: 500;
          color: #2563eb;
          cursor: pointer;
        }
        .tool-action-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        /* --- Orders Panel --- */
        .orders-panel {
          display: flex;
          flex-direction: column;
        }
        .placeholder-note {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 24px;
          color: #6b7280;
          font-size: 14px;
          justify-content: center;
        }
        .placeholder-icon {
          font-size: 20px;
        }
        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .order-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          cursor: pointer;
          transition: background 0.1s ease, border-color 0.1s ease;
        }
        .order-card:hover {
          background: #f8fafc;
          border-color: #d1d5db;
        }
        .order-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .order-id {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }
        .order-site {
          font-size: 12px;
          color: #6b7280;
        }
        .order-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .order-date {
          font-size: 12px;
          color: #6b7280;
        }
        .order-status {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #374151;
        }
        .order-health-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 22px;
          padding: 0 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
          background: #f9fafb;
        }
        .order-health-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* --- Quotes Panel --- */
        .quotes-panel {
          display: flex;
          flex-direction: column;
        }
        .quotes-split {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 18px;
          align-items: flex-start;
        }
        .quote-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .quote-card {
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          cursor: pointer;
          transition: background 0.1s ease, border-color 0.1s ease;
        }
        .quote-card:hover {
          background: #f8fafc;
          border-color: #d1d5db;
        }
        .quote-card.active {
          border-color: #2563eb;
          background: #eff6ff;
        }
        .quote-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 6px;
        }
        .quote-card-id {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          letter-spacing: 0.3px;
        }
        .quote-card-title {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          line-height: 1.35;
          margin-bottom: 6px;
        }
        .quote-card-meta {
          font-size: 11px;
          color: #6b7280;
        }
        .quote-status-badge {
          display: inline-flex;
          align-items: center;
          height: 20px;
          padding: 0 8px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #374151;
        }
        .quote-status-badge.draft { background: #f9fafb; color: #6b7280; border-color: #e5e7eb; }
        .quote-status-badge.sent { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
        .quote-status-badge.accepted { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .quote-status-badge.declined { background: #fff1f2; color: #dc2626; border-color: #fecaca; }

        /* --- Quote Detail View --- */
        .quote-detail {
          min-height: 200px;
        }
        .quote-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .quote-detail-header {
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        .quote-detail-header-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .quote-detail-header h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }
        .quote-detail-id {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }
        .quote-detail-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .quote-detail-row:last-child {
          border-bottom: none;
        }
        .quote-detail-label {
          min-width: 160px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .quote-detail-value {
          font-size: 14px;
          color: #111827;
        }
        .quote-health-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .quote-health-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .quote-health-dot.green { background: #16a34a; }
        .quote-health-dot.yellow { background: #d97706; }
        .quote-health-dot.red { background: #dc2626; }
        .quote-econ-badge {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 9px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #6b7280;
        }
        .quote-econ-badge.generated { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .quote-econ-badge.not-generated { background: #f9fafb; color: #6b7280; border-color: #e5e7eb; }

        /* --- Labor Plan Table --- */
        .labor-plan-section {
          margin-top: 20px;
        }
        .labor-plan-title {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }
        .labor-plan-table-wrap {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .labor-plan-table {
          min-width: 600px;
        }
        .trade-health-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .trade-health-dot.green { background: #16a34a; }
        .trade-health-dot.yellow { background: #d97706; }
        .trade-health-dot.red { background: #dc2626; }

        /* --- Pay Modifiers --- */
        .pay-modifiers-section {
          margin-top: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .pay-modifiers-title {
          margin: 0 0 10px 0;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .pay-modifiers-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pay-modifier-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }
        .pay-modifier-label { color: #4b5563; }
        .pay-modifier-value { font-weight: 600; color: #111827; }

        /* --- Burden Panel --- */
        .quote-burden-panel {
          margin-top: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .burden-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .burden-panel-title {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .burden-panel-note {
          font-size: 11px;
          color: #9ca3af;
          font-style: italic;
        }
        .burden-rows {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .burden-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          padding: 4px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .burden-row:last-child { border-bottom: none; }
        .burden-row.total .burden-label { font-weight: 700; color: #111827; }
        .burden-row.total .burden-value { font-weight: 700; color: #111827; }
        .burden-label { color: #4b5563; }
        .burden-value { font-weight: 600; color: #111827; }

        /* --- Internal Totals Toggle --- */
        .internal-totals-toggle-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          padding: 10px 14px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
        }
        .toggle-label {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }
        .toggle-label input[type="checkbox"] {
          width: 15px;
          height: 15px;
          accent-color: #2563eb;
          cursor: pointer;
        }
        .totals-hidden-note {
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
        }
        .internal-totals-mock {
          margin-top: 10px;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
        }

        /* --- Generate Order Row --- */
        .generate-order-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #e5e7eb;
        }

        /* --- Edit Quote Button --- */
        .edit-quote-btn {
          padding: 7px 14px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.1s ease;
          white-space: nowrap;
        }
        .edit-quote-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }

        /* --- Primary Action Buttons --- */
        .add-contact-btn,
        .generate-order-btn-active,
        .create-order-btn,
        .create-quote-btn,
        .save-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 16px;
          border-radius: 7px;
          border: none;
          background: #2563eb;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
          white-space: nowrap;
        }
        .add-contact-btn:hover,
        .generate-order-btn-active:hover,
        .create-order-btn:hover,
        .create-quote-btn:hover,
        .save-btn:hover {
          background: #1d4ed8;
        }
        .save-btn:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        /* --- Secondary Buttons --- */
        .cancel-btn {
          display: inline-flex;
          align-items: center;
          padding: 9px 16px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.1s ease;
        }
        .cancel-btn:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* --- Delete Button --- */
        .delete-btn {
          display: inline-flex;
          align-items: center;
          padding: 9px 16px;
          border-radius: 7px;
          border: none;
          background: #dc2626;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .delete-btn:hover { background: #b91c1c; }
        .delete-btn:disabled { background: #fca5a5; cursor: not-allowed; }

        /* --- Form Elements --- */
        .form-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .form-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .form-section-header h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .form-row-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        }
        .required-star {
          color: #dc2626;
        }
        .form-input,
        .form-textarea,
        .form-select-sm {
          width: 100%;
          padding: 9px 11px;
          border-radius: 7px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          font-size: 13px;
          outline: none;
          transition: border-color 0.12s ease;
          box-sizing: border-box;
        }
        .form-input:focus,
        .form-textarea:focus,
        .form-select-sm:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
        }
        .form-input::placeholder,
        .form-textarea::placeholder {
          color: #9ca3af;
        }
        .form-input-sm {
          width: 80px;
          padding: 6px 8px;
          border-radius: 5px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          font-size: 12px;
          outline: none;
        }
        .form-input-sm:focus {
          border-color: #2563eb;
        }
        .form-input-disabled {
          background: #f8fafc;
          color: #6b7280;
          cursor: not-allowed;
        }
        .form-error-banner {
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 14px;
          border-top: 1px solid #e5e7eb;
        }
        .modifiers-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .add-row-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #2563eb;
          background: #eff6ff;
          color: #2563eb;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        .add-row-btn:hover { background: #dbeafe; }
        .remove-row-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #9ca3af;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
        }
        .remove-row-btn:hover:not(:disabled) { background: #fff1f2; color: #dc2626; border-color: #fecaca; }
        .remove-row-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* --- Trades Table (quote form) --- */
        .trades-table-wrap {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .trades-form-table {
          min-width: 800px;
        }

        /* --- Table Header Hints --- */
        .th-with-hint {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .auto-calc-hint {
          font-size: 10px;
          font-weight: 400;
          color: #9ca3af;
          text-transform: none;
          letter-spacing: 0;
        }

        /* --- Health Badges (quote form) --- */
        .health-badge {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .health-badge-good { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .health-badge-watch { background: #fffbeb; color: #d97706; border-color: #fde68a; }
        .health-badge-risk { background: #fff1f2; color: #dc2626; border-color: #fecaca; }

        /* --- Modals --- */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          backdrop-filter: blur(2px);
        }
        .modal-content {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        }
        .modal-content-sm {
          max-width: 400px;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }
        .modal-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }
        .modal-close-btn:hover { background: #f1f5f9; color: #374151; }
        .modal-body {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f8fafc;
          border-radius: 0 0 12px 12px;
        }

        /* --- Delete Confirm Modal Text --- */
        .delete-confirm-text {
          margin: 0;
          font-size: 14px;
          color: #111827;
          line-height: 1.5;
        }
        .delete-confirm-note {
          margin: 8px 0 0 0;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.5;
        }

        /* --- Mono / misc --- */
        .mono {
          font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}




























