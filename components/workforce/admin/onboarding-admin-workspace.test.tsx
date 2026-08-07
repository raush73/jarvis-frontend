/**
 * Phase 2 - the administrative workspace, rendered.
 *
 * The claims proven here are the phase's acceptance criteria, in the same terms:
 *
 *  - The dashboard, queues, lookups, packet workspace, worker workspace, and investigation all
 *    render from the server's reads, and none of them names an onboarding module.
 *  - A module that registers a queue and an action appears in the workspace with NO workspace code
 *    change, and a second, differently shaped fixture module appears the same way.
 *  - Progress is the server's derived figure: a differently composed packet changes what is
 *    displayed with no change here.
 *  - Identity is masked on every surface.
 *  - The investigation shows superseded versions alongside effective ones and writes nothing.
 *  - No business module exists, and nothing in this suite names one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/onboarding",
}));

vi.mock("@/lib/workforce/onboardingAdminApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingAdminApi")>();
  return {
    ...actual,
    getOnboardingAdminDashboard: vi.fn(),
    listOnboardingAdminQueues: vi.fn(),
    getOnboardingAdminQueue: vi.fn(),
    searchOnboardingAdminWorkers: vi.fn(),
    lookupOnboardingAdminPackets: vi.fn(),
    getOnboardingAdminWorker: vi.fn(),
    getOnboardingAdminInvestigation: vi.fn(),
    getOnboardingAdminPacket: vi.fn(),
    getOnboardingAdminPacketAudit: vi.fn(),
    executeOnboardingAdminAction: vi.fn(),
    revealOnboardingAdminSsn: vi.fn(),
  };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const {
  getOnboardingAdminDashboard,
  listOnboardingAdminQueues,
  getOnboardingAdminQueue,
  searchOnboardingAdminWorkers,
  lookupOnboardingAdminPackets,
  getOnboardingAdminWorker,
  getOnboardingAdminInvestigation,
  getOnboardingAdminPacket,
  getOnboardingAdminPacketAudit,
  executeOnboardingAdminAction,
} = await import("@/lib/workforce/onboardingAdminApi");

const { default: OnboardingAdminDashboard } = await import(
  "./surfaces/OnboardingAdminDashboard"
);
const { default: OnboardingAdminQueueIndex } = await import(
  "./surfaces/OnboardingAdminQueueIndex"
);
const { default: OnboardingAdminQueueView } = await import(
  "./surfaces/OnboardingAdminQueueView"
);
const { default: OnboardingAdminWorkerLookup } = await import(
  "./surfaces/OnboardingAdminWorkerLookup"
);
const { default: OnboardingAdminPacketLookup } = await import(
  "./surfaces/OnboardingAdminPacketLookup"
);
const { default: OnboardingAdminWorkerWorkspace } = await import(
  "./surfaces/OnboardingAdminWorkerWorkspace"
);
const { default: OnboardingAdminPacketWorkspace } = await import(
  "./surfaces/OnboardingAdminPacketWorkspace"
);
const { default: OnboardingAdminInvestigation } = await import(
  "./surfaces/OnboardingAdminInvestigation"
);
const { registerOnboardingAdminPanel, resetOnboardingAdminPanels } = await import(
  "./adminPanelRegistry"
);
const {
  ACTION_KEY,
  CANDIDATE_ID,
  PACKET_ID,
  QUEUE_KEY,
  ONBOARDING_ADMIN_ALL_GRANTS,
  fixtureAction,
  fixtureAudit,
  fixtureDashboard,
  fixtureInvestigation,
  fixtureModule,
  fixturePacket,
  fixtureProjection,
  fixtureQueue,
  fixtureQueueDescriptor,
  fixtureSession,
  fixtureWorker,
} = await import("./adminTestFixtures");

beforeEach(() => {
  vi.clearAllMocks();
  resetOnboardingAdminPanels();
  session.mockReturnValue(fixtureSession(ONBOARDING_ADMIN_ALL_GRANTS));
});

afterEach(() => {
  cleanup();
});

/* ------------------------------------------------------------------ dashboard */

