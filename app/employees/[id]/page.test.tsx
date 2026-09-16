import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmployeeDetailPage from "./page";

/**
 * THE STAFF SMS OPT-OUT CONTROL ON THE WORKER PROFILE.
 *
 * WHAT THESE TESTS GUARD, AND WHY IT IS NOT THE HAPPY PATH. A worker telephones and asks not to be
 * texted; a staff member clicks once. The ways that can go wrong are all about TRUTH on the screen
 * afterwards: showing "Yes" when the save failed, showing "No" as though it meant he had agreed to
 * texts, or firing twice because the first click was slow. Those are the assertions below.
 *
 * The status is never set optimistically - the row re-reads from the server - so proving the failure
 * case means proving the displayed value did NOT move.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cand_1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const api = await import("@/lib/api");
const apiFetch = vi.mocked(api.apiFetch);

/** The worker as the profile detail read returns him. */
function employee(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand_1",
    firstName: "Alex",
    lastName: "Rivera",
    displayName: "Alex Rivera",
    email: "alex@example.com",
    phone: "(512) 555-0142",
    status: "ACTIVE",
    address1: null,
    address2: null,
    city: null,
    state: null,
    zip: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelationship: null,
    smsOptedOut: false,
    middleName: null,
    suffix: null,
    dateOfBirth: null,
    militaryService: null,
    primaryTradeId: null,
    primaryTradeName: null,
    primaryTradeLabel: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    trades: [],
    specializations: [],
    capabilities: [],
    certifications: [],
    compliance: [],
    tools: [],
    ppe: [],
    applications: [],
    ...overrides,
  };
}

/**
 * Route every call the page makes. The employee detail is served from a mutable holder so a reload
 * after a save can legitimately return a different status, exactly as the server would.
 */
function serve(detail: { current: Record<string, unknown> }) {
  apiFetch.mockImplementation(async (path: string) => {
    if (path === "/employees/cand_1") return detail.current as never;
    return [] as never;
  });
}

const optOutCalls = () =>
  apiFetch.mock.calls.filter(([path]) => path === "/candidates/cand_1/sms-opt-out");

const statusRow = () => screen.getByText("SMS Opted Out").parentElement as HTMLElement;

async function loaded() {
  render(<EmployeeDetailPage />);
  await waitFor(() => expect(screen.getByText("SMS Opted Out")).toBeTruthy());
}

