/**
 * Phase 2A - the two places a later phase plugs into the administrative workspace.
 *
 * Both are DECLARATIONS with no behavior behind them, and that is precisely what is under
 * test. The evidence slot must be a place a document will appear without being one that
 * retrieves a document, and a claimable queue must be recognizable as claimable without the
 * workspace being able to claim it.
 *
 * What each test really guards is the next phase: that Phase 4 can mount document retrieval,
 * and the phase that introduces the assignment record can mount claiming, without either one
 * having to modify this workspace.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/onboarding",
}));

vi.mock("@/lib/workforce/onboardingAdminApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingAdminApi")>();
  return { ...actual, listOnboardingAdminQueues: vi.fn() };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const { listOnboardingAdminQueues } = await import(
  "@/lib/workforce/onboardingAdminApi"
);
const { default: OnboardingAdminQueueIndex } = await import(
  "./surfaces/OnboardingAdminQueueIndex"
);
const {
  OnboardingAdminEvidencePanel,
  OnboardingAdminEvidenceSlot,
  registerOnboardingAdminEvidenceAffordance,
  resetOnboardingAdminEvidenceAffordance,
} = await import("./panels/EvidencePanel");
const { ONBOARDING_ADMIN_ALL_GRANTS, fixtureQueueDescriptor, fixtureSession } =
  await import("./adminTestFixtures");

beforeEach(() => {
  vi.clearAllMocks();
  resetOnboardingAdminEvidenceAffordance();
  session.mockReturnValue(fixtureSession(ONBOARDING_ADMIN_ALL_GRANTS));
});

afterEach(() => {
  cleanup();
  resetOnboardingAdminEvidenceAffordance();
});

/* ------------------------------------------------------------------- evidence */

describe("the evidence slot", () => {
  const SLOT = {
    slotKey: "FIXTURE_EVIDENCE",
    label: "Supporting document",
    description: "Recorded by the module that governs it.",
  };

  it("names the place evidence will appear and says it cannot yet be produced", () => {
    render(<OnboardingAdminEvidenceSlot slot={SLOT} />);

    expect(screen.getByText("Supporting document")).toBeTruthy();
    expect(
      screen.getByText("Document retrieval is not available in this phase"),
    ).toBeTruthy();
  });

  /**
   * A placeholder that fetched, linked, or embedded would be Phase 4 work arriving early.
   * There is no link and no image, so there is nothing to click that could disclose a
   * document this phase has no authorization path for.
   */
  it("offers nothing to retrieve a document with", () => {
    const { container } = render(<OnboardingAdminEvidenceSlot slot={SLOT} />);

    expect(container.querySelectorAll("a").length).toBe(0);
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.querySelectorAll("img, iframe, embed, object").length).toBe(0);
  });

  it("holds no document identifier, only the slot a module declared", () => {
    const { container } = render(<OnboardingAdminEvidenceSlot slot={SLOT} />);
    const element = container.querySelector("[data-evidence-slot]");

    expect(element?.getAttribute("data-evidence-slot")).toBe("FIXTURE_EVIDENCE");
    expect(container.textContent).not.toContain("documentId");
  });

  /**
   * The integration Phase 4 will perform, rehearsed: one registration, and every slot
   * already declared by every module is filled. No module panel and no file under this
   * folder changes.
   */
  it("fills every declared slot from one registration", () => {
    registerOnboardingAdminEvidenceAffordance((slot) => (
      <button type="button">Open {slot.label}</button>
    ));

    render(
      <OnboardingAdminEvidencePanel
        slots={[
          SLOT,
          { slotKey: "FIXTURE_SECOND", label: "Second document" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Open Supporting document" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Second document" })).toBeTruthy();
    expect(
      screen.queryByText("Document retrieval is not available in this phase"),
    ).toBeNull();
  });

  it("returns to its unavailable state when no affordance is registered", () => {
    render(<OnboardingAdminEvidencePanel slots={[SLOT]} />);

    expect(
      screen.getByText("Document retrieval is not available in this phase"),
    ).toBeTruthy();
  });

  it("states plainly when a module declares no evidence at all", () => {
    render(<OnboardingAdminEvidencePanel slots={[]} />);

    expect(screen.getByText("This module declares no supporting evidence.")).toBeTruthy();
  });
});

/* ---------------------------------------------------------- queue declaration */

describe("a queue's claim declaration", () => {
  it("shows nothing about claiming for a queue that declared nothing", async () => {
    vi.mocked(listOnboardingAdminQueues).mockResolvedValue([
      fixtureQueueDescriptor({ claimable: false }),
    ]);

    render(<OnboardingAdminQueueIndex />);

    expect(await screen.findByText("Fixture alpha review")).toBeTruthy();
    expect(screen.queryByText("Claimed before working")).toBeNull();
  });

  it("recognizes a claimable queue without any workspace change", async () => {
    vi.mocked(listOnboardingAdminQueues).mockResolvedValue([
      fixtureQueueDescriptor({ claimable: true }),
    ]);

    render(<OnboardingAdminQueueIndex />);

    expect(await screen.findByText("Claimed before working")).toBeTruthy();
  });

  /**
   * Recognizing the declaration is the whole of it. A control here would imply an
   * assignment record that does not exist, and an operator pressing it would be told
   * nothing by a workspace that cannot act.
   */
  it("offers no control that would claim anything", async () => {
    vi.mocked(listOnboardingAdminQueues).mockResolvedValue([
      fixtureQueueDescriptor({ claimable: true }),
    ]);

    const { container } = render(<OnboardingAdminQueueIndex />);
    await screen.findByText("Claimed before working");

    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.textContent).not.toMatch(/\bclaim this\b|\bassign\b|\brelease\b/i);
  });
});
