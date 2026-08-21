/**
 * Module 4.2 Federal Tax - authorized staff review inside the Phase 2 workspace.
 *
 * What this suite is answerable for:
 *
 *  - The panel is a PANEL. It mounts inside the existing administrative workspace because the capsule
 *    registered it, and it has no route, no shell and no navigation entry of its own.
 *  - AUTHORIZATION IS BY THE SENSITIVE GRANT, AND ITS ABSENCE MEANS ABSENCE. Broad administrative
 *    visibility does not render it, `admin` does not render it, and recruiting does not render it -
 *    and none of them causes a request either, so an unauthorized operator never invites the refusal
 *    and is never told this worker has tax elections to look at.
 *  - THE SCREEN IS NOT THE BOUNDARY AND THIS SUITE DOES NOT PRETEND IT IS. Hiding the panel is a
 *    courtesy; the server's refusal is the guarantee, it is proven server-side, and the assertion
 *    here is only that a refusal is REPORTED as one rather than shown as an empty record.
 *  - WHAT AN AUTHORIZED READER SEES IS THE WORKER'S OWN RECORD IN FULL: what governs him now, why
 *    that election exists, what he said was wrong where he corrected one, and every superseded
 *    election under the revision it was made under.
 *  - EACH HISTORICAL ENTRY REPORTS ITS OWN FACTS. Nothing reads a value off the current election and
 *    applies it to an earlier one.
 *  - IT IS A READ. There is no input, no form and no control here that changes a worker's election,
 *    and no vocabulary of editing, repairing or signing on his behalf.
 *  - NO PROTECTED IDENTIFIER AND NO CALCULATED TAX REACHES IT, because neither is on the projection
 *    it consumes and neither is obtainable from this capsule.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  FederalTaxStaffElection,
  FederalTaxStaffReview,
} from "@/lib/workforce/federalTaxApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/onboarding",
}));

vi.mock("@/lib/workforce/federalTaxApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workforce/federalTaxApi")>();
  return { ...actual, getStaffFederalTax: vi.fn() };
});

const session = vi.fn();
vi.mock("@/lib/auth/useSession", () => ({ useSession: () => session() }));

const { getStaffFederalTax } = await import("@/lib/workforce/federalTaxApi");
const { OnboardingAdminApiError } = await import("@/lib/workforce/onboardingAdminApi");
const { OnboardingAdminReviewPanel } = await import(
  "@/components/workforce/admin/panels/ReviewPanel"
);
const { resolveOnboardingAdminPanel } = await import(
  "@/components/workforce/admin/adminPanelRegistry"
);
const { CANDIDATE_ID, fixtureModule, fixtureSession, fixtureWorker } = await import(
  "@/components/workforce/admin/adminTestFixtures"
);

/**
 * PRODUCTION REGISTRATION, imported for its side effect exactly as the administrative layout imports
 * it. This suite registers no panel of its own.
 */
await import("./register.admin");

const { default: FederalTaxReviewPanel } = await import("./FederalTaxReviewPanel");

const MODULE_KEY = "FEDERAL_TAX";
const FEDERAL_TAX_READ = "workforce.onboarding.federal-tax.read";
const ACCESS = "workforce.onboarding.admin.access";
const WORKER_READ = "workforce.onboarding.admin.worker.read";
const RECRUITING_READ = "workforce.application.read";

/** The full identifier, so a scan can prove it is nowhere near this panel. */
const FULL_IDENTIFIER = "123456789";

function election(
  overrides: Partial<FederalTaxStaffElection> = {},
): FederalTaxStaffElection {
  return {
    setVersion: 2,
    formKey: "IRS_FORM_W4",
    formRevision: "2026-08-19",
    electionOrigin: "CORRECTION",
    correctionReason: "I had the wrong filing status.",
    filingStatus: "HEAD_OF_HOUSEHOLD",
    multipleJobsElected: false,
    dependentsCreditAmount: "2000.00",
    otherIncomeAmount: null,
    deductionsAmount: null,
    additionalWithholdingAmount: "75.25",
    exemptionClaimed: false,
    executedAt: "2026-08-20T15:00:00.000Z",
    effectiveFrom: "2026-08-20T15:00:00.000Z",
    supersededAt: null,
    current: true,
    receipt: { receivedAt: "2026-08-20T15:00:00.000Z", basis: "ELECTRONIC_EXECUTION" },
    executionRecordId: "exec-2",
    artifactDocumentId: "doc-2",
    artifactSlotKey: "FEDERAL_WITHHOLDING_RECORD",
    ...overrides,
  };
}

