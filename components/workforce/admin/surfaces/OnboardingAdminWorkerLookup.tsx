"use client";

/**
 * Phase 2 - worker lookup.
 *
 * Reaching a worker by name without going through a queue, for the case that actually happens:
 * someone telephones and asks about his paperwork.
 *
 * Two properties matter more than the search itself. There is no unbounded listing - a term is
 * required, and the server refuses one too short to identify anybody - and every result is
 * masked, so a search cannot become a way to read identity material in bulk.
 */

import { useState } from "react";
import Link from "next/link";
import {
  onboardingAdminPacketPath,
  onboardingAdminWorkerPath,
  searchOnboardingAdminWorkers,
} from "@/lib/workforce/onboardingAdminApi";
import { useOnboardingAdminResource } from "../useOnboardingAdminResource";
import { OnboardingAdminShell } from "../OnboardingAdminShell";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "../OnboardingAdminNotice";
import { OnboardingAdminPanel } from "../panels/DetailPanel";
import { OnboardingAdminPacketStateBadge } from "../panels/StatusPresentation";
import { OnboardingAdminPager } from "../panels/PagerControls";

export default function OnboardingAdminWorkerLookup() {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => searchOnboardingAdminWorkers(term, { page }),
    [term, page],
    { enabled: term.trim().length > 0 },
  );

  return (
    <OnboardingAdminShell
      title="Workers"
      subtitle="Find a worker by name. Identity is masked here and everywhere else in this workspace; revealing a protected value is a separate, audited act."
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
            <label className="oba-label" htmlFor="oba-worker-term">
              Worker name
            </label>
            <input
              id="oba-worker-term"
              className="oba-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Family name, given name, or both"
            />
          </div>
          <button type="submit" className="oba-btn oba-btn-primary">
            Search
          </button>
        </form>

        {term.trim().length === 0 ? (
          <p className="oba-notice-detail">
            Enter a name to search. This workspace does not list every worker: administrative
            reads are recorded against your name, and an unbounded listing would record nothing
            meaningful.
          </p>
        ) : null}
      </OnboardingAdminPanel>

      {loading ? <OnboardingAdminLoading label="Searching" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data && data.results.length === 0 ? (
        <OnboardingAdminEmpty
          title="No worker matches that name."
          detail="Try a shorter or differently spelled term."
        />
      ) : null}

      {data && data.results.length > 0 ? (
        <OnboardingAdminPanel title="Results">
          <table className="oba-table">
            <thead>
              <tr>
                <th scope="col">Worker</th>
                <th scope="col">Identity</th>
                <th scope="col">Location</th>
                <th scope="col">Packets</th>
                <th scope="col">Most recent packet</th>
                <th scope="col">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((result) => (
                <tr key={result.candidateId}>
                  <td>
                    <Link
                      className="oba-btn oba-btn-link"
                      href={onboardingAdminWorkerPath(result.candidateId)}
                    >
                      {result.displayName}
                    </Link>
                  </td>
                  <td className="oba-masked-value">
                    {result.maskedSsn ?? <span className="oba-field-absent">None on file</span>}
                  </td>
                  <td>
                    {[result.city, result.state].filter(Boolean).join(", ") || (
                      <span className="oba-field-absent">Not recorded</span>
                    )}
                  </td>
                  <td>{result.packetCount}</td>
                  <td>
                    {result.latestPacketState ? (
                      result.latestPacketId ? (
                        <Link href={onboardingAdminPacketPath(result.latestPacketId)}>
                          <OnboardingAdminPacketStateBadge state={result.latestPacketState} />
                        </Link>
                      ) : (
                        <OnboardingAdminPacketStateBadge state={result.latestPacketState} />
                      )
                    ) : (
                      <span className="oba-field-absent">No packet</span>
                    )}
                  </td>
                  <td>{result.outstandingModuleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <OnboardingAdminPager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            label="workers"
            onPage={setPage}
          />
        </OnboardingAdminPanel>
      ) : null}
    </OnboardingAdminShell>
  );
}
