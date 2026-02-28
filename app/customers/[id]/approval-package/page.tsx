"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Tier = 1 | 2 | 3;

type FieldKey =
  | "fullName"
  | "trade"
  | "phone"
  | "email"
  | "dob"
  | "ssnLast4"
  | "ssnFull"
  | "address"
  | "resume"
  | "certSummary"
  | "drugScreen"
  | "background"
  | "siteBadging"
  | "notes";

type Candidate = {
  id: string;
  fullName: string;
  trade: string;
  phone?: string;
  email?: string;
  dob?: string;
  ssnLast4?: string;
  ssnFull?: string;
  address?: string;
  resume?: string;
  certSummary?: string;
  drugScreen?: string;
  background?: string;
  siteBadging?: string;
  notes?: string;
};

const MOCK_CUSTOMER = {
  id: "cust_001",
  name: "Marathon Petroleum — Texas City",
  approvalRequired: true,
  approvalTierDefault: 2 as Tier,
};

const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "cand_001",
    fullName: "James Holloway",
    trade: "Millwright",
    phone: "(713) 555-0144",
    email: "j.holloway@example.com",
    dob: "1991-08-12",
    ssnLast4: "4821",
    ssnFull: "XXX-XX-4821",
    address: "Houston, TX",
    resume: "Resume.pdf",
    certSummary: "MSHA 48B • OSHA-10 • TWIC",
    drugScreen: "Passed (2026-02-01)",
    background: "Clear (2026-01-28)",
    siteBadging: "Pending",
    notes: "Strong refinery turnaround experience.",
  },
  {
    id: "cand_002",
    fullName: "Anthony Reyes",
    trade: "Pipefitter",
    phone: "(832) 555-0199",
    email: "a.reyes@example.com",
    dob: "1987-03-05",
    ssnLast4: "1107",
    ssnFull: "XXX-XX-1107",
    address: "Pasadena, TX",
    resume: "Resume.pdf",
    certSummary: "NCCER PF • OSHA-30",
    drugScreen: "Scheduled",
    background: "In Progress",
    siteBadging: "Not Started",
    notes: "Needs customer badge + background completion.",
  },
  {
    id: "cand_003",
    fullName: "Caleb Nguyen",
    trade: "Welder",
    phone: "(281) 555-0102",
    email: "c.nguyen@example.com",
    dob: "1994-11-21",
    ssnLast4: "7740",
    ssnFull: "XXX-XX-7740",
    address: "Baytown, TX",
    resume: "Resume.pdf",
    certSummary: "6G Pipe • OSHA-10",
    drugScreen: "Passed (2026-01-30)",
    background: "Clear (2026-01-29)",
    siteBadging: "Ready",
    notes: "High performer, prior site access.",
  },
];

const ALL_FIELDS: { key: FieldKey; label: string; pii?: boolean; heavy?: boolean }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "trade", label: "Trade" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "dob", label: "Date of Birth", pii: true },
  { key: "ssnLast4", label: "SSN (Last 4)", pii: true },
  { key: "ssnFull", label: "SSN (Full)", pii: true },
  { key: "resume", label: "Resume Attachment", heavy: true },
  { key: "certSummary", label: "Certifications Summary" },
  { key: "drugScreen", label: "Drug Screen Status" },
  { key: "background", label: "Background Check Status" },
  { key: "siteBadging", label: "Site Badging Status" },
  { key: "notes", label: "Internal Notes (Optional)" },
];

