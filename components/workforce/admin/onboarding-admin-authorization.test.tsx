/**
 * Phase 2 - administrative authorization, masking, and refusal, as the operator meets them.
 *
 * These are the boundaries the phase is answerable for on the client side. The server enforces
 * every one of them independently, and these tests assert the interface consequence rather than
 * the enforcement: a control an operator holds no grant for is ABSENT, and a refusal is reported
 * with the code that explains it.
 *
 *  - Workspace admission: no grant, no workspace.
 *  - Navigation: a section the operator cannot use does not appear.
 *  - Audit: the trail is absent for an operator without the audit grant.
 *  - Reveal: the affordance is absent without the sensitive grant, requires a stated purpose,
 *    goes through the audited server path, and the disclosure is not retained.
 *  - Processing: a control cannot be exercised without confirmation, and a declared reason.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const pathname = vi.fn(() => "/onboarding");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => pathname(),
}));

vi.mock("@/lib/workforce/onboardingAdminApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingAdminApi")>();
  return {
    ...actual,
    getOnboardingAdminDashboard: vi.fn(),
    getOnboardingAdminWorker: vi.fn(),
    getOnboardingAdminPacket: vi.fn(),
    getOnboardingAdminPacketAudit: vi.fn(),
    executeOnboardingAdminAction: vi.fn(),
    revealOnboardingAdminSsn: vi.fn(),
  };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const {
  getOnboardingAdminPacket,
  getOnboardingAdminPacketAudit,
  getOnboardingAdminWorker,
  executeOnboardingAdminAction,
  revealOnboardingAdminSsn,
} = await import("@/lib/workforce/onboardingAdminApi");

const { OnboardingAdminGate } = await import("./OnboardingAdminGate");
const { OnboardingAdminNav } = await import("./OnboardingAdminNav");
const { OnboardingAdminMaskedValue } = await import("./panels/MaskedValue");
const { OnboardingAdminProcessingControls } = await import("./panels/ProcessingControls");
const { OnboardingAdminWorkerContextHeader } = await import("./panels/WorkerContextHeader");
const { default: OnboardingAdminPacketWorkspace } = await import(
  "./surfaces/OnboardingAdminPacketWorkspace"
);
const {
  ACTION_KEY,
  CANDIDATE_ID,
  PACKET_ID,
  ONBOARDING_ADMIN_ALL_GRANTS,
  fixtureAction,
  fixtureAudit,
  fixturePacket,
  fixtureProjection,
  fixtureSession,
  fixtureWorker,
} = await import("./adminTestFixtures");

const ACCESS = "workforce.onboarding.admin.access";
const WORKER_READ = "workforce.onboarding.admin.worker.read";
const AUDIT_READ = "workforce.onboarding.admin.audit.read";
const SSN_REVEAL = "workforce.ssn.reveal";

beforeEach(() => {
  vi.clearAllMocks();
  pathname.mockReturnValue("/onboarding");
  session.mockReturnValue(fixtureSession(ONBOARDING_ADMIN_ALL_GRANTS));
});

afterEach(() => {
  cleanup();
});

/* ------------------------------------------------------------------- admission */