describe("administrative dashboard", () => {
  it("presents outstanding work under the category of the module that registered it", async () => {
    vi.mocked(getOnboardingAdminDashboard).mockResolvedValue(fixtureDashboard());

    render(<OnboardingAdminDashboard />);

    expect(await screen.findByText("F1 · Fixture Alpha")).toBeTruthy();
    expect(screen.getByText("Fixture alpha review")).toBeTruthy();
    // The counts are the server's, shown as the server gave them.
    expect(screen.getByText("2 items outstanding")).toBeTruthy();
    expect(screen.getByText("Items awaiting administrative action")).toBeTruthy();
  });

  it("distinguishes no registered work from no authorized work", async () => {
    vi.mocked(getOnboardingAdminDashboard).mockResolvedValue(
      fixtureDashboard({
        outstandingCount: 0,
        categories: [],
        noRegisteredWork: true,
        noAuthorizedWork: false,
      }),
    );

    const first = render(<OnboardingAdminDashboard />);
    expect(
      await screen.findByText(/No onboarding module has registered administrative work/i),
    ).toBeTruthy();
    first.unmount();

    vi.mocked(getOnboardingAdminDashboard).mockResolvedValue(
      fixtureDashboard({
        outstandingCount: 0,
        categories: [],
        noRegisteredWork: false,
        noAuthorizedWork: true,
      }),
    );

    render(<OnboardingAdminDashboard />);
    expect(
      await screen.findByText(/No administrative work is assigned to your functions/i),
    ).toBeTruthy();
  });

  it("reports a refusal with its code rather than an empty screen", async () => {
    const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");
    vi.mocked(getOnboardingAdminDashboard).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
        message: "refused",
      }),
    );

    render(<OnboardingAdminDashboard />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/ADMIN_FUNCTION_NOT_AUTHORIZED/)).toBeTruthy();
  });
});

/* --------------------------------------------------------------------- queues */

describe("queue infrastructure", () => {
  it("lists only the registered queues the server returned", async () => {
    vi.mocked(listOnboardingAdminQueues).mockResolvedValue([
      fixtureQueueDescriptor(),
      fixtureQueueDescriptor({
        queueKey: "FIXTURE_BETA_PROCESSING",
        title: "Fixture beta processing",
        orientation: "PACKET",
        moduleKey: "FIXTURE_BETA",
        moduleNumber: "F2",
        moduleTitle: "Fixture Beta",
      }),
    ]);

    render(<OnboardingAdminQueueIndex />);

    expect(await screen.findByText("Fixture alpha review")).toBeTruthy();
    expect(screen.getByText("Fixture beta processing")).toBeTruthy();
    expect(screen.getByText("Whole packet")).toBeTruthy();
  });

  it("says so plainly when no queue is available", async () => {
    vi.mocked(listOnboardingAdminQueues).mockResolvedValue([]);

    render(<OnboardingAdminQueueIndex />);

    expect(await screen.findByText(/No queues are available to you/i)).toBeTruthy();
  });

  it("renders a module-contributed queue, masked, with the server's waiting figure", async () => {
    vi.mocked(getOnboardingAdminQueue).mockResolvedValue(fixtureQueue());

    render(<OnboardingAdminQueueView queueKey={QUEUE_KEY} />);

    expect(await screen.findByText("Rivers, Dana")).toBeTruthy();
    expect(screen.getByText("AWAITING REVIEW")).toBeTruthy();
    // Days waiting came from the server; nothing here subtracts dates.
    expect(screen.getByText("6")).toBeTruthy();
    // No unmasked identity value appears anywhere on the surface.
    expect(screen.queryByText(/\d{3}-\d{2}-\d{4}/)).toBeNull();
  });

  it("asks the server again when a filter or an order changes", async () => {
    vi.mocked(getOnboardingAdminQueue).mockResolvedValue(fixtureQueue());

    render(<OnboardingAdminQueueView queueKey={QUEUE_KEY} />);
    await screen.findByText("Rivers, Dana");

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "RETURNED" },
    });

    await waitFor(() => {
      expect(vi.mocked(getOnboardingAdminQueue)).toHaveBeenCalledWith(
        QUEUE_KEY,
        expect.objectContaining({ status: "RETURNED", page: 1 }),
      );
    });

    fireEvent.change(screen.getByLabelText("Order by"), { target: { value: "WORKER" } });

    await waitFor(() => {
      expect(vi.mocked(getOnboardingAdminQueue)).toHaveBeenCalledWith(
        QUEUE_KEY,
        expect.objectContaining({ sort: "WORKER" }),
      );
    });
  });

  it("executes a module-contributed action against the row's packet and reloads", async () => {
    vi.mocked(getOnboardingAdminQueue).mockResolvedValue(fixtureQueue());
    vi.mocked(executeOnboardingAdminAction).mockResolvedValue({
      actionKey: ACTION_KEY,
      moduleKey: "FIXTURE_ALPHA",
      candidateId: CANDIDATE_ID,
      packetId: PACKET_ID,
      outcome: "CERTIFIED",
      detail: null,
      executedAt: "2026-02-07T12:00:00.000Z",
    });

    render(<OnboardingAdminQueueView queueKey={QUEUE_KEY} />);
    await screen.findByText("Rivers, Dana");

    fireEvent.click(screen.getAllByRole("button", { name: "Act" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Certify fixture alpha" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(vi.mocked(executeOnboardingAdminAction)).toHaveBeenCalledWith(ACTION_KEY, {
        candidateId: CANDIDATE_ID,
        packetId: PACKET_ID,
        reason: null,
      });
    });

    // The queue is re-read afterwards rather than mutated locally: the server decides what is
    // still outstanding.
    await waitFor(() => {
      expect(vi.mocked(getOnboardingAdminQueue).mock.calls.length).toBeGreaterThan(1);
    });
  });
});

