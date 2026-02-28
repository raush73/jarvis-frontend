"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { formatPhone } from "@/lib/format";
import { apiFetch } from "@/lib/api";

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

type TabKey = "contacts" | "tools" | "ppe" | "orders" | "quotes" | "invoices";

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
  // Customer Tool Baseline (persisted) — modal state (Capsule 3B)
  const [showCustomerToolBaselineModal, setShowCustomerToolBaselineModal] = useState(false);
  const [baselineTrades, setBaselineTrades] = useState<{ id: string; name: string }[]>([]);
  const [baselineToolTypes, setBaselineToolTypes] = useState<{ id: string; name: string; isActive?: boolean }[]>([]);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState("");

  const [baselineForm, setBaselineForm] = useState({
    tradeId: "",
    toolTypeId: "",
    isDefault: false,
    notes: "",
  });


  const [customerToolsLoaded, setCustomerToolsLoaded] = useState(false);

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
      const data = await apiFetch<any>(`/customers/${customerId}/ppe-requirements`);
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

  const loadCustomerToolTypes = async () => {
    try {
      const data = await apiFetch<{ customer: any; trades: CustomerToolTrade[] }>(
        `/customers/${customerId}/tool-types`
      );
      setCustomerToolTrades(data.trades ?? []);
    } catch (e: any) {
      console.error("Failed to load customer tool types:", e);
      setCustomerToolTrades([]);
    } finally {
      setCustomerToolsLoaded(true);
    }
  };

  useEffect(() => {
    loadCustomerToolTypes();
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
  const [showEditToolModal, setShowEditToolModal] = useState(false);
  const [showDeleteToolModal, setShowDeleteToolModal] = useState(false);
  const [addToolForTrade, setAddToolForTrade] = useState<string | null>(null);
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
    { key: "tools", label: "Tools" },
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

  // Customer tool baseline (persisted) — handlers (Capsule 3C)
  const handleOpenCustomerToolBaselineModal = async () => {
    setBaselineError("");
    setBaselineLoading(true);

    // reset form each open (trade + tool required)
    setBaselineForm({ tradeId: "", toolTypeId: "", isDefault: false, notes: "" });

    try {
      const [trades, toolTypes] = await Promise.all([
        apiFetch<{ id: string; name: string }[]>(`/trades`),
        apiFetch<{ id: string; name: string; isActive?: boolean }[]>(`/tool-types?activeOnly=true`),
      ]);

      setBaselineTrades(trades ?? []);
      setBaselineToolTypes(toolTypes ?? []);
      setShowCustomerToolBaselineModal(true);
    } catch (e: any) {
      console.error("Failed to load baseline modal data:", e);
      setBaselineError(e?.message ?? "Failed to load trades/tool types.");
      setShowCustomerToolBaselineModal(true);
    } finally {
      setBaselineLoading(false);
    }
  };


  const handleSaveCustomerToolBaseline = async () => {
    setBaselineError("");

    if (!baselineForm.tradeId || !baselineForm.toolTypeId) {
      setBaselineError("Trade and Tool Type are required.");
      return;
    }

    try {
      setBaselineLoading(true);

      await apiFetch<any>(`/customers/${customerId}/tool-types`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId: baselineForm.tradeId,
          toolTypeId: baselineForm.toolTypeId,
          isDefault: !!baselineForm.isDefault,
          notes: baselineForm.notes?.trim() || null,
        }),
      });

      // refresh persisted list
      await loadCustomerToolTypes();

      setShowCustomerToolBaselineModal(false);
    } catch (e: any) {
      console.error("Failed to save customer tool baseline:", e);
      setBaselineError(e?.message ?? "Failed to save baseline.");
    } finally {
      setBaselineLoading(false);
    }
  };
  const handleCloseCustomerToolBaselineModal = () => {
    setShowCustomerToolBaselineModal(false);
  };
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

    // API-backed tool: PATCH notes only
    if (editingTool.toolTypeId && editingTool.apiTradeId) {
      try {
        const updated = await apiFetch<CustomerToolTypeItem>(`/customers/${customerId}/tool-types`, {
          method: "PATCH",
          body: JSON.stringify({
            tradeId: editingTool.apiTradeId,
            toolTypeId: editingTool.toolTypeId,
            notes: editingTool.notes.trim() || null,
          }),
        });
        setCustomerToolTrades((prev) =>
          prev.map((t) =>
            t.trade.id === editingTool.apiTradeId
              ? { ...t, items: t.items.map((i) => (i.id === editingTool.id ? { ...i, notes: updated.notes } : i)) }
              : t
          )
        );
      } catch (e: any) {
        console.error("Failed to save tool notes:", e);
      }
      setShowEditToolModal(false);
      setEditingTool(null);
      setEditingToolTrade(null);
      return;
    }
  };

  // Delete Tool handlers (trade-scoped)
  const handleOpenDeleteToolModal = (tool: { id: string; name: string; isUiTool?: boolean }, tradeId: string) => {
    setDeletingTool({
      id: tool.id,
      name: tool.name,
      isUiTool: tool.isUiTool ?? false,
    });
    setDeletingToolTrade(tradeId);
    setShowDeleteToolModal(true);
  };

  const handleCloseDeleteToolModal = () => {
    setShowDeleteToolModal(false);
    setDeletingTool(null);
    setDeletingToolTrade(null);
  };

  const handleConfirmDeleteTool = () => {
    if (!deletingTool || !deletingToolTrade) return;

    const uiList = uiToolsByTrade[deletingToolTrade] || [];
    const hidden = uiToolHiddenIdsByTrade[deletingToolTrade] || new Set();

    if (deletingTool.isUiTool) {
      setUiToolsByTrade({
        ...uiToolsByTrade,
        [deletingToolTrade]: uiList.filter((t) => t.id !== deletingTool.id),
      });
    } else {
      setUiToolHiddenIdsByTrade({
        ...uiToolHiddenIdsByTrade,
        [deletingToolTrade]: new Set([...hidden, deletingTool.id]),
      });
    }

    // Also remove from defaults set for that trade (UI-only cleanup)
    const currentDefaults = uiToolDefaultIdsByTrade[deletingToolTrade] ?? new Set();
    if (currentDefaults.has(deletingTool.id)) {
      const newDefaults = new Set(currentDefaults);
      newDefaults.delete(deletingTool.id);
      setUiToolDefaultIdsByTrade({
        ...uiToolDefaultIdsByTrade,
        [deletingToolTrade]: newDefaults,
      });
    }

    setShowDeleteToolModal(false);
    setDeletingTool(null);
    setDeletingToolTrade(null);
  };

  // Toggle isDefault for a CustomerToolType item (persisted via PATCH)
  const handleToggleToolDefault = async (item: CustomerToolTypeItem, tradeId: string) => {
    const newDefault = !item.isDefault;
    setCustomerToolTrades((prev) =>
      prev.map((t) =>
        t.trade.id === tradeId
          ? { ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, isDefault: newDefault } : i)) }
          : t
      )
    );
    try {
      await apiFetch<any>(`/customers/${customerId}/tool-types`, {
        method: "PATCH",
        body: JSON.stringify({ tradeId, toolTypeId: item.toolType.id, isDefault: newDefault }),
      });
    } catch (e: any) {
      console.error("Failed to toggle tool default:", e);
      setCustomerToolTrades((prev) =>
        prev.map((t) =>
          t.trade.id === tradeId
            ? { ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, isDefault: item.isDefault } : i)) }
            : t
        )
      );
    }
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
      await apiFetch(`/customers/${customerId}/ppe-requirements`, {
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
      await apiFetch(`/customers/${customerId}/ppe-requirements/${editingPpeItem.reqId}`, {
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
      await apiFetch(`/customers/${customerId}/ppe-requirements/${deletingPpeItem.reqId}`, {
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
              <span className="tab-count">{customer.orders.length}</span>
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

        {showCustomerToolBaselineModal && (
          <div className="modal-backdrop" onClick={handleCloseCustomerToolBaselineModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Trade Baseline (Customer Tools)</h3>
                <button type="button" className="modal-close" onClick={handleCloseCustomerToolBaselineModal}>
                  ×
                </button>
              </div>

              <div className="modal-body">
                {baselineError && (
                  <div style={{ marginBottom: 12, color: "#ff8b8b", fontSize: 13 }}>
                    {baselineError}
                  </div>
                )}

                {baselineLoading ? (
                  <div style={{ color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
                    Loading trades and tool catalog…
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Trade</label>
                      <select
                        value={baselineForm.tradeId}
                        onChange={(e) => setBaselineForm((p) => ({ ...p, tradeId: e.target.value }))}
                        className="input" style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #334155" }}
                      >
                        <option value="">Select trade…</option>
                        {baselineTrades.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Tool Type</label>
                      <select
                        value={baselineForm.toolTypeId}
                        onChange={(e) => setBaselineForm((p) => ({ ...p, toolTypeId: e.target.value }))}
                        className="input" style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #334155" }}
                      >
                        <option value="">Select tool type…</option>
                        {baselineToolTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={baselineForm.isDefault}
                        onChange={(e) => setBaselineForm((p) => ({ ...p, isDefault: e.target.checked }))}
                      />
                      Default tool for this trade baseline
                    </label>

                    <div style={{ display: "grid", gap: 6 }}>
                      <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Notes</label>
                      <textarea
                        value={baselineForm.notes}
                        onChange={(e) => setBaselineForm((p) => ({ ...p, notes: e.target.value }))}
                        className="input" style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #334155" }}
                        rows={3}
                        placeholder="Optional notes…"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={handleCloseCustomerToolBaselineModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveCustomerToolBaseline}
                  disabled={baselineLoading}
                >
                  {baselineLoading ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Tools Tab — trade-grouped */}
{activeTab === "tools" && (
          <div className="tools-panel">
            <div className="panel-header">
              <div>
                <h2>Customer Tools by Trade</h2>
                <span className="panel-note">Tools commonly required at this customer&apos;s sites, grouped by trade</span>
              </div>

              <button type="button" className="add-tool-btn" onClick={handleOpenCustomerToolBaselineModal}>
                + Add Trade Baseline
              </button>
            </div>
            {!customerToolsLoaded ? (
                <div style={{ textAlign: "center", padding: "24px 16px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                  Loading tool types…
                </div>
              ) : customerToolTrades.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 16px" }}>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                    No customer tool types configured yet.
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="add-tool-btn"
                      onClick={handleOpenCustomerToolBaselineModal}
                    >
                      + Add Trade Baseline
                    </button>
                  </div>
                </div>
              ) : customerToolTrades.map(({ trade, items }) => {
              const defaultCount = items.filter((i) => i.isDefault).length;
              const catalogCount = items.length;
              return (
                <div key={trade.id} className="tools-trade-section">
                  <div className="tools-trade-section-header">
                    <div className="tools-trade-header-left">
                      <h3 className="tools-trade-title">{trade.name}</h3>
                      <span className="tools-trade-helper">
                        Default tools are the typical baseline for this customer&apos;s {trade.name}. Job Orders may add one-off tools.
                      </span>
                    </div>
                    <div className="tools-trade-header-right">
                      <span className="tools-trade-counts">Default: {defaultCount} • Catalog: {catalogCount}</span>
                    </div>
                  </div>
                  <div className="tools-table-wrap">
                    <table className="tools-table">
                      <thead>
                        <tr>
                          <th>Tool Name</th>
                          <th>Notes</th>
                          <th className="tool-default-col">Default</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="tool-name">{item.toolType.name}</td>
                            <td className="tool-notes">{item.notes || "—"}</td>
                            <td className="tool-default-cell">
                              <input
                                type="checkbox"
                                className="tool-default-checkbox"
                                checked={item.isDefault}
                                onChange={() => handleToggleToolDefault(item, trade.id)}
                                title={item.isDefault ? "Remove from defaults" : "Mark as default"}
                              />
                            </td>
                            <td className="tool-actions">
                              <button
                                type="button"
                                className="tool-action-link"
                                onClick={() => handleOpenEditToolModal(item, trade.id, trade.name)}
                              >
                                Edit Notes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-slate-400" style={{ marginTop: "1.5rem" }}>
              Tools listed are sourced from the Tool Catalog. Checked tools define this customer&apos;s default baseline. Orders snapshot required tools at creation.
            </p>
          </div>
        )}

        {/* PPE Tab */}
        {activeTab === "ppe" && (
          <div className="ppe-panel">
            <div className="panel-header">
              <h2>Customer-Level PPE</h2>
              <span className="panel-note">Standard PPE requirements for this customer</span>
              <button className="add-ppe-btn" onClick={handleOpenAddPpeModal}>
                + Add PPE
              </button>
            </div>
            <div className="ppe-table-wrap">
              <table className="ppe-table">
                <thead>
                  <tr>
                    <th>PPE Name</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!customerPpeLoaded ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "24px 16px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                        Loading customer PPE…
                      </td>
                    </tr>
                  ) : renderedPpe.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "24px 16px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                        No PPE configured yet.
                      </td>
                    </tr>
                  ) : (
                    renderedPpe.map((ppe) => (
                      <tr key={ppe.reqId}>
                        <td className="ppe-name">{ppe.name}</td>
                        <td className="ppe-notes">{ppe.notes || "—"}</td>
                        <td className="ppe-actions">
                          <button
                            className="ppe-action-link"
                            onClick={() => handleOpenEditPpeModal(ppe.reqId, ppe.ppeTypeId, ppe.name, ppe.notes)}
                          >
                            Edit
                          </button>
                          <button
                            className="ppe-action-link ppe-action-delete"
                            onClick={() => handleOpenDeletePpeModal(ppe.reqId, ppe.ppeTypeId, ppe.name)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="placeholder-note">
              <span className="placeholder-icon">🦺</span>
              <span>Customer-level PPE requirements live here. Site-specific PPE can be defined per Job Order.</span>
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
            <div className="orders-list">
              {[...draftOrders, ...customer.orders].map((order) => {
                const isDraft = "__isDraft" in order && order.__isDraft === true;
                return (
                  <div
                    key={order.id}
                    className="order-card"
                    onClick={() => {
                      router.push(`/orders/${order.id}`);
                    }}
                  >
                    <div className="order-info">
                      <span className="order-id">{order.id}</span>
                      <span className="order-site">{isDraft ? ((order as typeof draftOrders[number]).orderName || (order as typeof draftOrders[number]).site || "—") : (order as typeof customer.orders[number]).site}</span>
                    </div>
                    <div className="order-meta">
                      {!isDraft && (
                        <span className="order-date">
                          Start: {new Date((order as typeof customer.orders[number]).startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      <span className={`order-status ${order.status.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                );
              })}
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

      {/* Delete Tool Modal (trade-aware) */}
      {showDeleteToolModal && deletingTool && deletingToolTrade && (
        <div className="modal-overlay" onClick={handleCloseDeleteToolModal}>
          <div className="modal-content modal-content-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Tool — {deletingToolTrade}</h3>
              <button className="modal-close-btn" onClick={handleCloseDeleteToolModal}>×</button>
            </div>
            <div className="modal-body">
              <p className="delete-confirm-text">
                Are you sure you want to delete <strong>{deletingTool.name}</strong>?
              </p>
              <p className="delete-confirm-note">
                This removes the item from the UI only (no persistence).
              </p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseDeleteToolModal}>Cancel</button>
              <button
                className="delete-btn"
                onClick={handleConfirmDeleteTool}
              >
                Delete
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
                <p style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic", margin: "8px 0" }}>
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
        .customer-detail-container {
          padding: 24px 40px 60px;
          max-width: 1300px;
          margin: 0 auto;
        }

        .detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .back-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s ease;
        }

        .back-btn:hover {
          color: #3b82f6;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .header-title h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .customer-id-badge {
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 6px;
        }

        .status-badge {
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.active {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        /* Summary Row */
        .summary-row {
          display: flex;
          gap: 32px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .summary-item.address-item {
          flex: 1;
          min-width: 200px;
        }

        .summary-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          font-size: 14px;
          color: #fff;
        }

        .summary-value.mono {
          font-family: var(--font-geist-mono), monospace;
        }

        .summary-value-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .address-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .address-missing {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        .address-city {
          color: rgba(255, 255, 255, 0.75);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .read-only-badge {
          font-size: 9px;
          padding: 2px 6px;
          background: rgba(148, 163, 184, 0.15);
          color: rgba(148, 163, 184, 0.8);
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .ownership-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          padding: 8px 12px;
          background: rgba(59, 130, 246, 0.14);
          color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(59, 130, 246, 0.35);
          border-radius: 8px;
          text-decoration: none;
          font-weight: 700;
          transition: all 0.15s ease;
          cursor: pointer;
          line-height: 1;
        }

        .ownership-link:hover {
          background: rgba(59, 130, 246, 0.22);
          border-color: rgba(59, 130, 246, 0.55);
          transform: translateY(-1px);
        }

        .ownership-link:active {
          transform: translateY(0);
        }

        .header-loading-banner {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #f59e0b;
          text-align: center;
          margin-bottom: 16px;
        }

        .header-error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          color: #ef4444;
          margin-bottom: 16px;
        }

        .summary-link {
          font-size: 14px;
          color: #3b82f6;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .summary-link:hover {
          color: #60a5fa;
          text-decoration: underline;
        }

        /* Internal Actions Row */
        .internal-actions-row {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .internal-action-btn {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .internal-action-btn:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.15);
        }

        .internal-action-label {
          font-size: 14px;
          font-weight: 500;
          color: #3b82f6;
        }

        .internal-action-helper {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        /* Customer Approval Toggle Card */
        .customer-approval-toggle-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
        }

        .customer-approval-toggle-row {
          display: flex;
          align-items: center;
        }

        .customer-approval-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .customer-approval-toggle-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #3b82f6;
        }

        .customer-approval-toggle-text {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .customer-approval-helper {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          line-height: 1.4;
        }

        .customer-approval-note {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        /* Tabs Navigation */
        .tabs-nav {
          display: flex;
          gap: 4px;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 0;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: -1px;
        }

        .tab-btn:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .tab-btn.active {
          color: #fff;
          border-bottom-color: #3b82f6;
        }

        .tab-count {
          font-size: 11px;
          padding: 2px 7px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.6);
        }

        .tab-btn.active .tab-count {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        /* Tab Content */
        .tab-content {
          min-height: 300px;
        }

        /* Panel Header */
        .panel-header {
          display: flex;
          align-items: baseline;
          gap: 16px;
          margin-bottom: 20px;
        }

        .panel-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .panel-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Create Quote Button */
        .create-quote-btn {
          margin-left: auto;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .create-quote-btn:hover {
          background: #2563eb;
        }

        /* Edit Quote Button */
        .edit-quote-btn {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .edit-quote-btn:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .quote-detail-header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        /* Contacts Table */
        .contacts-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .contacts-table {
          width: 100%;
          border-collapse: collapse;
        }

        .contacts-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .contacts-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .contacts-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .contacts-table tr:last-child td {
          border-bottom: none;
        }

        .contacts-table tr.primary-contact {
          background: rgba(59, 130, 246, 0.05);
        }

        .contact-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .name-text {
          font-weight: 500;
          color: #fff;
        }

        .primary-badge {
          font-size: 9px;
          padding: 2px 6px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .contact-title {
          color: rgba(255, 255, 255, 0.7);
        }

        .contact-email a {
          color: #3b82f6;
          text-decoration: none;
        }

        .contact-email a:hover {
          text-decoration: underline;
        }

        .contact-phone {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .contact-notes {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
          max-width: 200px;
        }

        /* Item Lists (Tools/PPE) */
        .item-list {
          list-style: none;
          margin: 0 0 24px;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 10px;
        }

        .item-list li {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          position: relative;
          padding-left: 32px;
        }

        .item-list li::before {
          content: "•";
          position: absolute;
          left: 14px;
          color: #3b82f6;
          font-size: 18px;
        }

        .placeholder-note {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: rgba(59, 130, 246, 0.05);
          border: 1px dashed rgba(59, 130, 246, 0.2);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
        }

        .placeholder-icon {
          font-size: 20px;
        }

        /* Orders List */
        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .order-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 22px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .order-card:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.15);
        }

        .order-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .order-id {
          font-family: var(--font-geist-mono), monospace;
          font-size: 14px;
          font-weight: 500;
          color: #3b82f6;
        }

        .order-site {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .order-meta {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .order-date {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .order-status {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .order-status.active {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .order-status.pending {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .order-status.draft--ui-only- {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        /* Quotes Panel */
        .quotes-split {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 24px;
        }

        .quote-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .quote-card {
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quote-card:hover {
          background: rgba(59, 130, 246, 0.05);
          border-color: rgba(59, 130, 246, 0.12);
        }

        .quote-card.active {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .quote-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .quote-card-id {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: #3b82f6;
        }

        .quote-card-title {
          font-size: 13px;
          color: #fff;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .quote-card-meta {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
        }

        .quote-status-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .quote-status-badge.draft {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .quote-status-badge.generated {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
        }

        .quote-status-badge.sent {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .quote-status-badge.accepted {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .quote-status-badge.denied {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .quote-status-badge.expired {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .quote-detail {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
        }

        .quote-detail-header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .quote-detail-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 6px;
        }

        .quote-detail-id {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .quote-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .quote-detail-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .quote-detail-value {
          font-size: 13px;
          color: #fff;
        }

        .quote-econ-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .quote-econ-badge.generated {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .quote-econ-badge.not-generated {
          background: rgba(148, 163, 184, 0.1);
          color: rgba(148, 163, 184, 0.7);
        }

        .quote-health-cell {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .quote-health-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .quote-health-dot.green {
          background: #22c55e;
        }

        .quote-health-dot.yellow {
          background: #f59e0b;
        }

        .quote-health-dot.red {
          background: #ef4444;
        }

        .labor-plan-section {
          margin-top: 20px;
        }

        .labor-plan-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 10px;
        }

        .labor-plan-table-wrap {
          overflow-x: auto;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .labor-plan-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .labor-plan-table th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .labor-plan-table td {
          padding: 10px 12px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .labor-plan-table tr:last-child td {
          border-bottom: none;
        }

        .trade-health-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .trade-health-dot.green {
          background: #22c55e;
        }

        .trade-health-dot.yellow {
          background: #f59e0b;
        }

        .trade-health-dot.red {
          background: #ef4444;
        }

        .pay-modifiers-section {
          margin-top: 20px;
        }

        .pay-modifiers-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 10px;
        }

        .pay-modifiers-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pay-modifier-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
          font-size: 12px;
        }

        .pay-modifier-label {
          color: rgba(255, 255, 255, 0.6);
        }

        .pay-modifier-value {
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--font-geist-mono), monospace;
        }

        .quote-burden-panel {
          margin-top: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }

        .burden-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .burden-panel-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .burden-panel-note {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        .burden-rows {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .burden-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
        }

        .burden-row.total {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.15);
        }

        .burden-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .burden-value {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: #fff;
        }

        .burden-row.total .burden-label,
        .burden-row.total .burden-value {
          font-weight: 600;
          color: #60a5fa;
        }

        .internal-totals-toggle-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
          padding: 12px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
        }

        .toggle-label input {
          cursor: pointer;
        }

        .totals-hidden-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        .internal-totals-mock {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }

        .generate-order-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .generate-order-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          cursor: not-allowed;
        }

        .generate-order-btn-active {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: #22c55e;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .generate-order-btn-active:hover {
          background: #16a34a;
        }

        .generate-order-placeholder {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .create-order-btn {
          margin-left: auto;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .create-order-btn:hover {
          background: #2563eb;
        }

        /* Quote Form Styles */
        .quote-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-section h4 {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0;
        }

        .form-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-row-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .form-input,
        .form-select,
        .form-textarea {
          padding: 10px 12px;
          font-size: 13px;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          transition: border-color 0.15s ease;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-select {
          cursor: pointer;
        }

        .form-textarea {
          resize: vertical;
          min-height: 60px;
        }

        /* Trades Form Table */
        .trades-table-wrap {
          overflow-x: auto;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .trades-form-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .trades-form-table th {
          padding: 10px 8px;
          text-align: left;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .trades-form-table td {
          padding: 8px 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .trades-form-table tr:last-child td {
          border-bottom: none;
        }

        .th-with-hint {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .auto-calc-hint {
          font-size: 9px;
          font-weight: 400;
          color: rgba(245, 158, 11, 0.8);
          text-transform: none;
          letter-spacing: 0;
        }

        .form-input-sm,
        .form-select-sm {
          width: 100%;
          padding: 6px 8px;
          font-size: 12px;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .form-input-sm:focus,
        .form-select-sm:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .form-input-sm {
          min-width: 60px;
        }

        .form-input-sm.form-input-disabled {
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.4);
          cursor: not-allowed;
          border-color: rgba(255, 255, 255, 0.05);
        }

        .form-select-sm {
          min-width: 100px;
          cursor: pointer;
        }

        .health-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 500;
          border-radius: 10px;
          text-align: center;
          min-width: 52px;
          user-select: none;
        }

        .health-badge-good {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        .health-badge-watch {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .health-badge-risk {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .add-row-btn {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-row-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .remove-row-btn {
          width: 24px;
          height: 24px;
          padding: 0;
          font-size: 16px;
          font-weight: 500;
          color: rgba(239, 68, 68, 0.7);
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .remove-row-btn:hover:not(:disabled) {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .remove-row-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        /* Modifiers Grid */
        .modifiers-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        /* Form Actions */
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cancel-btn {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cancel-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .save-btn {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .save-btn:hover {
          background: #2563eb;
        }

        .save-btn:disabled {
          background: rgba(59, 130, 246, 0.4);
          cursor: not-allowed;
        }

        /* Add Contact Button */
        .add-contact-btn {
          margin-left: auto;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .add-contact-btn:hover {
          background: #2563eb;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .modal-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .required-star {
          color: #ef4444;
        }

        /* Contact Actions */
        .contact-actions {
          display: flex;
          gap: 12px;
        }

        .contact-action-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .contact-action-link:hover {
          color: #3b82f6;
        }

        .contact-action-link.contact-action-delete:hover {
          color: #ef4444;
        }

        /* Tools Tab — trade sections */
        .tools-trade-section {
          margin-bottom: 28px;
        }

        .tools-trade-section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 12px;
          gap: 16px;
        }

        .tools-trade-header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tools-trade-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .tools-trade-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .tools-trade-helper {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          font-style: italic;
        }

        .tools-trade-counts {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 500;
          white-space: nowrap;
        }

        /* Tools Table */
        .tools-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .tools-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tools-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .tools-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 11px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tools-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .tools-table tr:last-child td {
          border-bottom: none;
        }

        .tool-name {
          font-weight: 500;
        }

        .tool-notes {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
          max-width: 300px;
        }

        .tool-actions {
          display: flex;
          gap: 12px;
        }

        .tool-action-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .tool-action-link:hover {
          color: #3b82f6;
        }

        .tool-action-link.tool-action-delete:hover {
          color: #ef4444;
        }

        /* Default column */
        .tool-default-col {
          width: 80px;
          text-align: center;
        }

        .tool-default-cell {
          text-align: center;
        }

        .tool-default-checkbox {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: #3b82f6;
        }

        /* Add Tool Button */
        .add-tool-btn {
          margin-left: auto;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .add-tool-btn:hover {
          background: #2563eb;
        }

        /* PPE Table */
        .ppe-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .ppe-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ppe-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .ppe-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 11px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ppe-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .ppe-table tr:last-child td {
          border-bottom: none;
        }

        .ppe-name {
          font-weight: 500;
        }

        .ppe-notes {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
          max-width: 300px;
        }

        .ppe-actions {
          display: flex;
          gap: 12px;
        }

        .ppe-action-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .ppe-action-link:hover {
          color: #3b82f6;
        }

        .ppe-action-link.ppe-action-delete:hover {
          color: #ef4444;
        }

        /* Add PPE Button */
        .add-ppe-btn {
          margin-left: auto;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .add-ppe-btn:hover {
          background: #2563eb;
        }

        /* Delete Modal */
        .modal-content-sm {
          max-width: 400px;
        }

        .delete-confirm-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 12px;
        }

        .delete-confirm-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .delete-btn {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          background: #ef4444;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .delete-btn:hover {
          background: #dc2626;
        }

        .form-error-banner {
          padding: 8px 12px;
          margin-bottom: 12px;
          font-size: 13px;
          color: #b91c1c;
          background: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          line-height: 1.4;
        }

      `}</style>
    </div>
  );
}