/**
 * The worker's record as the authorized read projects it: one election in force, one superseded.
 *
 * THE SUPERSEDED ENTRY DELIBERATELY DIFFERS IN EVERY FACT THAT COULD BE MISREPORTED - its own
 * revision, its own origin, its own filing status, its own dates - so a panel that read a value off
 * the current election and applied it to the earlier one is caught rather than passed.
 */
function review(overrides: Partial<FederalTaxStaffReview> = {}): FederalTaxStaffReview {
  const current = election();
  return {
    moduleKey: MODULE_KEY,
    candidateId: CANDIDATE_ID,
    current,
    history: [
      current,
      election({
        setVersion: 1,
        formRevision: "2026-01-05",
        electionOrigin: "INITIAL_ELECTION",
        correctionReason: null,
        filingStatus: "SINGLE_OR_MARRIED_FILING_SEPARATELY",
        additionalWithholdingAmount: null,
        exemptionClaimed: true,
        executedAt: "2026-02-11T09:00:00.000Z",
        effectiveFrom: "2026-02-11T09:00:00.000Z",
        supersededAt: "2026-08-20T15:00:00.000Z",
        current: false,
        receipt: { receivedAt: "2026-02-11T09:00:00.000Z", basis: "ELECTRONIC_EXECUTION" },
        executionRecordId: "exec-1",
        artifactDocumentId: "doc-1",
      }),
    ],
    processing: { actionable: true, blocks: [] },
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <FederalTaxReviewPanel
      worker={fixtureWorker()}
      packet={null}
      module={null}
      history={null}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, FEDERAL_TAX_READ]));
  vi.mocked(getStaffFederalTax).mockResolvedValue(review());
});

afterEach(() => {
  cleanup();
});

/* ----------------------------------------------------------- authorization */

describe("authorization", () => {
  it("renders nothing and reads nothing without the sensitive grant", async () => {
    // THE TWO BROAD ADMINISTRATIVE GRANTS ARE NOT ENOUGH, which is the whole point of the permission
    // being sensitive: an operator who can open the workspace and read this worker cannot thereby
    // read what he elected for federal withholding.
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ]));

    const { container } = renderPanel();

    expect(container.textContent).toBe("");
    await waitFor(() => expect(vi.mocked(getStaffFederalTax)).not.toHaveBeenCalled());
  });

  it("renders nothing for recruiting, whatever else recruiting holds", async () => {
    session.mockReturnValue(fixtureSession([ACCESS, WORKER_READ, RECRUITING_READ]));

    const { container } = renderPanel();

    expect(container.textContent).toBe("");
    await waitFor(() => expect(vi.mocked(getStaffFederalTax)).not.toHaveBeenCalled());
  });

  it("treats no role as a bypass, including admin", async () => {
    // READ FROM EFFECTIVE GRANTS, DELIBERATELY. The server's assertion has no admin bypass for a
    // sensitive permission, and a panel that rendered for the role would offer a disclosure the
    // server refuses - which teaches an operator that Jarvis is broken rather than that he lacks a
    // grant.
    session.mockReturnValue({
      ...fixtureSession([ACCESS, WORKER_READ]),
      roles: ["admin"],
    });

    const { container } = renderPanel();

    expect(container.textContent).toBe("");
    await waitFor(() => expect(vi.mocked(getStaffFederalTax)).not.toHaveBeenCalled());
  });

  it("reads this worker's record once the grant is held", async () => {
    renderPanel();

    await waitFor(() =>
      expect(vi.mocked(getStaffFederalTax)).toHaveBeenCalledWith(CANDIDATE_ID),
    );
    expect(await screen.findByText("Head of household")).toBeTruthy();
  });

  it("reports a refusal as a refusal, with the code an operator has to quote", async () => {
    // THE SERVER IS THE BOUNDARY. A browser that believed it held the grant is refused anyway, and
    // what matters here is that the refusal is shown AS ONE rather than as an empty record - an
    // operator who sees "no elections" would tell the worker something untrue.
    vi.mocked(getStaffFederalTax).mockRejectedValue(
      new OnboardingAdminApiError({
        status: 403,
        code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
        message: "Missing permission",
      }),
    );

    renderPanel();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/ADMIN_FUNCTION_NOT_AUTHORIZED/)).toBeTruthy();
    expect(screen.queryByText("Head of household")).toBeNull();
  });

  it("offers the read again when the failure was not an answer about authorization", async () => {
    vi.mocked(getStaffFederalTax).mockRejectedValue(
      new OnboardingAdminApiError({ status: 503, message: "Service unavailable" }),
    );

    renderPanel();
    await screen.findByRole("alert");

    vi.mocked(getStaffFederalTax).mockResolvedValue(review());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Head of household")).toBeTruthy();
  });
});

