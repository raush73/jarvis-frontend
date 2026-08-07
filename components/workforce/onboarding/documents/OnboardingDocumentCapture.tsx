"use client";

/**
 * Phase 4 - the document section of a packet.
 *
 * Renders whatever governed slots the SERVER declared for this packet, and renders NOTHING
 * when there are none. That is the expected state in this phase, which ships the foundation
 * and zero business modules: an empty section must be invisible rather than an empty heading
 * suggesting the worker has documents outstanding.
 *
 * It holds no list of slots, no slot names, and no per-module special case, so a module that
 * declares a slot in a later phase appears here without this file changing.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getOnboardingDocumentDownload,
  getOnboardingDocumentSlots,
  type OnboardingDocumentSlot,
} from "@/lib/workforce/onboardingDocumentApi";
import OnboardingErrorNotice from "../runtime/OnboardingErrorNotice";
import DocumentSlotCapture from "./DocumentSlotCapture";

type Props = {
  invocationId: string;
  /** False for a packet that has left the worker's hands: shown, never changed. */
  changeable?: boolean;
};

export function OnboardingDocumentCapture({
  invocationId,
  changeable = true,
}: Props) {
  const [slots, setSlots] = useState<OnboardingDocumentSlot[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  /** Bumped to ask for the slots again after a capture changes one. */
  const [reloads, setReloads] = useState(0);

  const load = useCallback(async () => {
    setReloads((count) => count + 1);
  }, []);

  useEffect(() => {
    // `live` guards a response that arrives after the packet changed, which would otherwise
    // show one packet's slots under another's heading.
    let live = true;
    getOnboardingDocumentSlots(invocationId)
      .then((value) => {
        if (!live) return;
        setSlots(value);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (live) setError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads]);

  /**
   * Open the artifact through the AUTHORIZED retrieval path.
   *
   * The URL is fetched at the moment of viewing rather than held on the page, so a link that
   * lingers in a rendered document cannot outlive its short expiry.
   */
  const view = useCallback(
    async (onboardingDocumentId: string) => {
      const download = await getOnboardingDocumentDownload(
        invocationId,
        onboardingDocumentId,
      );
      window.open(download.url, "_blank", "noopener,noreferrer");
    },
    [invocationId],
  );

  if (error) {
    return <OnboardingErrorNotice error={error} onRetry={() => void load()} />;
  }

  // Nothing at all until the server has spoken, and nothing ever if it declared no slots.
  if (!slots || slots.length === 0) return null;

  return (
    <section className="ob-doc-section" aria-labelledby="ob-doc-heading">
      <h2 className="wf-section-title" id="ob-doc-heading">
        Your documents
      </h2>
      <ul className="ob-doc-list">
        {slots.map((slot) =>
          changeable ? (
            <DocumentSlotCapture
              key={`${slot.moduleKey}:${slot.slotKey}`}
              invocationId={invocationId}
              slot={slot}
              onChanged={load}
              onView={view}
            />
          ) : (
            <li
              key={`${slot.moduleKey}:${slot.slotKey}`}
              className="wf-card ob-doc-slot"
              data-slot-key={slot.slotKey}
              data-capture-status="READ_ONLY"
            >
              <h3 className="wf-section-title">{slot.title}</h3>
              <p className="wf-empty">
                {slot.current
                  ? `${slot.current.fileName} is on your record.`
                  : "Nothing was provided for this document."}
              </p>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

export default OnboardingDocumentCapture;
