"use client";

/**
 * Phase 2 - one registered queue.
 *
 * Filterable, sortable, paged, and entirely generic: the statuses in the filter are the ones the
 * queue's own items reported, the processing controls are the ones its module registered, and the
 * rows are whatever it resolved. Nothing about any particular kind of onboarding work appears
 * here, which is what lets one component serve every queue any module will ever contribute.
 *
 * Waiting time is the server's figure, not a client subtraction, so a row cannot claim a
 * different age than the queue it came from.
 */

import { useState } from "react";
import Link from "next/link";
import type { OnboardingAdminQueueRequest } from "@/lib/workforce/onboardingAdminApi";
import {
  getOnboardingAdminQueue,
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
import { OnboardingAdminQueueStatusBadge } from "../panels/StatusPresentation";
import { OnboardingAdminPager } from "../panels/PagerControls";
import { OnboardingAdminProcessingControls } from "../panels/ProcessingControls";

export default function OnboardingAdminQueueView({ queueKey }: { queueKey: string }) {
  const [request, setRequest] = useState<OnboardingAdminQueueRequest>({
    page: 1,
    sort: "WAITING_SINCE",
    direction: "ASC",
  });
  const [selected, setSelected] = useState<string | null>(null);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getOnboardingAdminQueue(queueKey, request),
    [queueKey, request],
  );

  const amend = (patch: Partial<OnboardingAdminQueueRequest>) =>
    setRequest((current) => ({ ...current, page: 1, ...patch }));

  const selectedItem = data?.items.find((item) => item.candidateId === selected) ?? null;

  return (
    <OnboardingAdminShell
      title={data?.queue.title ?? "Queue"}
      subtitle={data?.queue.description}
      backHref="/onboarding/queues"
      backLabel="All queues"
    >
      {loading ? <OnboardingAdminLoading label="Loading queue" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {data ? (
        <OnboardingAdminPanel
          title={`${data.queue.moduleNumber} · ${data.queue.moduleTitle}`}
          description={`Governed by ${data.queue.governanceSection}`}
        >
          <div className="oba-filters">
            <div>
              <label className="oba-label" htmlFor="oba-queue-status">
                Status
              </label>
              <select
                id="oba-queue-status"
                className="oba-select"
                value={request.status ?? ""}
                onChange={(event) => amend({ status: event.target.value || null })}
              >
                <option value="">Any status</option>
                {data.availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="oba-label" htmlFor="oba-queue-waiting">
                Waiting at least (days)
              </label>
              <input
                id="oba-queue-waiting"
                className="oba-input"
                type="number"
                min={0}
                value={request.waitingAtLeastDays ?? ""}
                onChange={(event) =>
                  amend({
                    waitingAtLeastDays: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </div>

            <div>
              <label className="oba-label" htmlFor="oba-queue-sort">
                Order by
              </label>
              <select
                id="oba-queue-sort"
                className="oba-select"
                value={request.sort ?? "WAITING_SINCE"}
                onChange={(event) =>
                  amend({ sort: event.target.value as OnboardingAdminQueueRequest["sort"] })
                }
              >
                <option value="WAITING_SINCE">Time waiting</option>
                <option value="WORKER">Worker</option>
                <option value="STATUS">Status</option>
                <option value="MODULE">Module</option>
              </select>
            </div>

            <div>
              <label className="oba-label" htmlFor="oba-queue-direction">
                Direction
              </label>
              <select
                id="oba-queue-direction"
                className="oba-select"
                value={request.direction ?? "ASC"}
                onChange={(event) =>
                  amend({
                    direction: event.target.value as OnboardingAdminQueueRequest["direction"],
                  })
                }
              >
                <option value="ASC">Oldest first</option>
                <option value="DESC">Newest first</option>
              </select>
            </div>
          </div>

          {data.items.length === 0 ? (
            <OnboardingAdminEmpty
              title="Nothing is waiting in this queue."
              detail="Either no work has reached it, or your filters exclude everything in it."
            />
          ) : (
            <table className="oba-table">
              <thead>
                <tr>
                  <th scope="col">Worker</th>
                  <th scope="col">Status</th>
                  <th scope="col">Waiting since</th>
                  <th scope="col">Days</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Open</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={`${item.candidateId}:${item.packetId ?? "none"}`}
                    className={
                      item.candidateId === selected ? "oba-row-selected" : undefined
                    }
                  >
                    <td>{item.worker.displayName}</td>
                    <td>
                      <OnboardingAdminQueueStatusBadge status={item.status} />
                    </td>
                    <td>
                      <OnboardingAdminTimestamp value={item.waitingSince} />
                    </td>
                    <td>{item.waitingDays}</td>
                    <td className="oba-cell-detail">{item.detail ?? "—"}</td>
                    <td>
                      <Link
                        className="oba-btn oba-btn-link"
                        href={onboardingAdminWorkerPath(item.candidateId)}
                      >
                        Worker
                      </Link>
                      {item.packetId ? (
                        <>
                          {" · "}
                          <Link
                            className="oba-btn oba-btn-link"
                            href={onboardingAdminPacketPath(item.packetId)}
                          >
                            Packet
                          </Link>
                        </>
                      ) : null}
                      {data.actions.length > 0 ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="oba-btn oba-btn-link"
                            onClick={() =>
                              setSelected(item.candidateId === selected ? null : item.candidateId)
                            }
                          >
                            {item.candidateId === selected ? "Hide actions" : "Act"}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedItem ? (
            <OnboardingAdminProcessingControls
              actions={data.actions}
              candidateId={selectedItem.candidateId}
              packetId={selectedItem.packetId}
              onExecuted={() => {
                setSelected(null);
                reload();
              }}
            />
          ) : null}

          <OnboardingAdminPager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            label="items"
            onPage={(page) => setRequest((current) => ({ ...current, page }))}
          />
        </OnboardingAdminPanel>
      ) : null}
    </OnboardingAdminShell>
  );
}