// Default tier definitions (UI-only starting point)
// Tier 2 includes Tier 1. Tier 3 includes Tier 2.
const DEFAULT_TIER_FIELDS: Record<Tier, FieldKey[]> = {
  1: ["fullName", "trade", "phone", "email", "certSummary"],
  2: ["fullName", "trade", "phone", "email", "certSummary", "ssnLast4", "dob", "drugScreen", "background", "siteBadging"],
  3: [
    "fullName",
    "trade",
    "phone",
    "email",
    "address",
    "certSummary",
    "ssnLast4",
    "dob",
    "drugScreen",
    "background",
    "siteBadging",
    "resume",
    "notes",
  ],
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function tierLabel(t: Tier) {
  if (t === 1) return "Tier 1 — Basic";
  if (t === 2) return "Tier 2 — Standard (includes Tier 1)";
  return "Tier 3 — Full Packet (includes Tier 2)";
}

function deliveryLabel(v: string) {
  if (v === "secure_link") return "Secure Link (Magic Link)";
  if (v === "email") return "Email (Attachment/Link)";
  if (v === "export") return "Export (CSV/XLSX/PDF)";
  return v;
}

export default function CustomerApprovalPackagePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customerId = params?.id ?? "unknown";

  const [tier, setTier] = useState<Tier>(MOCK_CUSTOMER.approvalTierDefault);
  const [delivery, setDelivery] = useState<"secure_link" | "email" | "export">("secure_link");

  // UI-only per-tier field toggles (start from defaults)
  const [tier1Fields, setTier1Fields] = useState<FieldKey[]>(DEFAULT_TIER_FIELDS[1]);
  const [tier2Fields, setTier2Fields] = useState<FieldKey[]>(DEFAULT_TIER_FIELDS[2]);
  const [tier3Fields, setTier3Fields] = useState<FieldKey[]>(DEFAULT_TIER_FIELDS[3]);

  const effectiveFields = useMemo(() => {
    if (tier === 1) return uniq(tier1Fields);
    if (tier === 2) return uniq([...tier1Fields, ...tier2Fields]);
    return uniq([...tier1Fields, ...tier2Fields, ...tier3Fields]);
  }, [tier, tier1Fields, tier2Fields, tier3Fields]);

  const fieldMeta = useMemo(() => {
    const map = new Map<FieldKey, { label: string; pii?: boolean; heavy?: boolean }>();
    for (const f of ALL_FIELDS) map.set(f.key, f);
    return map;
  }, []);

  const piiSelected = useMemo(() => {
    return effectiveFields.some((k) => fieldMeta.get(k)?.pii);
  }, [effectiveFields, fieldMeta]);

  const heavySelected = useMemo(() => {
    return effectiveFields.some((k) => fieldMeta.get(k)?.heavy);
  }, [effectiveFields, fieldMeta]);

  const previewRows = useMemo(() => {
    // For preview we only show the selected fields
    return MOCK_CANDIDATES.map((c) => {
      const row: Record<string, string> = {};
      for (const key of effectiveFields) {
        const v = (c as any)[key];
        row[key] = v ? String(v) : "—";
      }
      return { id: c.id, row };
    });
  }, [effectiveFields]);

  function toggleField(which: Tier, key: FieldKey) {
    const getter = which === 1 ? tier1Fields : which === 2 ? tier2Fields : tier3Fields;
    const setter = which === 1 ? setTier1Fields : which === 2 ? setTier2Fields : setTier3Fields;

    if (getter.includes(key)) setter(getter.filter((x) => x !== key));
    else setter([...getter, key]);
  }

  const tierFieldsForUI = (t: Tier) => {
    if (t === 1) return tier1Fields;
    if (t === 2) return tier2Fields;
    return tier3Fields;
  };

  const tierSetterHint = (t: Tier) => {
    if (t === 1) return "Fields included in Tier 1.";
    if (t === 2) return "Tier 2 adds fields on top of Tier 1.";
    return "Tier 3 adds fields on top of Tier 2.";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm text-neutral-500">Customers / {customerId}</div>
          <h1 className="text-2xl font-semibold">Customer Approval Package</h1>
          <div className="text-sm text-neutral-600">
            UI-only shell for defining customer-specific approval packet tiers and previewing candidate packet contents.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/customers/${customerId}`)}
            className="px-3 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            ← Back to Customer
          </button>
          <button
            disabled
            className="px-3 py-2 rounded-md bg-neutral-900 text-white text-sm opacity-50 cursor-not-allowed"
            title="UI-only: sending/export is not implemented yet"
          >
            Generate Packet (Disabled)
          </button>
        </div>
      </div>

      {/* Top grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer card */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="font-medium">Customer</div>
            <span className={`text-xs px-2 py-1 rounded-full ${MOCK_CUSTOMER.approvalRequired ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
              {MOCK_CUSTOMER.approvalRequired ? "Approval Required" : "No Approval Required"}
            </span>
          </div>
          <div className="text-sm">
            <div className="text-neutral-500">Name</div>
            <div className="font-medium">{MOCK_CUSTOMER.name}</div>
          </div>

          <div className="text-sm space-y-2">
            <div className="text-neutral-500">Default Tier</div>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3].map((t) => {
                const tt = t as Tier;
                const active = tier === tt;
                return (
                  <button
                    key={t}
                    onClick={() => setTier(tt)}
                    className={`px-3 py-2 rounded-md border text-sm ${
                      active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    {tierLabel(tt)}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-neutral-500">
              Tier inheritance is enforced in preview: Tier 2 includes Tier 1; Tier 3 includes Tier 2.
            </div>
          </div>
        </div>

        {/* Delivery card */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="font-medium">Delivery Method (UI-only)</div>
          <div className="text-sm text-neutral-600">
            This controls how the customer receives the packet. Execution (send/export/link) is intentionally deferred.
          </div>

          <div className="flex gap-2 flex-wrap">
            {(["secure_link", "email", "export"] as const).map((v) => {
              const active = delivery === v;
              return (
                <button
                  key={v}
                  onClick={() => setDelivery(v)}
                  className={`px-3 py-2 rounded-md border text-sm ${
                    active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  {deliveryLabel(v)}
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50 text-sm space-y-1">
            <div className="font-medium">Compliance Notes</div>
            <ul className="list-disc pl-5 text-neutral-700 space-y-1">
              <li>PII fields (DOB/SSN) must be customer-approved and governed.</li>
              <li>Tiering exists to match customer safeguards & onboarding requirements.</li>
              <li>Final delivery will require audit trail (sent/viewed/approved).</li>
            </ul>
          </div>
        </div>

        {/* Risk/flags card */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="font-medium">Packet Flags</div>
          <div className="text-sm text-neutral-600">These flags reflect the current tier + fields selected.</div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-neutral-600">PII Included</div>
              <div className={`font-medium ${piiSelected ? "text-amber-700" : "text-green-700"}`}>{piiSelected ? "YES" : "NO"}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-neutral-600">Heavy Attachments (Resumes)</div>
              <div className={`font-medium ${heavySelected ? "text-amber-700" : "text-green-700"}`}>{heavySelected ? "YES" : "NO"}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-neutral-600">Candidates in Preview</div>
              <div className="font-medium">{MOCK_CANDIDATES.length}</div>
            </div>
          </div>

          <div className="text-xs text-neutral-500">
            UI-only note: later we'll enforce "approval required" gates on dispatch/invoicing, and attach auditing.
          </div>
        </div>
      </div>

      {/* Tier field selectors */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((t) => {
          const tt = t as Tier;
          const selected = tierFieldsForUI(tt);
          return (
            <div key={t} className="rounded-xl border border-neutral-200 p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{tierLabel(tt)}</div>
                <span className="text-xs text-neutral-500">{tierSetterHint(tt)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_FIELDS.map((f) => {
                  const on = selected.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => toggleField(tt, f.key)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm ${
                        on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-50"
                      }`}
                      title={f.pii ? "PII field" : f.heavy ? "Attachment/large payload" : ""}
                    >
                      <span className="flex items-center gap-2">
                        <span>{f.label}</span>
                        {f.pii ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${on ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>PII</span> : null}
                        {f.heavy ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${on ? "bg-white/20" : "bg-blue-100 text-blue-800"}`}>HEAVY</span> : null}
                      </span>
                      <span className="text-xs">{on ? "On" : "Off"}</span>
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-neutral-500">
                Tip: Tier 2 and Tier 3 are "additive". Final preview uses inheritance, not just the tier's local toggles.
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-medium">Packet Preview</div>
            <div className="text-sm text-neutral-600">
              Showing fields for <span className="font-medium">{tierLabel(tier)}</span> with tier inheritance applied.
            </div>
          </div>

          <div className="flex gap-2">
            <button
              disabled
              className="px-3 py-2 rounded-md border border-neutral-300 text-sm opacity-50 cursor-not-allowed"
              title="UI-only: export not implemented"
            >
              Export (Disabled)
            </button>
            <button
              disabled
              className="px-3 py-2 rounded-md border border-neutral-300 text-sm opacity-50 cursor-not-allowed"
              title="UI-only: send not implemented"
            >
              Send to Customer (Disabled)
            </button>
          </div>
        </div>

        <div className="overflow-auto border border-neutral-200 rounded-lg">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {effectiveFields.map((k) => (
                  <th key={k} className="text-left px-3 py-2 font-medium">
                    {fieldMeta.get(k)?.label ?? k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  {effectiveFields.map((k) => (
                    <td key={k} className="px-3 py-2 text-neutral-800">
                      {r.row[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-neutral-500">
          This preview is mock-driven. Later: bind to selected candidates from vetting + enforce customer approval gates.
        </div>
      </div>
    </div>
  );
}
