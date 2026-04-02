"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ApprovalTier = "TIER_1" | "TIER_2" | "TIER_3";
type TierNumber = 1 | 2 | 3;

interface FieldDefinition {
  id: string;
  fieldKey: string;
  displayName: string;
  sourceSystem: string;
  isPii: boolean;
  dataType: string;
  description: string | null;
  sortOrder: number;
}

interface TierFieldToggle {
  fieldDefinitionId: string;
  tier: ApprovalTier;
  included: boolean;
}

interface ApprovalPackageData {
  approvalRequired: boolean;
  defaultTier: ApprovalTier;
  fieldDefinitions: FieldDefinition[];
  tierFields: TierFieldToggle[];
}

const TIER_MAP: Record<TierNumber, ApprovalTier> = { 1: "TIER_1", 2: "TIER_2", 3: "TIER_3" };
const TIER_REVERSE: Record<ApprovalTier, TierNumber> = { TIER_1: 1, TIER_2: 2, TIER_3: 3 };

function tierLabel(t: TierNumber) {
  if (t === 1) return "Tier 1 — Basic";
  if (t === 2) return "Tier 2 — Standard";
  return "Tier 3 — Full Packet";
}

function deliveryLabel(v: string) {
  if (v === "secure_link") return "Secure Link (Magic Link)";
  if (v === "email") return "Email (Attachment/Link)";
  if (v === "export") return "Export (CSV/XLSX/PDF)";
  return v;
}

const MOCK_CANDIDATES = [
  { id: "cand_001", fullName: "James Holloway", trade: "Millwright", phone: "(713) 555-0144", email: "j.holloway@example.com", dob: "1991-08-12", ssnLast4: "4821", ssnFull: "XXX-XX-4821", address: "Houston, TX", resume: "Resume.pdf", certSummary: "MSHA 48B • OSHA-10 • TWIC", drugScreen: "Passed (2026-02-01)", background: "Clear (2026-01-28)", siteBadging: "Pending", notes: "Strong refinery turnaround experience." },
  { id: "cand_002", fullName: "Anthony Reyes", trade: "Pipefitter", phone: "(832) 555-0199", email: "a.reyes@example.com", dob: "1987-03-05", ssnLast4: "1107", ssnFull: "XXX-XX-1107", address: "Pasadena, TX", resume: "Resume.pdf", certSummary: "NCCER PF • OSHA-30", drugScreen: "Scheduled", background: "In Progress", siteBadging: "Not Started", notes: "Needs customer badge + background completion." },
  { id: "cand_003", fullName: "Caleb Nguyen", trade: "Welder", phone: "(281) 555-0102", email: "c.nguyen@example.com", dob: "1994-11-21", ssnLast4: "7740", ssnFull: "XXX-XX-7740", address: "Baytown, TX", resume: "Resume.pdf", certSummary: "6G Pipe • OSHA-10", drugScreen: "Passed (2026-01-30)", background: "Clear (2026-01-29)", siteBadging: "Ready", notes: "High performer, prior site access." },
];