/* ------------------------------------------------------------ what it shows */

describe("what an authorized reader sees", () => {
  it("shows what governs him now, under the revision it was executed under", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    const version = document.querySelector('[data-ft-staff-version="2"]');
    expect(version?.textContent).toContain("2026-08-19");
    expect(screen.getByText("$75.25")).toBeTruthy();
    expect(screen.getByText("$2000.00")).toBeTruthy();
  });

  it("says WHY the election exists, and what he said was wrong", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    // THE ORIGIN IS THE FACT, AND THE REASON IS HIS OWN WORDS. An operator reading a corrected
    // record needs to know a correction happened and what the worker said was wrong with the
    // earlier one; neither is inferrable from the amounts.
    expect(screen.getByText("A correction of the election before it")).toBeTruthy();
    expect(screen.getByText("I had the wrong filing status.")).toBeTruthy();
  });

  it("states an absent amount as no election rather than as a zero", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    // AN ELECTED ZERO AND NO ELECTION ARE DIFFERENT FACTS. Rendering a blank as "$0.00" would
    // report an election the worker never made.
    expect(screen.getAllByText("No election").length).toBeGreaterThan(0);
    expect(screen.queryByText("$0.00")).toBeNull();
  });

  it("keeps every superseded election on screen, each reporting its OWN facts", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    const history = document.querySelector("[data-ft-staff-history]");
    expect(history).toBeTruthy();
    const text = history?.textContent ?? "";
    // ITS OWN revision, ITS OWN origin, ITS OWN filing status - none of them the current
    // election's. Withholding the earlier versions from the only people authorized to read them
    // would be append-only in storage and destructive in effect.
    expect(text).toContain("Version 1");
    expect(text).toContain("2026-01-05");
    expect(text).toContain("His first election");
    expect(text).toContain("Single, or married filing separately");
    // And its own exemption claim, which the current election does not make.
    expect(text).toContain("Yes, he claimed it");
  });

  it("never describes an earlier election as a correction of something, or as a mistake", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    // The FIRST election followed nothing and corrected nothing. A panel that labelled a superseded
    // election by what replaced it would put a mistake on a record that never claimed one.
    const history = document.querySelector("[data-ft-staff-history]");
    expect(history?.textContent ?? "").not.toContain(
      "A correction of the election before it",
    );
  });

  it("reports the exemption as a claim and adjudicates nothing about it", async () => {
    vi.mocked(getStaffFederalTax).mockResolvedValue(
      review({ current: election({ exemptionClaimed: true }) }),
    );

    renderPanel();
    await screen.findByText("Head of household");

    // MW4H does not decide whether he qualifies (8-R5), and there is nowhere here to record an
    // opinion: no approve, no deny, no review control.
    const text = document.body.textContent ?? "";
    expect(text).toContain("Jarvis records the claim and decides nothing about it");
    for (const forbidden of [/approve/i, /deny/i, /reject/i, /qualif/i]) {
      expect(forbidden.test(text)).toBe(false);
    }
  });

  it("says plainly when a worker has elected nothing, and offers nothing to process", async () => {
    vi.mocked(getStaffFederalTax).mockResolvedValue(
      review({
        current: null,
        history: [],
        processing: { actionable: false, blocks: ["NO_OPERATIVE_ELECTION"] },
      }),
    );

    renderPanel();

    expect(
      await screen.findByText("This worker has made no federal withholding election."),
    ).toBeTruthy();
    // AND NO READINESS IS CLAIMED EITHER WAY, because there is no election for readiness to be
    // about - the empty statement replaces the whole body rather than sitting above a blank one.
    expect(document.querySelector("[data-ft-staff-actionable]")).toBeNull();
  });
});

