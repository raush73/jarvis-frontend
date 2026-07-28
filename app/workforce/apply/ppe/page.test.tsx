import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerSessionExpiredError } from "@/lib/workforce/workforceApi";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import PpePage from "./page";

/**
 * PPE is where C4D browser validation hit the wall: the stage load failed on an ended
 * session, the failure was discarded, and the worker was shown a healthy-looking blank
 * stage. These tests hold that behaviour closed.
 */

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/workforce/workforceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/workforceApi")>();
  return {
    ...actual,
    getPpeRegistry: vi.fn(),
    getToolsPpe: vi.fn(),
    savePpe: vi.fn(),
    setPpeDeclaration: vi.fn(),
  };
});

const api = await import("@/lib/workforce/workforceApi");
const getPpeRegistry = vi.mocked(api.getPpeRegistry);
const getToolsPpe = vi.mocked(api.getToolsPpe);
const setPpeDeclaration = vi.mocked(api.setPpeDeclaration);

const PPE_QUESTION = "I have my own personal protective equipment";

/** C4E: the stage now receives the grouped, server-ordered consumer projection. */
const PPE_CATALOG: Awaited<ReturnType<typeof api.getPpeRegistry>> = {
  catalogKey: "PPE",
  categorized: true,
  groups: [
    {
      category: "Head Protection",
      displayOrder: 0,
      options: [{ id: "ppe_1", name: "Hard hat", displayOrder: 0 }],
    },
  ],
};

const EMPTY_STAGE: Awaited<ReturnType<typeof api.getToolsPpe>> = {
  hasTools: null,
  tools: [],
  hasPpe: null,
  ppe: [],
};

describe("PPE stage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    saveWorkerSession({
      token: "original-token",
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      applicationSessionId: "apps_durable",
      candidateId: null,
    });
  });

  afterEach(cleanup);

  it("renders the stage when it loads", async () => {
    getPpeRegistry.mockResolvedValue(PPE_CATALOG);
    getToolsPpe.mockResolvedValue(EMPTY_STAGE);

    render(<PpePage />);

    expect(await screen.findByText(PPE_QUESTION)).toBeTruthy();
  });

  it("surfaces an expired session from the stage load instead of swallowing it", async () => {
    getPpeRegistry.mockRejectedValue(new WorkerSessionExpiredError());
    getToolsPpe.mockRejectedValue(new WorkerSessionExpiredError());

    render(<PpePage />);

    expect(
      await screen.findByText("Your secure application session expired."),
    ).toBeTruthy();
  });

  it("does not present a healthy empty stage after the session ended", async () => {
    getPpeRegistry.mockRejectedValue(new WorkerSessionExpiredError());
    getToolsPpe.mockRejectedValue(new WorkerSessionExpiredError());

    render(<PpePage />);
    await screen.findByText("Your secure application session expired.");

    expect(screen.queryByText(PPE_QUESTION)).toBeNull();
    expect(screen.queryByRole("button", { name: "Save & Continue" })).toBeNull();
  });

  it("keeps the durable application session identifier after the load fails", async () => {
    getPpeRegistry.mockRejectedValue(new WorkerSessionExpiredError());
    getToolsPpe.mockRejectedValue(new WorkerSessionExpiredError());

    render(<PpePage />);
    await screen.findByText("Your secure application session expired.");

    expect(localStorage.getItem("jp_workerApplicationSessionId")).toBe("apps_durable");
  });

  it("surfaces an expired session raised by answering the question", async () => {
    getPpeRegistry.mockResolvedValue(PPE_CATALOG);
    getToolsPpe.mockResolvedValue(EMPTY_STAGE);
    setPpeDeclaration.mockRejectedValue(new WorkerSessionExpiredError());

    render(<PpePage />);
    (await screen.findByText(PPE_QUESTION)).click();

    expect(
      await screen.findByText("Your secure application session expired."),
    ).toBeTruthy();
  });
});