describe("Employee profile - SMS opt-out control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  describe("what it displays", () => {
    it('shows "No" for a worker who has not opted out', async () => {
      serve({ current: employee({ smsOptedOut: false }) });

      await loaded();

      expect(statusRow().textContent).toContain("No");
      expect(screen.getByRole("button", { name: "Mark opted out" })).toBeTruthy();
    });

    it('shows "Yes" for a worker who has opted out', async () => {
      serve({ current: employee({ smsOptedOut: true }) });

      await loaded();

      expect(statusRow().textContent).toContain("Yes");
      expect(screen.getByRole("button", { name: "Clear opt-out" })).toBeTruthy();
    });

    /*
      "No" MUST NEVER READ AS CONSENT. It means no opt-out is recorded. The profile therefore carries
      no consent wording at all beside it - the affirmative basis for texting a worker is separate
      Workforce Application evidence and is not this screen's claim to make.
    */
    it("never implies the worker has agreed to receive texts", async () => {
      serve({ current: employee({ smsOptedOut: false }) });

      await loaded();

      const body = document.body.textContent ?? "";
      for (const forbidden of ["consent", "Consent", "opted in", "Opted In", "agreed to receive"]) {
        expect(body).not.toContain(forbidden);
      }
    });
  });

  describe("changing the status", () => {
    it("marks a worker opted out and shows the new state", async () => {
      const detail = { current: employee({ smsOptedOut: false }) };
      serve(detail);
      await loaded();

      // The server accepts the change, so the next detail read returns the new status.
      apiFetch.mockImplementation(async (path: string, init?: any) => {
        if (path === "/candidates/cand_1/sms-opt-out") {
          detail.current = employee({ smsOptedOut: JSON.parse(init.body).optedOut });
          return { ok: true } as never;
        }
        if (path === "/employees/cand_1") return detail.current as never;
        return [] as never;
      });

      fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Clear opt-out" })).toBeTruthy(),
      );
      expect(statusRow().textContent).toContain("Yes");
      expect(optOutCalls()).toHaveLength(1);
      expect(JSON.parse((optOutCalls()[0][1] as any).body)).toEqual({ optedOut: true });
      expect((optOutCalls()[0][1] as any).method).toBe("PATCH");
    });

    it("clears an opt-out and shows the new state", async () => {
      const detail = { current: employee({ smsOptedOut: true }) };
      serve(detail);
      await loaded();

      apiFetch.mockImplementation(async (path: string, init?: any) => {
        if (path === "/candidates/cand_1/sms-opt-out") {
          detail.current = employee({ smsOptedOut: JSON.parse(init.body).optedOut });
          return { ok: true } as never;
        }
        if (path === "/employees/cand_1") return detail.current as never;
        return [] as never;
      });

      fireEvent.click(screen.getByRole("button", { name: "Clear opt-out" }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Mark opted out" })).toBeTruthy(),
      );
      expect(statusRow().textContent).toContain("No");
      expect(JSON.parse((optOutCalls()[0][1] as any).body)).toEqual({ optedOut: false });
    });

    it("sends nothing else with the change", async () => {
      const detail = { current: employee({ smsOptedOut: false }) };
      serve(detail);
      await loaded();

      fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));

      await waitFor(() => expect(optOutCalls()).toHaveLength(1));
      expect(Object.keys(JSON.parse((optOutCalls()[0][1] as any).body))).toEqual(["optedOut"]);
    });
  });

  describe("when the save fails", () => {
    /*
      THE DISPLAYED STATUS MUST NOT MOVE. A worker's stated preference is the wrong thing to guess
      about: if the write failed, the screen has to keep saying what the database still says, and say
      that something went wrong.
    */
    it("keeps the old status and reports the failure", async () => {
      serve({ current: employee({ smsOptedOut: false }) });
      await loaded();

      apiFetch.mockImplementation(async (path: string) => {
        if (path === "/candidates/cand_1/sms-opt-out") {
          throw new Error("Forbidden");
        }
        if (path === "/employees/cand_1") return employee({ smsOptedOut: false }) as never;
        return [] as never;
      });

      fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));

      await waitFor(() => expect(screen.getByText("Forbidden")).toBeTruthy());
      expect(statusRow().textContent).toContain("No");
      // Still offering the same action, because nothing changed.
      expect(screen.getByRole("button", { name: "Mark opted out" })).toBeTruthy();
    });

    it("lets the staff member try again after a failure", async () => {
      serve({ current: employee({ smsOptedOut: false }) });
      await loaded();

      apiFetch.mockImplementation(async (path: string) => {
        if (path === "/candidates/cand_1/sms-opt-out") throw new Error("Network down");
        if (path === "/employees/cand_1") return employee({ smsOptedOut: false }) as never;
        return [] as never;
      });

      fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));
      await waitFor(() => expect(screen.getByText("Network down")).toBeTruthy());

      fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));

      await waitFor(() => expect(optOutCalls()).toHaveLength(2));
    });
  });

  describe("double submission", () => {
    /*
      ONE CLICK IS ONE CHANGE. A second click landing while the first is in flight would send a second
      request - and with a toggle, the second request would ask for the OPPOSITE state, so the worker's
      preference would end up wherever the race finished.
    */
    it("sends exactly one request when clicked repeatedly", async () => {
      const detail = { current: employee({ smsOptedOut: false }) };
      // A holder rather than a bare variable: TypeScript cannot see an assignment made inside the
      // mock's callback, so it would narrow a plain `let` to `null` at the release call below.
      const gate: { release: (() => void) | null } = { release: null };
      apiFetch.mockImplementation(async (path: string, init?: any) => {
        if (path === "/candidates/cand_1/sms-opt-out") {
          await new Promise<void>((resolve) => {
            gate.release = resolve;
          });
          detail.current = employee({ smsOptedOut: JSON.parse(init.body).optedOut });
          return { ok: true } as never;
        }
        if (path === "/employees/cand_1") return detail.current as never;
        return [] as never;
      });
      render(<EmployeeDetailPage />);
      await waitFor(() => expect(screen.getByText("SMS Opted Out")).toBeTruthy());

      const button = screen.getByRole("button", { name: "Mark opted out" });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy());
      expect(optOutCalls()).toHaveLength(1);

      gate.release?.();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Clear opt-out" })).toBeTruthy(),
      );
      expect(optOutCalls()).toHaveLength(1);
    });

    it("disables the control while the change is in flight", async () => {
      const detail = { current: employee({ smsOptedOut: false }) };
      // A holder rather than a bare variable: TypeScript cannot see an assignment made inside the
      // mock's callback, so it would narrow a plain `let` to `null` at the release call below.
      const gate: { release: (() => void) | null } = { release: null };
      apiFetch.mockImplementation(async (path: string) => {
        if (path === "/candidates/cand_1/sms-opt-out") {
          await new Promise<void>((resolve) => {
            gate.release = resolve;
          });
          return { ok: true } as never;
        }
        if (path === "/employees/cand_1") return detail.current as never;
        return [] as never;
      });
      render(<EmployeeDetailPage />);
      await waitFor(() => expect(screen.getByText("SMS Opted Out")).toBeTruthy());

      fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));

      await waitFor(() => {
        const saving = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
        expect(saving.disabled).toBe(true);
      });

      gate.release?.();
    });
  });
});
