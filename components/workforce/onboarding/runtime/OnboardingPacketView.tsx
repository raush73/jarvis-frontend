"use client";

/**
 * Phase 1 - one packet, in full.
 *
 * The worker's whole obligation for this packet: every module required of him, each with
 * its recorded status and its entry action, plus what re-entering the packet would do.
 *
 * Where the runtime holds more than one packet, this is also the selection surface's
 * destination: the worker chooses a packet and lands here. Where exactly one packet exists,
 * nothing asks him to choose - the dashboard sends him straight on.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ONBOARDING_HOME,
  getOnboardingPacket,
  resumePath,
} from "@/lib/workforce/onboardingRuntimeApi";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";
import OnboardingErrorNotice from "./OnboardingErrorNotice";
import OnboardingProgress from "./OnboardingProgress";
import ModuleCard from "./ModuleCard";
import RestartNotice from "./RestartNotice";
import { formatActivity } from "./PacketCard";
import OnboardingDocumentCapture from "../documents/OnboardingDocumentCapture";
import OnboardingExecutionCapture from "../execution/OnboardingExecutionCapture";

export function OnboardingPacketView({ invocationId }: { invocationId: string }) {
  const { runtime, loading, error, reload, findPacket } = useOnboardingRuntime();
  const packet = findPacket(invocationId);

  /*
    A packet identifier that is not in this worker's projection is put to the SERVER rather
    than answered here. The refusal that comes back is the authoritative one and is audited
    as a refused access attempt, so a fabricated identifier leaves a record instead of only
    a client-side dead end. Nothing about the outcome depends on this request: the identifier
    was already unreachable, and no read of another worker's packet is possible either way.
  */
  const [refusal, setRefusal] = useState<unknown>(null);
  useEffect(() => {
    if (!runtime || packet) return;
    let abandoned = false;
    void getOnboardingPacket(invocationId).catch((err: unknown) => {
      if (!abandoned) setRefusal(err);
    });
    return () => {
      abandoned = true;
    };
  }, [runtime, packet, invocationId]);

  if (loading && !runtime) {
    return <p className="wf-loading">Loading your onboarding.</p>;
  }

  if (error && !runtime) {
    return <OnboardingErrorNotice error={error} onRetry={() => void reload()} />;
  }

  if (!packet) {
    if (refusal) return <OnboardingErrorNotice error={refusal} />;
    return (
      <div className="wf-error" role="alert" data-error-kind="NOT_ROUTABLE">
        <p className="wf-error-title">We could not find that onboarding.</p>
        <p>
          It may not be part of what was assigned to you. Your onboarding home shows
          everything that is outstanding.
        </p>
        <div className="wf-btn-row" style={{ marginTop: 16 }}>
          <Link className="wf-btn wf-btn-primary" href={ONBOARDING_HOME}>
            Go to my onboarding
          </Link>
        </div>
      </div>
    );
  }

  const lastActivity = formatActivity(packet.lastActivityAt);

  return (
    <div className="ob-packet-view">
      <header className="wf-head">
        <p className="wf-eyebrow">Onboarding</p>
        <h1 className="wf-title">Your sections</h1>
        <p className="wf-intro">{packet.invocationReason}</p>
        <OnboardingProgress completion={packet.completion} />
        {lastActivity ? (
          <p className="wf-section-note">Last activity {lastActivity}</p>
        ) : null}
      </header>

      <div className="wf-card">
        <RestartNotice restart={packet.restart} subject="This onboarding" />

        {packet.resume ? (
          <div className="ob-next-action">
            <Link className="wf-btn wf-btn-primary" href={resumePath(packet.resume)}>
              Continue where I left off
            </Link>
          </div>
        ) : null}

        {/*
          The complete required set, in the order the server resolved. Out-of-order
          completion renders correctly because each card carries its own recorded status.
        */}
        <ul className="ob-module-list">
          {packet.modules.map((module) => (
            <ModuleCard
              key={module.moduleKey}
              invocationId={packet.invocationId}
              module={module}
            />
          ))}
        </ul>
      </div>

      {/*
        Phase 4. Renders only what the server declared for this packet, and renders nothing
        at all when no module has declared a document slot - which is every packet in this
        phase. Whether documents may be CHANGED is the same answer the sections use: a packet
        that has left the worker's hands is shown, never written to.
      */}
      <OnboardingDocumentCapture
        invocationId={packet.invocationId}
        changeable={packet.restart.posture !== "CLOSED"}
      />

      {/*
        Phase 5, and a SIBLING of the section above rather than a part of it. Both involve
        something a worker supplies; they answer to different authorities, and merging them
        would put one refusal vocabulary in charge of two kinds of record.

        Same posture as the documents: only what the server declared, nothing at all when no
        module has declared anything to execute - which is every packet in this phase - and
        the same answer about whether a closed packet may still be written to.

        It reports no completion. What finishes a module or a packet is the server's
        derivation, rendered above from the runtime projection, and an act performed here does
        not add a second opinion about it.
      */}
      <OnboardingExecutionCapture
        invocationId={packet.invocationId}
        changeable={packet.restart.posture !== "CLOSED"}
      />

      <div className="wf-btn-row">
        <Link className="wf-btn wf-btn-ghost wf-btn-sm" href={ONBOARDING_HOME}>
          Back to my onboarding
        </Link>
      </div>
    </div>
  );
}

export default OnboardingPacketView;