/* -------------------------------------------------------------------- lookups */

describe("worker and packet lookup", () => {
  it("does not search until a term is given, and masks every result", async () => {
    vi.mocked(searchOnboardingAdminWorkers).mockResolvedValue({
      total: 1,
      page: 1,
      pageSize: 25,
      results: [
        {
          ...fixtureWorker(),
          packetCount: 1,
          latestPacketState: "IN_PROGRESS",
          latestPacketId: PACKET_ID,
          outstandingModuleCount: 1,
        },
      ],
    });

    render(<OnboardingAdminWorkerLookup />);

    expect(vi.mocked(searchOnboardingAdminWorkers)).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Worker name"), { target: { value: "Rivers" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Rivers, Dana")).toBeTruthy();
    expect(screen.getByText("***-**-4321")).toBeTruthy();
    expect(vi.mocked(searchOnboardingAdminWorkers)).toHaveBeenCalledWith("Rivers", { page: 1 });
  });

  it("surfaces the server's refusal when a term is too short to identify anybody", async () => {
    const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");
    vi.mocked(searchOnboardingAdminWorkers).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 400,
        code: "ADMIN_SEARCH_TERM_TOO_SHORT",
        message: "too short",
      }),
    );

    render(<OnboardingAdminWorkerLookup />);
    fireEvent.change(screen.getByLabelText("Worker name"), { target: { value: "R" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/ADMIN_SEARCH_TERM_TOO_SHORT/)).toBeTruthy();
  });

  it("lists packets with the derived progress the server computed", async () => {
    vi.mocked(lookupOnboardingAdminPackets).mockResolvedValue({
      total: 1,
      page: 1,
      pageSize: 25,
      results: [{ worker: fixtureWorker(), packet: fixturePacket() }],
    });

    render(<OnboardingAdminPacketLookup />);
    fireEvent.change(screen.getByLabelText("Packet identifier or worker name"), {
      target: { value: PACKET_ID },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Version 1")).toBeTruthy();
    expect(screen.getByText(/1 of 2 modules complete/)).toBeTruthy();
  });
});

/* ----------------------------------------------------------- worker workspace */