/* ------------------------------------------- administrative readiness */

describe("administrative readiness", () => {
  it("reports the server's readiness rather than deriving one", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    expect(
      document.querySelector('[data-ft-staff-actionable="true"]'),
    ).not.toBeNull();
    // AND IT SAYS WHAT PROCESSING IS. It records that MW4H handled the election; it does not change
    // what he elected, and it is not what completed his module.
    expect(document.body.textContent ?? "").toContain(
      "does not change what he elected",
    );
  });

  it("states each block the server gave, in words rather than as a code", async () => {
    vi.mocked(getStaffFederalTax).mockResolvedValue(
      review({ processing: { actionable: false, blocks: ["CERTIFICATION_NOT_BOUND"] } }),
    );

    renderPanel();
    await screen.findByText("Head of household");

    expect(
      document.querySelector('[data-ft-staff-block="CERTIFICATION_NOT_BOUND"]'),
    ).not.toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(document.body.textContent ?? "").not.toContain("CERTIFICATION_NOT_BOUND");
  });

  it("takes the administrative act nowhere near this panel", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    // THE ACT IS THE WORKSPACE'S, and its outcome is DERIVED by the server from governed state
    // rather than chosen by a caller. This panel has no processing control and could not have one.
    expect(document.querySelectorAll("button")).toHaveLength(0);
    const text = document.body.textContent ?? "";
    for (const forbidden of [/^Process$/m, /Return for/i, /Mark as/i]) {
      expect(forbidden.test(text)).toBe(false);
    }
  });
});

/* --------------------------------------------------------------- read only */

describe("the panel is read only", () => {
  it("offers no control that could change what the worker elected", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    // A WITHHOLDING ELECTION IS THE EMPLOYEE'S. Nothing to type into, nothing to choose, nothing to
    // submit, and no form to carry any of it.
    expect(document.querySelectorAll("input")).toHaveLength(0);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll("form")).toHaveLength(0);
    expect(document.querySelectorAll("button")).toHaveLength(0);
  });

  it("names no act performed on a worker's election", async () => {
    const { container } = renderPanel();
    await screen.findByText("Head of household");

    const text = container.textContent ?? "";
    for (const forbidden of [
      /\bedit\b/i,
      /\bcorrect his\b/i,
      /\brepair\b/i,
      /\bsign for\b/i,
      /\bcomplete for\b/i,
      /\breplace\b/i,
      /\boverride\b/i,
      /\bon his behalf\b/i,
    ]) {
      expect(forbidden.test(text)).toBe(false);
    }
    // And it says whose the record is.
    expect(text).toContain("his elections are his own");
  });

  it("discloses no protected identifier and no calculated tax", async () => {
    renderPanel();
    await screen.findByText("Head of household");

    const rendered = document.body.innerHTML;
    // NONE OF IT IS ON THE PROJECTION THIS PANEL CONSUMES, so there is nothing here to leak and no
    // call in this capsule that could obtain one. No reveal control exists to ask for one either.
    expect(rendered).not.toContain(FULL_IDENTIFIER);
    expect(rendered).not.toMatch(/\d{3}-\d{2}-\d{4}/);
    for (const forbidden of [
      /social security/i,
      /\bssn\b/i,
      /reveal/i,
      /withheld/i,
      /tax due/i,
      /\brate\b/i,
    ]) {
      expect(forbidden.test(document.body.textContent ?? "")).toBe(false);
    }
  });
});

/* ------------------------------------------------------------ registration */

describe("how the panel reaches the workspace", () => {
  it("is registered under this module's key by its own capsule", () => {
    expect(resolveOnboardingAdminPanel(MODULE_KEY)).toBeDefined();
  });

  it("mounts inside the delivered review panel with no workspace change", async () => {
    render(
      <OnboardingAdminReviewPanel
        worker={fixtureWorker()}
        packet={null}
        module={fixtureModule({
          moduleKey: MODULE_KEY,
          moduleNumber: "4.2",
          title: "Federal Tax",
        })}
      />,
    );

    expect(await screen.findByText("Head of household")).toBeTruthy();
    // The workspace's placeholder for an unregistered module is gone, which is the whole proof that
    // registration is what put the panel there.
    expect(
      screen.queryByText(/No administrative panel has been registered/),
    ).toBeNull();
  });
});
