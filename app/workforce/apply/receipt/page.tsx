"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type SubmissionReceipt,
  getReceipt,
} from "@/lib/workforce/workforceApi";
import { hasWorkerSession } from "@/lib/workforce/workerSession";

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "Not recorded";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * Application Receipt - the confirmation the worker sees after submitting.
 *
 * Shows the receipt number and submission time only. The receipt id is the worker's
 * non-sensitive confirmation reference; no internal identifier (candidate id,
 * application id, draft state) is exposed here.
 */
export default function ReceiptPage() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasWorkerSession()) {
        router.replace("/workforce/apply");
        return;
      }
      try {
        const value = await getReceipt();
        if (cancelled) return;
        setReceipt(value);
      } catch {
        if (!cancelled) {
          setError("We could not load your confirmation right now.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="wf-receipt">
        <p className="wf-loading">Loading your confirmation.</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="wf-receipt">
        <h1 className="wf-receipt-title">Confirmation unavailable</h1>
        <p className="wf-receipt-text">
          {error ?? "We could not load your confirmation."}
        </p>
      </div>
    );
  }

  if (!receipt.submitted) {
    return (
      <div className="wf-receipt">
        <h1 className="wf-receipt-title">Application not yet submitted</h1>
        <p className="wf-receipt-text">
          Your application has not been submitted yet. You can return to it and finish
          at any time.
        </p>
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          onClick={() => router.push("/workforce/apply/review")}
        >
          Return to my application
        </button>
      </div>
    );
  }

  return (
    <div className="wf-receipt">
      <div className="wf-receipt-badge" aria-hidden="true">
        &#10003;
      </div>
      <h1 className="wf-receipt-title">Application successfully submitted</h1>
      <p className="wf-receipt-text">{receipt.message}</p>

      <div className="wf-receipt-facts">
        <p className="wf-receipt-label">Application receipt number</p>
        <p className="wf-receipt-value">{receipt.submissionReceiptId}</p>
        <p className="wf-receipt-label">Submitted</p>
        <p className="wf-receipt-value">
          {formatSubmittedAt(receipt.submittedAt)}
        </p>
      </div>

      <p className="wf-receipt-text" style={{ marginBottom: 0 }}>
        A recruiter will review your application and contact you about next steps.
        Please keep your receipt number for your records. If you need to reach us about
        your application, refer to that number.
      </p>
    </div>
  );
}