describe("worker workspace", () => {
  it("separates a packet's completion from the worker's effective completion", async () => {
    vi.mocked(getOnboardingAdminWorker).mockResolvedValue(fixtureProjection());

    render(<OnboardingAdminWorkerWorkspace candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("Module completion in effect")).toBeTruthy();
    expect(screen.getByText("Fixture Beta")).toBeTruthy();
    expect(screen.getByText("FIXTURE_ALPHA")).toBeTruthy();
    expect(screen.getByText(/1 of 2 modules complete/)).toBeTruthy();
  });

  it("shows a worker with no packet as an empty state, not a failure", async () => {
    vi.mocked(getOnboardingAdminWorker).mockResolvedValue(
      fixtureProjection({
        packets: [],
        effectiveCompletion: [],
        outstandingModuleKeys: [],
        actions: [],
      }),
    );

    render(<OnboardingAdminWorkerWorkspace candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText(/This worker has no onboarding packet/i)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* ----------------------------------------------------------- packet workspace */

describe("packet workspace", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingAdminPacket).mockResolvedValue(fixturePacket());
    vi.mocked(getOnboardingAdminWorker).mockResolvedValue(fixtureProjection());
    vi.mocked(getOnboardingAdminPacketAudit).mockResolvedValue(fixtureAudit());
  });

  it("presents the required module set with per-module recorded status", async () => {
    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    expect(await screen.findByText("Required modules")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fixture Alpha" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fixture Beta" })).toBeTruthy();
    expect(screen.getByText("Outstanding")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
    // The administrative phase Fixture Beta declares is shown as outstanding, and as gating.
    expect(screen.getByText("Required, outstanding")).toBeTruthy();
  });

  it("takes the progress denominator from the packet's own composition", async () => {
    const single = fixturePacket({ modules: [fixtureModule()] });
    vi.mocked(getOnboardingAdminPacket).mockResolvedValue(single);

    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    expect(await screen.findByText(/0 of 1 modules complete/)).toBeTruthy();
  });

  it("shows the packet's audit trail and filters it through the server", async () => {
    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    expect(await screen.findByText("Packet audit trail")).toBeTruthy();
    expect(screen.getAllByRole("cell", { name: "MODULE DRAFT SAVED" }).length).toBe(1);

    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "MODULE_COMPLETION_RECORDED" },
    });

    await waitFor(() => {
      expect(vi.mocked(getOnboardingAdminPacketAudit)).toHaveBeenCalledWith(
        PACKET_ID,
        expect.objectContaining({ action: "MODULE_COMPLETION_RECORDED", page: 1 }),
      );
    });
  });

  it("states that a module has no registered administrative panel rather than inventing one", async () => {
    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Fixture Alpha" }));

    expect(
      await screen.findByText(/No administrative panel has been registered for FIXTURE_ALPHA/i),
    ).toBeTruthy();
  });

  it("mounts a registered module panel with no workspace change", async () => {
    registerOnboardingAdminPanel("FIXTURE_ALPHA", ({ worker, packet, module }) => (
      <div data-testid="fixture-alpha-panel">
        Fixture alpha panel for {worker.displayName} in {packet?.packetId} at {module?.moduleKey}
      </div>
    ));

    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Fixture Alpha" }));

    const panel = await screen.findByTestId("fixture-alpha-panel");
    expect(panel.textContent).toContain("Rivers, Dana");
    expect(panel.textContent).toContain(PACKET_ID);
    expect(panel.textContent).toContain("FIXTURE_ALPHA");
  });

  it("offers only the module's own registered actions in its review", async () => {
    vi.mocked(getOnboardingAdminWorker).mockResolvedValue(
      fixtureProjection({
        actions: [
          fixtureAction(),
          fixtureAction({
            actionKey: "FIXTURE_BETA_RECORD",
            title: "Record fixture beta",
            moduleKey: "FIXTURE_BETA",
          }),
        ],
      }),
    );

    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Fixture Alpha" }));

    expect(await screen.findByRole("button", { name: "Certify fixture alpha" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record fixture beta" })).toBeNull();
  });
});

/* ------------------------------------------------------------- investigation */

describe("investigation navigation", () => {
  it("reconstructs packets, the module timeline, and the audit trail", async () => {
    vi.mocked(getOnboardingAdminInvestigation).mockResolvedValue(fixtureInvestigation());

    render(<OnboardingAdminInvestigation candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("Module timeline")).toBeTruthy();
    expect(screen.getByText("Audit trail")).toBeTruthy();
    expect(screen.getByText("Version 1")).toBeTruthy();
  });

  it("shows superseded versions alongside the effective one", async () => {
    vi.mocked(getOnboardingAdminInvestigation).mockResolvedValue(fixtureInvestigation());

    render(<OnboardingAdminInvestigation candidateId={CANDIDATE_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open history" }));

    expect(await screen.findByText("Currently effective")).toBeTruthy();
    // Once as a column heading, once as the badge on the superseded version itself.
    expect(screen.getAllByText("Superseded").length).toBe(2);
    expect(screen.getByText("Not superseded")).toBeTruthy();
  });

  it("marks a module the registry no longer knows without hiding its history", async () => {
    vi.mocked(getOnboardingAdminInvestigation).mockResolvedValue(
      fixtureInvestigation({
        timeline: [
          {
            moduleKey: "FIXTURE_RETIRED",
            moduleNumber: "?",
            title: "FIXTURE_RETIRED",
            governanceSection: null,
            registered: false,
            currentlyEffectiveCount: 1,
            versions: [
              {
                completionId: "cmp_retired",
                qualifier: "DEFAULT",
                packetId: PACKET_ID,
                effectiveFrom: "2025-01-01T10:00:00.000Z",
                supersededAt: null,
                supersedesId: null,
                recordedByType: "WORKER",
                recordedById: CANDIDATE_ID,
                currentlyEffective: true,
              },
            ],
          },
        ],
      }),
    );

    render(<OnboardingAdminInvestigation candidateId={CANDIDATE_ID} />);

    expect(await screen.findByText("No longer registered")).toBeTruthy();
    expect(screen.getByText("FIXTURE_RETIRED")).toBeTruthy();
  });

  it("exposes no control that records anything", async () => {
    vi.mocked(getOnboardingAdminInvestigation).mockResolvedValue(fixtureInvestigation());

    render(<OnboardingAdminInvestigation candidateId={CANDIDATE_ID} />);
    await screen.findByText("Module timeline");

    fireEvent.click(screen.getByRole("button", { name: "Open history" }));
    await screen.findByText("Currently effective");

    // Every button on an investigation is navigation or disclosure. None executes an action:
    // investigation BEHAVIOUR belongs to a later phase, and this surface is its navigation only.
    expect(vi.mocked(executeOnboardingAdminAction)).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Certify/i })).toBeNull();
  });
});