describe("workspace admission", () => {
  it("waits rather than deciding while the session is still loading", () => {
    session.mockReturnValue(
      fixtureSession([], { ready: false, authenticated: false }),
    );

    render(
      <OnboardingAdminGate>
        <p>Workspace content</p>
      </OnboardingAdminGate>,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Workspace content")).toBeNull();
  });

  it("asks an unauthenticated visitor to sign in and shows nothing of the workspace", () => {
    session.mockReturnValue(fixtureSession([], { authenticated: false }));

    render(
      <OnboardingAdminGate>
        <p>Workspace content</p>
      </OnboardingAdminGate>,
    );

    expect(screen.getByText("Sign in to continue.")).toBeTruthy();
    expect(screen.queryByText("Workspace content")).toBeNull();
  });

  it("refuses a signed-in operator without the workspace grant", () => {
    session.mockReturnValue(fixtureSession(["some.other.permission"]));

    render(
      <OnboardingAdminGate>
        <p>Workspace content</p>
      </OnboardingAdminGate>,
    );

    expect(screen.getByText("You do not have access to this workspace.")).toBeTruthy();
    expect(screen.getByText(new RegExp(ACCESS))).toBeTruthy();
    expect(screen.queryByText("Workspace content")).toBeNull();
  });

  it("admits an operator who holds the workspace grant", () => {
    session.mockReturnValue(fixtureSession([ACCESS]));

    render(
      <OnboardingAdminGate>
        <p>Workspace content</p>
      </OnboardingAdminGate>,
    );

    expect(screen.getByText("Workspace content")).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ navigation */

describe("administrative navigation", () => {
  it("omits sections the operator holds no grant for", () => {
    session.mockReturnValue(fixtureSession([ACCESS]));

    render(<OnboardingAdminNav />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Queues" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Workers" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Packets" })).toBeNull();
  });

  it("adds the worker sections once the worker-read grant is held", () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));

    render(<OnboardingAdminNav />);

    expect(screen.getByRole("link", { name: "Workers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Packets" })).toBeTruthy();
  });

  it("marks the deepest matching section as current", () => {
    pathname.mockReturnValue("/onboarding/queues/FIXTURE_ALPHA_REVIEW");
    session.mockReturnValue(fixtureSession([ACCESS]));

    render(<OnboardingAdminNav />);

    expect(screen.getByRole("link", { name: "Queues" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("renders nothing at all for an operator with no grant", () => {
    session.mockReturnValue(fixtureSession([]));

    const { container } = render(<OnboardingAdminNav />);

    expect(container.querySelector("nav")).toBeNull();
  });
});

/* --------------------------------------------------------------------- masking */

describe("masked identity and authorized reveal", () => {
  it("shows the masked value with no reveal affordance when the grant is absent", () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));

    render(
      <OnboardingAdminMaskedValue
        label="Social Security number"
        maskedValue="***-**-4321"
        hasValue
        onReveal={async () => "123-45-6789"}
      />,
    );

    expect(screen.getByText("***-**-4321")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Reveal/i })).toBeNull();
  });

  it("offers no reveal when there is no value on file, grant or not", () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, SSN_REVEAL]));

    render(
      <OnboardingAdminMaskedValue
        label="Social Security number"
        maskedValue={null}
        hasValue={false}
        onReveal={async () => "123-45-6789"}
      />,
    );

    expect(screen.getByText("Not on file")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Reveal/i })).toBeNull();
  });

  it("requires a stated business purpose and passes it to the audited server path", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, SSN_REVEAL]));
    const onReveal = vi.fn(async () => "123-45-6789");

    render(
      <OnboardingAdminMaskedValue
        label="Social Security number"
        maskedValue="***-**-4321"
        hasValue
        onReveal={onReveal}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal full value" }));

    const confirm = screen.getByRole("button", { name: "Confirm and reveal" });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    expect(onReveal).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "Payroll correction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and reveal" }));

    await waitFor(() => expect(onReveal).toHaveBeenCalledWith("Payroll correction"));
    expect(await screen.findByText("123-45-6789")).toBeTruthy();
  });

  it("drops the revealed value when it is hidden again", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, SSN_REVEAL]));

    render(
      <OnboardingAdminMaskedValue
        label="Social Security number"
        maskedValue="***-**-4321"
        hasValue
        onReveal={async () => "123-45-6789"}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal full value" }));
    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "Payroll correction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and reveal" }));

    await screen.findByText("123-45-6789");
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));

    expect(screen.queryByText("123-45-6789")).toBeNull();
    expect(screen.getByText("***-**-4321")).toBeTruthy();
  });

  it("reports a refused reveal without disclosing anything", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, SSN_REVEAL]));
    const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");

    render(
      <OnboardingAdminMaskedValue
        label="Social Security number"
        maskedValue="***-**-4321"
        hasValue
        onReveal={async () => {
          throw new OnboardingAdminApiError({
            status: 403,
            code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
            message: "refused",
          });
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal full value" }));
    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "Payroll correction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and reveal" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("***-**-4321")).toBeTruthy();
  });

  it("reveals through the server's audited endpoint from the worker context header", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, AUDIT_READ, SSN_REVEAL]));
    vi.mocked(revealOnboardingAdminSsn).mockResolvedValue({
      candidateId: CANDIDATE_ID,
      value: "123-45-6789",
      revealedAt: "2026-02-07T12:00:00.000Z",
    });

    render(<OnboardingAdminWorkerContextHeader worker={fixtureWorker()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reveal full value" }));
    fireEvent.change(screen.getByLabelText("Business purpose"), {
      target: { value: "I-9 reverification" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and reveal" }));

    await waitFor(() =>
      expect(vi.mocked(revealOnboardingAdminSsn)).toHaveBeenCalledWith(
        CANDIDATE_ID,
        "I-9 reverification",
      ),
    );
  });
});

/* ------------------------------------------------------------------ processing */

describe("processing controls", () => {
  it("renders nothing when the server advertised no action", () => {
    const { container } = render(
      <OnboardingAdminProcessingControls
        actions={[]}
        candidateId={CANDIDATE_ID}
        packetId={PACKET_ID}
      />,
    );

    expect(container.textContent).toBe("");
  });

  it("takes no decision on a single click", () => {
    render(
      <OnboardingAdminProcessingControls
        actions={[fixtureAction()]}
        candidateId={CANDIDATE_ID}
        packetId={PACKET_ID}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Certify fixture alpha" }));

    expect(vi.mocked(executeOnboardingAdminAction)).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  });

  it("withholds confirmation until a declared reason is given, and sends it", async () => {
    vi.mocked(executeOnboardingAdminAction).mockResolvedValue({
      actionKey: ACTION_KEY,
      moduleKey: "FIXTURE_ALPHA",
      candidateId: CANDIDATE_ID,
      packetId: PACKET_ID,
      outcome: "RETURNED",
      detail: null,
      executedAt: "2026-02-07T12:00:00.000Z",
    });

    render(
      <OnboardingAdminProcessingControls
        actions={[fixtureAction({ requiresReason: true })]}
        candidateId={CANDIDATE_ID}
        packetId={PACKET_ID}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Certify fixture alpha" }));
    expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason (required)"), {
      target: { value: "Document illegible" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(vi.mocked(executeOnboardingAdminAction)).toHaveBeenCalledWith(ACTION_KEY, {
        candidateId: CANDIDATE_ID,
        packetId: PACKET_ID,
        reason: "Document illegible",
      }),
    );

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText(/recorded as RETURNED/)).toBeTruthy();
  });

  it("cannot act on a row that carries no packet", () => {
    render(
      <OnboardingAdminProcessingControls
        actions={[fixtureAction()]}
        candidateId={CANDIDATE_ID}
        packetId={null}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Certify fixture alpha" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("reports a refused execution with its code and records nothing", async () => {
    const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");
    vi.mocked(executeOnboardingAdminAction).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
        message: "refused",
      }),
    );

    render(
      <OnboardingAdminProcessingControls
        actions={[fixtureAction()]}
        candidateId={CANDIDATE_ID}
        packetId={PACKET_ID}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Certify fixture alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText(/ADMIN_FUNCTION_NOT_AUTHORIZED/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

/* ------------------------------------------------------- surface-level scoping */

describe("surface-level authorization", () => {
  beforeEach(() => {
    vi.mocked(getOnboardingAdminPacket).mockResolvedValue(fixturePacket());
    vi.mocked(getOnboardingAdminWorker).mockResolvedValue(fixtureProjection());
    vi.mocked(getOnboardingAdminPacketAudit).mockResolvedValue(fixtureAudit());
  });

  it("does not request or display the audit trail without the audit grant", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));

    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    await screen.findByText("Required modules");

    expect(vi.mocked(getOnboardingAdminPacketAudit)).not.toHaveBeenCalled();
    expect(screen.queryByText("Packet audit trail")).toBeNull();
    expect(screen.queryByRole("link", { name: "Investigate history" })).toBeNull();
  });

  it("requests and displays the audit trail once the audit grant is held", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, AUDIT_READ]));

    render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    expect(await screen.findByText("Packet audit trail")).toBeTruthy();
    expect(vi.mocked(getOnboardingAdminPacketAudit)).toHaveBeenCalled();
  });

  it("shows the masked identity and no unmasked value anywhere on the packet workspace", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, AUDIT_READ]));

    const { container } = render(<OnboardingAdminPacketWorkspace packetId={PACKET_ID} />);

    // The worker context is a second, dependent read: it can only be requested once the packet
    // has named its worker, so it settles after the module table does.
    expect(await screen.findByText("***-**-4321")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
  });
});