export default function CustomerApprovalPackagePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customerId = params?.id ?? "unknown";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [defaultTier, setDefaultTier] = useState<TierNumber>(1);
  const [delivery, setDelivery] = useState<"secure_link" | "email" | "export">("secure_link");

  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [tierInclusions, setTierInclusions] = useState<Record<string, Record<ApprovalTier, boolean>>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pkg, customer] = await Promise.all([
        apiFetch<ApprovalPackageData>(`/customers/${customerId}/approval-package`),
        apiFetch<{ id: string; name: string }>(`/customers/${customerId}`),
      ]);

      setCustomerName(customer.name);
      setApprovalRequired(pkg.approvalRequired);
      setDefaultTier(TIER_REVERSE[pkg.defaultTier] ?? 1);
      setFieldDefinitions(pkg.fieldDefinitions);

      const inclusions: Record<string, Record<ApprovalTier, boolean>> = {};
      for (const fd of pkg.fieldDefinitions) {
        inclusions[fd.id] = { TIER_1: false, TIER_2: false, TIER_3: false };
      }
      for (const tf of pkg.tierFields) {
        if (inclusions[tf.fieldDefinitionId]) {
          inclusions[tf.fieldDefinitionId][tf.tier] = tf.included;
        }
      }
      setTierInclusions(inclusions);
    } catch (err) {
      console.error("Failed to load approval package:", err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const tierFields: TierFieldToggle[] = [];
      for (const [fieldDefId, tiers] of Object.entries(tierInclusions)) {
        for (const tier of ["TIER_1", "TIER_2", "TIER_3"] as ApprovalTier[]) {
          tierFields.push({
            fieldDefinitionId: fieldDefId,
            tier,
            included: tiers[tier] ?? false,
          });
        }
      }

      const result = await apiFetch<ApprovalPackageData>(`/customers/${customerId}/approval-package`, {
        method: "PUT",
        body: JSON.stringify({
          approvalRequired,
          defaultTier: TIER_MAP[defaultTier],
          tierFields,
        }),
      });

      setApprovalRequired(result.approvalRequired);
      setDefaultTier(TIER_REVERSE[result.defaultTier] ?? 1);
      const newInclusions: Record<string, Record<ApprovalTier, boolean>> = {};
      for (const fd of result.fieldDefinitions) {
        newInclusions[fd.id] = { TIER_1: false, TIER_2: false, TIER_3: false };
      }
      for (const tf of result.tierFields) {
        if (newInclusions[tf.fieldDefinitionId]) {
          newInclusions[tf.fieldDefinitionId][tf.tier] = tf.included;
        }
      }
      setTierInclusions(newInclusions);

      setSaveMessage("Saved successfully");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save approval package:", err);
      setSaveMessage("Save failed");
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  function toggleField(tierNum: TierNumber, fieldDefId: string) {
    const tierKey = TIER_MAP[tierNum];
    setTierInclusions((prev) => ({
      ...prev,
      [fieldDefId]: {
        ...prev[fieldDefId],
        [tierKey]: !prev[fieldDefId]?.[tierKey],
      },
    }));
  }

  function isFieldIncluded(tierNum: TierNumber, fieldDefId: string): boolean {
    return tierInclusions[fieldDefId]?.[TIER_MAP[tierNum]] ?? false;
  }

  const selectedTierFields = useMemo(() => {
    const tierKey = TIER_MAP[defaultTier];
    return fieldDefinitions.filter((fd) => tierInclusions[fd.id]?.[tierKey]);
  }, [defaultTier, fieldDefinitions, tierInclusions]);

  const fieldMeta = useMemo(() => {
    const map = new Map<string, FieldDefinition>();
    for (const f of fieldDefinitions) map.set(f.fieldKey, f);
    return map;
  }, [fieldDefinitions]);

  const piiSelected = useMemo(() => {
    return selectedTierFields.some((f) => f.isPii);
  }, [selectedTierFields]);

  const heavySelected = useMemo(() => {
    return selectedTierFields.some((f) => f.dataType === "DOCUMENT");
  }, [selectedTierFields]);

  const previewRows = useMemo(() => {
    return MOCK_CANDIDATES.map((c) => {
      const row: Record<string, string> = {};
      for (const fd of selectedTierFields) {
        const v = (c as any)[fd.fieldKey];
        row[fd.fieldKey] = v ? String(v) : "—";
      }
      return { id: c.id, row };
    });
  }, [selectedTierFields]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm text-neutral-500">Customers / {customerId}</div>
            <h1 className="text-2xl font-semibold">Customer Approval Package</h1>
          </div>
          <button
            onClick={() => router.push(`/customers/${customerId}`)}
            className="px-3 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            &larr; Back to Customer
          </button>
        </div>
        <div className="text-sm text-neutral-500">Loading approval package configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm text-neutral-500">Customers / {customerId}</div>
          <h1 className="text-2xl font-semibold">Customer Approval Package</h1>
          <div className="text-sm text-neutral-600">
            Define customer-specific approval packet tiers and preview candidate packet contents.
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes("failed") ? "text-red-600" : "text-green-600"}`}>
              {saveMessage}
            </span>
          )}
          <button
            onClick={() => router.push(`/customers/${customerId}`)}
            className="px-3 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            &larr; Back to Customer
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-3 py-2 rounded-md bg-neutral-900 text-white text-sm ${saving ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-800"}`}
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* Top grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer card */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="font-medium">Customer</div>
            <button
              onClick={() => setApprovalRequired(!approvalRequired)}
              className={`text-xs px-2 py-1 rounded-full cursor-pointer ${approvalRequired ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
            >
              {approvalRequired ? "Approval Required" : "No Approval Required"}
            </button>
          </div>
          <div className="text-sm">
            <div className="text-neutral-500">Name</div>
            <div className="font-medium">{customerName || customerId}</div>
          </div>

          <div className="text-sm space-y-2">
            <div className="text-neutral-500">Default Tier</div>
            <div className="flex gap-2 flex-wrap">
              {([1, 2, 3] as TierNumber[]).map((t) => {
                const active = defaultTier === t;
                return (
                  <button
                    key={t}
                    onClick={() => setDefaultTier(t)}
                    className={`px-3 py-2 rounded-md border text-sm ${
                      active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    {tierLabel(t)}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-neutral-500">
              Each tier is an independent template. Selecting a default tier does not change field selections.
            </div>
          </div>
        </div>

        {/* Delivery card */}
        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="font-medium">Delivery Method (Deferred)</div>
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
          <div className="text-sm text-neutral-600">These flags reflect the default tier + fields selected.</div>

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
            Candidate preview uses mock data. Live candidate binding will come in a future phase.
          </div>
        </div>
      </div>

      {/* Tier field selectors */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {([1, 2, 3] as TierNumber[]).map((t) => (
          <div key={t} className="rounded-xl border border-neutral-200 p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{tierLabel(t)}</div>
              <span className="text-xs text-neutral-500">
                {fieldDefinitions.filter((fd) => isFieldIncluded(t, fd.id)).length} of {fieldDefinitions.length} fields selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fieldDefinitions.map((fd) => {
                const on = isFieldIncluded(t, fd.id);
                const isHeavy = fd.dataType === "DOCUMENT";
                return (
                  <button
                    key={fd.id}
                    onClick={() => toggleField(t, fd.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm ${
                      on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-50"
                    }`}
                    title={fd.isPii ? "PII field" : isHeavy ? "Attachment/large payload" : ""}
                  >
                    <span className="flex items-center gap-2">
                      <span>{fd.displayName}</span>
                      {fd.isPii ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${on ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>PII</span> : null}
                      {isHeavy ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${on ? "bg-white/20" : "bg-blue-100 text-blue-800"}`}>HEAVY</span> : null}
                    </span>
                    <span className="text-xs">{on ? "On" : "Off"}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-neutral-500">
              This tier is an independent template. Toggling fields here does not affect other tiers.
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-medium">Packet Preview</div>
            <div className="text-sm text-neutral-600">
              Showing fields for <span className="font-medium">{tierLabel(defaultTier)}</span> only (independent template).
            </div>
          </div>

          <div className="flex gap-2">
            <button
              disabled
              className="px-3 py-2 rounded-md border border-neutral-300 text-sm opacity-50 cursor-not-allowed"
              title="Export not implemented"
            >
              Export (Disabled)
            </button>
            <button
              disabled
              className="px-3 py-2 rounded-md border border-neutral-300 text-sm opacity-50 cursor-not-allowed"
              title="Send not implemented"
            >
              Send to Customer (Disabled)
            </button>
          </div>
        </div>

        <div className="overflow-auto border border-neutral-200 rounded-lg">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {selectedTierFields.map((fd) => (
                  <th key={fd.id} className="text-left px-3 py-2 font-medium">
                    {fd.displayName}
                  </th>
                ))}
                {selectedTierFields.length === 0 && (
                  <th className="text-left px-3 py-2 font-medium text-neutral-400">No fields selected for this tier</th>
                )}
              </tr>
            </thead>
            <tbody>
              {selectedTierFields.length > 0 && previewRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  {selectedTierFields.map((fd) => (
                    <td key={fd.id} className="px-3 py-2 text-neutral-800">
                      {r.row[fd.fieldKey]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-neutral-500">
          This preview uses mock candidate data. Live candidate binding will come in a future phase.
        </div>
      </div>
    </div>
  );
}