/* ------------------------------------------------------ module independence */

describe("module independence", () => {
  it("serves a second, differently shaped fixture module with no workspace change", async () => {
    vi.mocked(getOnboardingAdminQueue).mockResolvedValue(
      fixtureQueue({
        queue: fixtureQueueDescriptor({
          queueKey: "FIXTURE_GAMMA_EXCEPTIONS",
          title: "Fixture gamma exceptions",
          description: "A differently shaped fixture queue.",
          orientation: "PACKET",
          moduleKey: "FIXTURE_GAMMA",
          moduleNumber: "F3",
          moduleTitle: "Fixture Gamma",
          governanceSection: "FIXTURE.md Section 3",
        }),
        availableStatuses: ["EXCEPTION_RAISED"],
        actions: [
          fixtureAction({
            actionKey: "FIXTURE_GAMMA_RESOLVE",
            title: "Resolve fixture gamma exception",
            moduleKey: "FIXTURE_GAMMA",
            moduleNumber: "F3",
            moduleTitle: "Fixture Gamma",
            requiresReason: true,
            outcomes: ["RESOLVED"],
          }),
        ],
        items: [
          {
            candidateId: CANDIDATE_ID,
            worker: fixtureWorker(),
            packetId: PACKET_ID,
            moduleKey: "FIXTURE_GAMMA",
            status: "EXCEPTION_RAISED",
            waitingSince: "2026-01-01T09:00:00.000Z",
            waitingDays: 37,
            detail: "Fixture exception",
          },
        ],
        total: 1,
      }),
    );

    render(<OnboardingAdminQueueView queueKey="FIXTURE_GAMMA_EXCEPTIONS" />);

    expect(await screen.findByText("Fixture gamma exceptions")).toBeTruthy();
    expect(screen.getByText("EXCEPTION RAISED")).toBeTruthy();
    expect(screen.getByText("37")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Act" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Resolve fixture gamma exception" }),
    );

    // The reason requirement is the ACTION's declaration, honoured without the workspace knowing
    // what kind of work it is.
    expect(await screen.findByLabelText("Reason (required)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);
  });
});
