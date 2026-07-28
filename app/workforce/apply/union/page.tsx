"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import {
  WorkforceApiError,
  getLegal,
  saveUnionAffiliation,
} from "@/lib/workforce/workforceApi";

/**
 * Union Affiliation screen - a required question in the backend
 * LEGAL_ACKNOWLEDGEMENTS stage.
 *
 * The answer is captured and preserved on the immutable submitted application. No
 * hiring policy, eligibility rule, or disposition is applied here or in the backend;
 * the recruiter review workflow consumes the answer.
 */
export default function UnionPage() {
  const [affiliated, setAffiliated] = useState<boolean | null>(null);
  const [unionName, setUnionName] = useState("");
  const [localNumber, setLocalNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const stage = await getLegal();
        if (cancelled) return;
        setAffiliated(stage.unionAffiliation.isUnionAffiliated);
        setUnionName(stage.unionAffiliation.unionName ?? "");
        setLocalNumber(stage.unionAffiliation.localNumber ?? "");
      } catch (err) {
        if (!cancelled) setStageError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = useCallback(async () => {
    if (affiliated === null) {
      throw new WorkforceApiError(
        "Please answer the union affiliation question.",
        400,
      );
    }
    if (affiliated && !unionName.trim()) {
      throw new WorkforceApiError("Please enter the name of your union.", 400);
    }
    await saveUnionAffiliation(
      affiliated
        ? {
            isUnionAffiliated: true,
            unionName: unionName.trim(),
            ...(localNumber.trim() ? { localNumber: localNumber.trim() } : {}),
          }
        : { isUnionAffiliated: false },
    );
  }, [affiliated, localNumber, unionName]);

  return (
    <WorkforceWizardShell
      slug="union"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="This question is required. Your answer is recorded with your application for the recruiter reviewing it."
    >
      <div className="wf-section">
        <h2 className="wf-section-title">
          Are you currently, or have you previously been, a member of a union?
        </h2>
        <p className="wf-section-note">
          Answer accurately. Your answer is recorded as part of your application.
        </p>
        <DeclarationChoice
          name="isUnionAffiliated"
          value={affiliated}
          onChange={(v) => {
            setAffiliated(v);
            if (!v) {
              setUnionName("");
              setLocalNumber("");
            }
          }}
          yesLabel="Yes, I am or have been a union member"
          noLabel="No, I am not and have not been a union member"
        />
      </div>

      {affiliated ? (
        <div className="wf-section">
          <h2 className="wf-section-title">Union details</h2>
          <div className="wf-grid">
            <label className="wf-field">
              <span className="wf-label">
                Union name <span className="wf-req">*</span>
              </span>
              <input
                className="wf-input"
                value={unionName}
                onChange={(e) => setUnionName(e.target.value)}
                placeholder="For example, UA or IBEW"
                maxLength={120}
              />
            </label>

            <label className="wf-field">
              <span className="wf-label">Local number</span>
              <input
                className="wf-input"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                placeholder="For example, 286"
                maxLength={40}
              />
            </label>
          </div>
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
