"use client";

/**
 * Phase 2 - packet lookup and the administrative packet list.
 *
 * The same surface answers both of the questions an operator actually arrives with: "open this
 * packet" when he has an identifier, and "which packets does this worker have" when he has a
 * name. The server resolves either form of term, so the operator does not have to know which
 * kind of thing he is holding.
 *
 * Each row carries the packet's derived progress, so the list and the packet workspace cannot
 * disagree about how far along it is.
 */

import { useState } from "react";
import Link from "next/link";
import {
  lookupOnboardingAdminPackets,
  onboardingAdminPacketPath,
  onboardingAdminWorkerPath,
} from "@/lib/workforce/onboardingAdminApi";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel, OnboardingAdminTimestamp } from "../panels/DetailPanel";
import {
  OnboardingAdminPacketStateBadge,
  OnboardingAdminProgressBar,
} from "../panels/StatusPresentation";
import { OnboardingAdminPager } from "../panels/PagerControls";

export default function OnboardingAdminPacketLookup() {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => lookupOnboardingAdminPackets(term, { page }),
    [term, page],
    { enabled: term.trim().length > 0 },
  );

  return (
    <OnboardingAdminShell
      title="Packets"
      subtitle="Open a packet by its identifier, or list the packets belonging to a worker by name."
      backHref="/onboarding"
      backLabel="Dashboard"
    >
      <OnboardingAdminPanel title="Search">
        <form
          className="oba-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setTerm(draft);
          }}
        >
          <div>
            <label className="oba-label" htmlFor="oba-packet-term">
              Packet identifier or worker name
            </label>
            <input
              id="oba-packet-term"
              className="oba-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Packet id, or a worker's name"
            />
          </div>
          <button type="submit" className="oba-btn oba-btn-primary">
            Search
          </button>
        </form>
      </OnboardingAdminPanel>

      {loading ? <OnboardingAdminLoading label="Searching" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data && data.results.length === 0 ? (
        <OnboardingAdminEmpty
          title="No packet matches that."
          detail="A packet identifier must match exactly; a worker name may be partial."
        />
      ) : null}

      {data && data.results.length > 0 ? (
        <OnboardingAdminPanel title="Packets">
          <table className="oba-table">
            <thead>
              <tr>
                <th scope="col">Worker</th>
                <th scope="col">Packet</th>
                <th scope="col">State</th>
                <th scope="col">Progress</th>
                <th scope="col">Outstanding</th>
                <th scope="col">Last change</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map(({ worker, packet }) => (
                <tr key={packet.packetId}>
                  <td>
                    <Link
                      className="oba-btn oba-btn-link"
                      href={onboardingAdminWorkerPath(worker.candidateId)}
                    >
                      {worker.displayName}
                    </Link>
                  </td>
                  <td>
                    <Link
                      className="oba-btn oba-btn-link"
                      href={onboardingAdminPacketPath(packet.packetId)}
                    >
                      Version {packet.packetVersion}
                    </Link>
                  </td>
                  <td>
                    <OnboardingAdminPacketStateBadge state={packet.packetState} />
                  </td>
                  <td>
                    <OnboardingAdminProgressBar progress={packet.progress} />
                  </td>
                  <td>{packet.outstandingModuleKeys.length}</td>
                  <td>
                    <OnboardingAdminTimestamp value={packet.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <OnboardingAdminPager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            label="packets"
            onPage={setPage}
          />
        </OnboardingAdminPanel>
      ) : null}
    </OnboardingAdminShell>
  );
}
