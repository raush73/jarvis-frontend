/**
 * Phase 5 - the worker execution surface.
 *
 * Proves the properties the phase exists for rather than the pixels: the act a subject
 * requires is the act offered, governed wording comes from the server, the exact content
 * identity that was displayed is the one submitted, a genuine opportunity to read is enforced
 * where governance requires it, and nothing a worker draws leaves the page except as the one
 * payload the backend asked for.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { saveWorkerSession } from "./../../../../lib/workforce/workerSession";
import OnboardingExecutionCapture from "./OnboardingExecutionCapture";
import { OnboardingRuntimeProvider } from "../runtime/OnboardingRuntimeContext";
import OnboardingPacketView from "../runtime/OnboardingPacketView";
import {
  INVOCATION_ID,
  RESTART_CLOSED,
  fixturePacket,
  fixtureRuntime,
} from "../runtime/runtimeTestFixtures";
import { getOnboardingRuntime } from "@/lib/workforce/onboardingRuntimeApi";
import { getOnboardingDocumentSlots } from "@/lib/workforce/onboardingDocumentApi";
import type {
  OnboardingExecution,
  OnboardingExecutionForm,
  OnboardingExecutionSubject,
} from "@/lib/workforce/onboardingExecutionApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

// Mounted for the integration checks at the foot of this file: the packet view is the real
// one, so what is proven there is where the execution section actually lives.
vi.mock("@/lib/workforce/onboardingRuntimeApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingRuntimeApi")>();
  return { ...actual, getOnboardingRuntime: vi.fn(), getOnboardingPacket: vi.fn() };
});

vi.mock("@/lib/workforce/onboardingDocumentApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/onboardingDocumentApi")>();
  return { ...actual, getOnboardingDocumentSlots: vi.fn() };
});

/*
  jsdom implements no PointerEvent, and without one the testing library silently degrades a
  pointer event to a bare Event that carries no coordinate and no pointer identity - which
  would let every assertion below pass while proving nothing about what was drawn. This is the
  browser's own shape: a pointer event IS a mouse event with a pointer identity attached.
*/
if (typeof window.PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: TestPointerEvent,
  });
}

/*
  jsdom implements no canvas context either. A stub is installed rather than letting the
  component skip painting, so the drawing path runs exactly as it does in a browser and a
  defect in it surfaces here rather than only on a worker's screen.
*/
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  writable: true,
  value: () => ({
    setTransform: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    strokeStyle: "",
  }),
});

const INVOCATION = "invocation-1";

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function subjectFixture(
  overrides: Partial<OnboardingExecutionSubject> = {},
): OnboardingExecutionSubject {
  return {
    moduleKey: "FIXTURE_SIMPLE",
    subjectKey: "FIXTURE_READ",
    title: "Fixture notice",
    requiredForm: "READ_ACKNOWLEDGEMENT",
    content: {
      kind: "GOVERNED_TEXT",
      ref: "FIXTURE_NOTICE",
      revision: "2026.1",
      ruleRevision: "2026.1",
      title: "Fixture notice",
      contentHash: HASH_A,
      lines: [
        { label: "The first governed line of the fixture notice.", field: null },
        { label: "The second governed line of the fixture notice.", field: null },
      ],
    },
    current: null,
    history: [],
    requiresExecution: true,
    ...overrides,
  };
}

function executionFixture(
  overrides: Partial<OnboardingExecution> = {},
): OnboardingExecution {
  return {
    executionId: "exec-1",
    moduleKey: "FIXTURE_SIMPLE",
    subjectKey: "FIXTURE_READ",
    executionForm: "READ_ACKNOWLEDGEMENT",
    executedContent: {
      kind: "GOVERNED_TEXT",
      ref: "FIXTURE_NOTICE",
      revision: "2026.1",
      ruleRevision: "2026.1",
      contentHash: HASH_A,
    },
    evidenceKind: "ATTESTATION",
    evidence: null,
    executedAt: "2026-08-08T13:00:00.000Z",
    supersededAt: null,
    supersedesId: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Transport doubles                                                          */
/* -------------------------------------------------------------------------- */

type Reply = { status: number; body: unknown };

function envelope(value: unknown): Reply {
  return { status: 200, body: { ok: true, value } };
}

function refusal(code: string, status = 400): Reply {
  return { status, body: { statusCode: status, code, message: `refused: ${code}` } };
}

/** Routes by method and path so a submission and a reload are answered independently. */
function server(config: {
  subjects: () => Reply;
  submit?: () => Reply;
}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : null;
    calls.push({ method, url, body });
    const reply =
      method === "POST"
        ? (config.submit ?? (() => envelope(executionFixture())))()
        : config.subjects();
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      headers: new Headers(),
      json: async () => reply.body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function submissions(calls: { method: string; body: unknown }[]) {
  return calls.filter((call) => call.method === "POST").map((call) => call.body);
}

/* -------------------------------------------------------------------------- */
/*  Scroll geometry                                                            */
/* -------------------------------------------------------------------------- */

/**
 * jsdom lays nothing out, so the geometry the read gate measures has to be supplied. These
 * helpers describe a region as the browser would report it.
 */
function setGeometry(
  element: HTMLElement,
  geometry: { scrollTop: number; clientHeight: number; scrollHeight: number },
) {
  // `scrollTop` is writable in a browser and the hook writes it when content is replaced, so
  // it is defined here with a real setter rather than as a frozen reading.
  let scrollTop = geometry.scrollTop;
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  for (const key of ["clientHeight", "scrollHeight"] as const) {
    Object.defineProperty(element, key, {
      configurable: true,
      get: () => geometry[key],
    });
  }
}

function contentRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>(".ob-exec-content");
  if (!region) throw new Error("no governed content region rendered");
  return region;
}

/** Give the region overflowing geometry and let the gate observe it. */
async function makeOverflowing(scrollTop = 0) {
  const region = contentRegion();
  setGeometry(region, { scrollTop, clientHeight: 300, scrollHeight: 900 });
  await act(async () => {
    fireEvent.scroll(region);
  });
  return region;
}

async function scrollTo(region: HTMLElement, scrollTop: number) {
  setGeometry(region, { scrollTop, clientHeight: 300, scrollHeight: 900 });
  await act(async () => {
    fireEvent.scroll(region);
  });
}

function submitButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>("[data-execution-submit]");
  if (!button) throw new Error("no execution submit control rendered");
  return button;
}

async function renderSection(props: { changeable?: boolean } = {}) {
  render(<OnboardingExecutionCapture invocationId={INVOCATION} {...props} />);
  await screen.findByRole("heading", { level: 2 });
  // The subjects arrive asynchronously, so their mount effects are still pending here. Left
  // unflushed they would interleave with the interactions below and make this suite lie.
  await act(async () => {});
}

beforeEach(() => {
  localStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: "candidate-1",
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */

describe("the section", () => {
  it("renders nothing at all when the server declares no subjects", async () => {
    server({ subjects: () => envelope([]) });

    const { container } = render(
      <OnboardingExecutionCapture invocationId={INVOCATION} />,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector(".ob-exec-section")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders nothing before the server has spoken", () => {
    server({ subjects: () => envelope([subjectFixture()]) });

    const { container } = render(
      <OnboardingExecutionCapture invocationId={INVOCATION} />,
    );

    expect(container.textContent).toBe("");
  });

  it("renders the governed wording the server supplied, and authors none of its own", async () => {
    server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection();

    expect(
      screen.getByText("The first governed line of the fixture notice."),
    ).toBeTruthy();
    expect(
      screen.getByText("The second governed line of the fixture notice."),
    ).toBeTruthy();
    expect(screen.getByText("Version 2026.1")).toBeTruthy();
  });

  it("surfaces a load failure through the runtime's shared error surface", async () => {
    server({ subjects: () => refusal("INVOCATION_NOT_OWNED_BY_WORKER", 403) });

    render(<OnboardingExecutionCapture invocationId={INVOCATION} />);

    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("shows a completed subject without offering a control", async () => {
    server({
      subjects: () =>
        envelope([
          subjectFixture({ current: executionFixture(), requiresExecution: false }),
        ]),
    });
    await renderSection();

    expect(document.querySelector("[data-execution-complete]")).not.toBeNull();
    expect(document.querySelector("[data-execution-submit]")).toBeNull();
  });

  it("offers nothing to write with on a packet that has left the worker's hands", async () => {
    server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection({ changeable: false });

    expect(document.querySelector("[data-execution-submit]")).toBeNull();
    expect(document.querySelector("[data-execution-readonly]")).not.toBeNull();
  });
});

describe("the required form", () => {
  const forms: OnboardingExecutionForm[] = [
    "READ_ACKNOWLEDGEMENT",
    "CHECKBOX_ACKNOWLEDGEMENT",
    "INITIALS",
    "ELECTRONIC_SIGNATURE",
  ];

  for (const form of forms) {
    it(`renders the subject's own ${form} and offers no way to change it`, async () => {
      server({ subjects: () => envelope([subjectFixture({ requiredForm: form })]) });
      await renderSection();

      expect(
        document.querySelector(`[data-required-form="${form}"]`),
      ).not.toBeNull();
      // No selector, no radio group, no alternate act anywhere on the surface.
      expect(document.querySelectorAll("select")).toHaveLength(0);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });
  }

  it("fails closed on a form outside the governed vocabulary", async () => {
    server({
      subjects: () =>
        envelope([
          subjectFixture({
            requiredForm: "TYPED_NAME" as unknown as OnboardingExecutionForm,
          }),
        ]),
    });
    await renderSection();

    expect(document.querySelector('[data-execution-form="UNKNOWN"]')).not.toBeNull();
    expect(document.querySelector("[data-execution-submit]")).toBeNull();
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it("offers no typed-name input anywhere", async () => {
    server({
      subjects: () =>
        envelope([
          subjectFixture({ requiredForm: "ELECTRONIC_SIGNATURE" }),
          subjectFixture({ subjectKey: "FIXTURE_INITIAL", requiredForm: "INITIALS" }),
        ]),
    });
    await renderSection();

    expect(document.querySelectorAll('input[type="text"]')).toHaveLength(0);
  });
});

describe("owner ruling 5E-1 - a genuine opportunity to read", () => {
  async function readSubject() {
    server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection();
  }

  it("withholds the control while the governed content overflows unread", async () => {
    await readSubject();
    await makeOverflowing();

    expect(submitButton().disabled).toBe(true);
    expect(document.querySelector('[data-read-gate="BLOCKED"]')).not.toBeNull();
  });

  it("still withholds it part way down", async () => {
    await readSubject();
    const region = await makeOverflowing();

    await scrollTo(region, 300);

    expect(submitButton().disabled).toBe(true);
  });

  it("releases it once the end is reached", async () => {
    await readSubject();
    const region = await makeOverflowing();

    await scrollTo(region, 600);

    expect(submitButton().disabled).toBe(false);
    expect(document.querySelector('[data-read-gate="BLOCKED"]')).toBeNull();
  });

  it("counts a fractional pixel short of the bottom as the bottom", async () => {
    await readSubject();
    const region = await makeOverflowing();

    // Browser zoom and fractional device pixel ratios routinely land here.
    await scrollTo(region, 598.5);

    expect(submitButton().disabled).toBe(false);
  });

  it("manufactures no scrolling requirement for content that already fits", async () => {
    await readSubject();
    const region = contentRegion();
    setGeometry(region, { scrollTop: 0, clientHeight: 400, scrollHeight: 400 });
    await act(async () => {
      fireEvent.scroll(region);
    });

    expect(submitButton().disabled).toBe(false);
    expect(document.querySelector('[data-read-gate="BLOCKED"]')).toBeNull();
  });

  it("re-measures when the region resizes from fitting into overflowing", async () => {
    await readSubject();
    const region = contentRegion();
    setGeometry(region, { scrollTop: 0, clientHeight: 900, scrollHeight: 900 });
    await act(async () => {
      fireEvent.scroll(region);
    });
    expect(submitButton().disabled).toBe(false);

    // A rotation to a shorter viewport. The gate is not re-imposed once satisfied.
    setGeometry(region, { scrollTop: 0, clientHeight: 200, scrollHeight: 900 });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(submitButton().disabled).toBe(false);
  });

  it("does not punish a worker who has already reached the end", async () => {
    await readSubject();
    const region = await makeOverflowing();
    await scrollTo(region, 600);
    expect(submitButton().disabled).toBe(false);

    // Rotating back to the top of a taller document must not re-lock the control.
    await scrollTo(region, 0);

    expect(submitButton().disabled).toBe(false);
  });

  it("resets for replacement wording, so the new version must also be read", async () => {
    let revision = "2026.1";
    let hash = HASH_A;
    server({
      subjects: () =>
        envelope([
          subjectFixture({
            content: { ...subjectFixture().content, revision, contentHash: hash },
          }),
        ]),
      submit: () => refusal("EXECUTION_CONTENT_STALE"),
    });
    await renderSection();

    const region = await makeOverflowing();
    await scrollTo(region, 600);
    expect(submitButton().disabled).toBe(false);

    // The act is refused as stale and the section reloads to the amended wording.
    revision = "2026.2";
    hash = HASH_B;
    await act(async () => {
      fireEvent.click(submitButton());
    });

    await screen.findByText("Version 2026.2");
    await makeOverflowing();
    expect(submitButton().disabled).toBe(true);
  });

  it("is satisfied by scroll position rather than by a scroll event", async () => {
    await readSubject();
    const region = contentRegion();

    // A screen reader or a restored scroll position moves the viewport without the worker
    // dragging anything. Re-measuring on resize reaches the same answer.
    setGeometry(region, { scrollTop: 600, clientHeight: 300, scrollHeight: 900 });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(submitButton().disabled).toBe(false);
  });

  it("is never satisfied by the passage of time alone", async () => {
    await readSubject();
    await makeOverflowing();
    expect(submitButton().disabled).toBe(true);

    // Installed only now: the render above needs real timers to resolve its own promises.
    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(submitButton().disabled).toBe(true);
  });

  it("explains itself to a screen reader rather than only to the eye", async () => {
    await readSubject();
    await makeOverflowing();

    const described = submitButton().getAttribute("aria-describedby");
    expect(described).toBeTruthy();
    expect(document.getElementById(described as string)?.textContent).toContain(
      "Read to the end",
    );
  });

  it("leaves the governed region reachable by keyboard alone", async () => {
    await readSubject();

    expect(contentRegion().getAttribute("tabindex")).toBe("0");
  });

  it("does not gate the checkbox acknowledgement", async () => {
    server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "CHECKBOX_ACKNOWLEDGEMENT" })]),
    });
    await renderSection();
    await makeOverflowing();

    // Blocked only by the tick it exists to require, never by a read gate.
    expect(document.querySelector('[data-read-gate="BLOCKED"]')).toBeNull();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(submitButton().disabled).toBe(true);

    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(submitButton().disabled).toBe(false);
  });

  it("submits no field describing the gate", async () => {
    const { calls } = server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);

    await act(async () => {
      fireEvent.click(submitButton());
    });

    const body = submissions(calls)[0] as Record<string, unknown>;
    for (const forbidden of ["read", "hasRead", "readGate", "scrolled", "dwell"]) {
      expect({ forbidden, present: forbidden in body }).toEqual({
        forbidden,
        present: false,
      });
    }
  });

  it("contains no timer of any kind in its implementation", () => {
    const source = readFileSync(
      join(process.cwd(), "components/workforce/onboarding/execution/useReadGate.ts"),
      "utf8",
    );

    for (const forbidden of ["setTimeout", "setInterval", "Date.now", "performance.now"]) {
      expect({ forbidden, present: source.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    }
  });
});

describe("acknowledgement acts", () => {
  it("never pre-checks or defaults the checkbox", async () => {
    server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "CHECKBOX_ACKNOWLEDGEMENT" })]),
    });
    await renderSection();

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("submits the act the subject requires, not the act the worker performed", async () => {
    const { calls } = server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "CHECKBOX_ACKNOWLEDGEMENT" })]),
    });
    await renderSection();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(submissions(calls)[0]).toMatchObject({
      performedForm: "CHECKBOX_ACKNOWLEDGEMENT",
      acknowledged: true,
    });
  });

  it("carries the exact content identity that was displayed", async () => {
    const { calls } = server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);

    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect((submissions(calls)[0] as Record<string, unknown>).presented).toEqual({
      revision: "2026.1",
      contentHash: HASH_A,
      ruleRevision: "2026.1",
    });
  });

  it("re-reads authoritative state after a successful act rather than assuming it", async () => {
    let executed = false;
    const { calls } = server({
      subjects: () =>
        envelope([
          executed
            ? subjectFixture({ current: executionFixture(), requiresExecution: false })
            : subjectFixture(),
        ]),
      submit: () => {
        executed = true;
        return envelope(executionFixture());
      },
    });
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() =>
      expect(document.querySelector("[data-execution-complete]")).not.toBeNull(),
    );
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });

  it("records one act however many times the control is pressed", async () => {
    const { calls } = server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);

    const button = submitButton();
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(submissions(calls)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Native capture                                                             */
/* -------------------------------------------------------------------------- */

const PAD_RECT = {
  left: 20,
  top: 40,
  width: 400,
  height: 160,
  right: 420,
  bottom: 200,
  x: 20,
  y: 40,
  toJSON: () => ({}),
} as DOMRect;

function pad(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>("[data-capture-pad]");
  if (!element) throw new Error("no capture surface rendered");
  element.getBoundingClientRect = () => PAD_RECT;
  return element;
}

/** Draw one continuous mark. Coordinates are page coordinates, as a pointer reports them. */
async function draw(
  points: { x: number; y: number }[],
  options: { pointerType?: string; release?: boolean } = {},
) {
  const surface = pad();
  const pointerType = options.pointerType ?? "mouse";
  await act(async () => {
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      pointerType,
      clientX: PAD_RECT.left + points[0].x,
      clientY: PAD_RECT.top + points[0].y,
    });
    for (const point of points.slice(1)) {
      fireEvent.pointerMove(surface, {
        pointerId: 1,
        pointerType,
        clientX: PAD_RECT.left + point.x,
        clientY: PAD_RECT.top + point.y,
      });
    }
    if (options.release !== false) {
      fireEvent.pointerUp(surface, { pointerId: 1, pointerType });
    }
  });
  // Guards the helper itself: a draw that silently records nothing would let every assertion
  // below pass while proving nothing.
  if (surface.dataset.hasMark !== "true") {
    throw new Error(`the draw registered no mark: ${surface.outerHTML}`);
  }
}

function line(count: number, spacing = 4) {
  return Array.from({ length: count }, (_, index) => ({
    x: 10 + index * spacing,
    y: 20,
  }));
}

async function renderNative(
  form: "INITIALS" | "ELECTRONIC_SIGNATURE" = "ELECTRONIC_SIGNATURE",
  config: Parameters<typeof server>[0] = {
    subjects: () => envelope([subjectFixture({ requiredForm: form })]),
  },
) {
  const harness = server(config);
  await renderSection();
  return harness;
}

function capturePayload(calls: { method: string; body: unknown }[]) {
  const body = submissions(calls)[0] as Record<string, unknown>;
  if (!body) throw new Error("no act was submitted");
  return body.capture as {
    strokes: { points: { x: number; y: number }[] }[];
    capturedDurationMs: number;
  };
}

describe("owner ruling 5E-2 - native capture", () => {
  it("offers a drawing surface for both drawn forms, and no text input", async () => {
    for (const form of ["INITIALS", "ELECTRONIC_SIGNATURE"] as const) {
      const { fetchMock } = server({
        subjects: () => envelope([subjectFixture({ requiredForm: form })]),
      });
      await renderSection();

      expect(document.querySelector(`[data-capture-pad="${form}"]`)).not.toBeNull();
      expect(document.querySelectorAll("input")).toHaveLength(0);
      expect(document.querySelectorAll("textarea")).toHaveLength(0);

      cleanup();
      fetchMock.mockClear();
      vi.unstubAllGlobals();
    }
  });

  it("records a mark from a pointer", async () => {
    await renderNative();

    expect(pad().dataset.hasMark).toBe("false");
    await draw(line(6));

    expect(pad().dataset.hasMark).toBe("true");
  });

  for (const pointerType of ["mouse", "touch", "pen"]) {
    it(`treats a ${pointerType} the same as any other pointer`, async () => {
      const { calls } = await renderNative();

      await draw(line(6), { pointerType });
      await act(async () => {
        fireEvent.click(submitButton());
      });

      expect(capturePayload(calls).strokes).toHaveLength(1);
    });
  }

  it("keeps each continuous mark as its own stroke", async () => {
    const { calls } = await renderNative();

    await draw(line(5));
    await draw(line(5).map((point) => ({ ...point, y: 60 })));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(capturePayload(calls).strokes).toHaveLength(2);
  });

  it("records coordinates relative to the surface, not to the page", async () => {
    const { calls } = await renderNative();

    await draw([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
    ]);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(capturePayload(calls).strokes[0].points[0]).toEqual({ x: 10, y: 20 });
  });

  it("submits nothing from an untouched surface", async () => {
    const { calls } = await renderNative();

    expect(submitButton().disabled).toBe(true);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(submissions(calls)).toHaveLength(0);
  });

  it("empties the buffer when the drawing is cleared", async () => {
    const { calls } = await renderNative();
    await draw(line(6));

    const clear = document.querySelector<HTMLButtonElement>("[data-capture-clear]");
    await act(async () => {
      fireEvent.click(clear as HTMLButtonElement);
    });

    expect(pad().dataset.hasMark).toBe("false");
    expect(submitButton().disabled).toBe(true);
    await act(async () => {
      fireEvent.click(submitButton());
    });
    expect(submissions(calls)).toHaveLength(0);
  });

  it("drops points too close together to change the shape", async () => {
    const { calls } = await renderNative();

    // 400 reports along one short movement, as high-frequency hardware produces.
    await draw(
      Array.from({ length: 400 }, (_, index) => ({ x: 10 + index * 0.1, y: 20 })),
    );
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const points = capturePayload(calls).strokes[0].points;
    expect(points.length).toBeLessThan(60);
    expect(points.length).toBeGreaterThan(1);
  });

  it("stops collecting at the delivered ceiling rather than sending an invalid payload", async () => {
    const { calls } = await renderNative();

    // Far more distinct points than the contract admits in total.
    await draw(line(5_000, 3));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const capture = capturePayload(calls);
    const total = capture.strokes.reduce(
      (sum, stroke) => sum + stroke.points.length,
      0,
    );
    expect(total).toBeLessThanOrEqual(4_000);
    expect(capture.strokes.every((stroke) => stroke.points.length <= 2_000)).toBe(true);
    expect(capture.strokes.length).toBeLessThanOrEqual(256);
  });

  it("reports a positive duration within the delivered ceiling", async () => {
    const { calls } = await renderNative();

    await draw(line(6));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const { capturedDurationMs } = capturePayload(calls);
    expect(capturedDurationMs).toBeGreaterThan(0);
    expect(capturedDurationMs).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it("sends no acknowledgement flag with a drawn act", async () => {
    const { calls } = await renderNative();

    await draw(line(6));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const body = submissions(calls)[0] as Record<string, unknown>;
    // The backend refuses a capture carrying the flag at all, not merely one carrying false.
    expect("acknowledged" in body).toBe(false);
    expect(body.performedForm).toBe("ELECTRONIC_SIGNATURE");
  });

  it("locks the surface and both controls while the act is in flight", async () => {
    let release: (() => void) | null = null;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") await held;
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        json: async () => ({
          ok: true,
          value: (init?.method ?? "GET") === "POST" ? executionFixture() : [
            subjectFixture({ requiredForm: "ELECTRONIC_SIGNATURE" }),
          ],
        }),
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderSection();

    await draw(line(6));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(submitButton().disabled).toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>("[data-capture-clear]")?.disabled,
    ).toBe(true);
    expect(pad().dataset.disabled).toBe("true");

    // Drawing during the flight adds nothing.
    await draw(line(4).map((point) => ({ ...point, y: 90 })));

    await act(async () => {
      (release as unknown as () => void)();
      await held;
    });
  });

  it("discards the evidence once the act is recorded", async () => {
    let executed = false;
    const { calls } = server({
      subjects: () =>
        envelope([
          executed
            ? subjectFixture({
                requiredForm: "ELECTRONIC_SIGNATURE",
                current: executionFixture({ executionForm: "ELECTRONIC_SIGNATURE" }),
                requiresExecution: false,
              })
            : subjectFixture({ requiredForm: "ELECTRONIC_SIGNATURE" }),
        ]),
      submit: () => {
        executed = true;
        return envelope(executionFixture());
      },
    });
    await renderSection();

    await draw(line(6));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() =>
      expect(document.querySelector("[data-execution-complete]")).not.toBeNull(),
    );
    // The surface is gone with the act it belonged to, and one act was recorded.
    expect(document.querySelector("[data-capture-pad]")).toBeNull();
    expect(submissions(calls)).toHaveLength(1);
  });

  it("keeps the drawing after a failure worth retrying", async () => {
    let attempt = 0;
    const { calls } = server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "ELECTRONIC_SIGNATURE" })]),
      submit: () => {
        attempt += 1;
        return attempt === 1
          ? refusal("EXECUTION_EVIDENCE_PROTECTION_UNAVAILABLE", 503)
          : envelope(executionFixture());
      },
    });
    await renderSection();

    await draw(line(6));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() =>
      expect(
        document.querySelector('[data-execution-refusal="RETRYABLE"]'),
      ).not.toBeNull(),
    );
    expect(pad().dataset.hasMark).toBe("true");

    await act(async () => {
      fireEvent.click(submitButton());
    });
    expect(submissions(calls)).toHaveLength(2);
  });

  it("discards a drawing rather than rescaling it when the surface resizes", async () => {
    await renderNative();
    await draw(line(6));
    expect(pad().dataset.hasMark).toBe("true");

    const surface = pad();
    // Establish the pre-resize size, then report a different one.
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    surface.getBoundingClientRect = () =>
      ({ ...PAD_RECT, width: 240, height: 120 }) as DOMRect;
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(surface.dataset.hasMark).toBe("false");
    expect(document.querySelector("[data-capture-notice]")).not.toBeNull();
  });

  it("discards a drawing when the governed wording is replaced", async () => {
    let revision = "2026.1";
    let hash = HASH_A;
    server({
      subjects: () =>
        envelope([
          subjectFixture({
            requiredForm: "ELECTRONIC_SIGNATURE",
            content: {
              ...subjectFixture().content,
              revision,
              contentHash: hash,
            },
          }),
        ]),
      submit: () => refusal("EXECUTION_CONTENT_STALE"),
    });
    await renderSection();

    await draw(line(6));
    revision = "2026.2";
    hash = HASH_B;
    await act(async () => {
      fireEvent.click(submitButton());
    });

    await screen.findByText("Version 2026.2");
    expect(pad().dataset.hasMark).toBe("false");
  });

  it("tells the worker plainly how to get help, and builds no help system", async () => {
    await renderNative("INITIALS");

    const notice = document.querySelector("[data-assistance-notice]");
    expect(notice?.textContent).toContain("must be drawn here on this device");
    expect(notice?.textContent).toContain("contact the person who sent you");
    // Static copy. No request, no link, no ticket, no alternate act.
    expect(notice?.querySelector("a")).toBeNull();
    expect(notice?.querySelector("button")).toBeNull();
    expect(pad().getAttribute("aria-describedby")).toBe(notice?.id);
  });
});

describe("what a drawing never touches", () => {
  it("puts no coordinate in the DOM, in storage, or in a log", async () => {
    const logs: unknown[] = [];
    for (const channel of ["log", "warn", "error", "info", "debug"] as const) {
      vi.spyOn(console, channel).mockImplementation((...args: unknown[]) => {
        logs.push(...args);
      });
    }
    await renderNative();

    // Fractional, so no part of one can coincide with a timestamp or an identifier.
    await draw([
      { x: 137.75, y: 241.5 },
      { x: 353.25, y: 149.75 },
      { x: 271.5, y: 383.25 },
    ]);

    const haystack = [
      document.body.innerHTML,
      JSON.stringify(localStorage),
      JSON.stringify(sessionStorage),
      JSON.stringify(logs),
      window.location.href,
    ].join("|");

    for (const coordinate of [
      "137.75",
      "241.5",
      "353.25",
      "149.75",
      "271.5",
      "383.25",
    ]) {
      expect({ coordinate, leaked: haystack.includes(coordinate) }).toEqual({
        coordinate,
        leaked: false,
      });
    }
    vi.restoreAllMocks();
  });

  it("never turns a capture into an image", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/workforce/onboarding/execution/ExecutionCaptureSurface.tsx",
      ),
      "utf8",
    );

    for (const forbidden of [
      "toDataURL",
      "toBlob",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "console.",
      "dataset.",
    ]) {
      expect({ forbidden, present: source.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    }
  });

  it("sends the drawing to exactly one place", async () => {
    const { calls } = await renderNative();

    await draw(line(6));
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const withCapture = calls.filter(
      (call) => call.body && "capture" in (call.body as object),
    );
    expect(withCapture).toHaveLength(1);
    expect(withCapture[0].url).toContain("/executions");
  });
});

/* -------------------------------------------------------------------------- */
/*  Where the section actually lives                                           */
/* -------------------------------------------------------------------------- */

describe("inside the existing packet", () => {
  async function renderPacket(
    options: { closed?: boolean; subjects?: () => Reply } = {},
  ) {
    const packet = fixturePacket(
      options.closed ? { restart: RESTART_CLOSED } : {},
    );
    vi.mocked(getOnboardingRuntime).mockResolvedValue(
      fixtureRuntime({ packets: [packet] }),
    );
    vi.mocked(getOnboardingDocumentSlots).mockResolvedValue([]);
    const harness = server({
      subjects: options.subjects ?? (() => envelope([subjectFixture()])),
    });

    render(
      <OnboardingRuntimeProvider>
        <OnboardingPacketView invocationId={INVOCATION_ID} />
      </OnboardingRuntimeProvider>,
    );
    await screen.findByText("Your sections");
    return harness;
  }

  it("appears in the packet the worker already has, on no new route", async () => {
    await renderPacket();

    await waitFor(() =>
      expect(document.querySelector(".ob-exec-section")).not.toBeNull(),
    );
    // One packet page, one provider, one session. Nothing here created a second of anything.
    expect(document.querySelectorAll(".ob-packet-view")).toHaveLength(1);
    expect(document.querySelectorAll(".ob-exec-section")).toHaveLength(1);
  });

  it("reads the packet's executions through the worker session it already had", async () => {
    const { calls } = await renderPacket();

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0].url).toContain(`/packets/${INVOCATION_ID}/executions/subjects`);
    expect(localStorage.getItem("jp_workerSession")).toBe("worker-token");
  });

  it("leaves the packet's own sections, progress, and navigation exactly as they were", async () => {
    await renderPacket();
    await waitFor(() =>
      expect(document.querySelector(".ob-exec-section")).not.toBeNull(),
    );

    expect(document.querySelector(".ob-module-list")).not.toBeNull();
    expect(document.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(screen.getByText("Back to my onboarding")).toBeTruthy();
  });

  it("shows a closed packet without offering anything to execute", async () => {
    await renderPacket({ closed: true });
    await waitFor(() =>
      expect(document.querySelector(".ob-exec-section")).not.toBeNull(),
    );

    expect(document.querySelector("[data-execution-submit]")).toBeNull();
    expect(document.querySelector("[data-execution-readonly]")).not.toBeNull();
  });

  it("adds nothing to a packet whose modules declare nothing to execute", async () => {
    await renderPacket({ subjects: () => envelope([]) });
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(document.querySelector(".ob-exec-section")).toBeNull();
    expect(document.querySelector(".ob-packet-view")).not.toBeNull();
  });

  it("does not re-derive the packet's completion when an act is recorded", async () => {
    const { calls } = await renderPacket();
    await waitFor(() =>
      expect(document.querySelector(".ob-exec-content")).not.toBeNull(),
    );
    const runtimeReads = vi.mocked(getOnboardingRuntime).mock.calls.length;

    const region = await makeOverflowing();
    await scrollTo(region, 600);
    await act(async () => {
      fireEvent.click(submitButton());
    });
    await waitFor(() => expect(submissions(calls)).toHaveLength(1));

    /*
      Completion is the server's derivation, read once by the runtime projection. An execution
      is supplementary at this gate: it must not silently become a second thing that decides a
      module or a packet is finished.
    */
    expect(vi.mocked(getOnboardingRuntime).mock.calls.length).toBe(runtimeReads);
  });
});

describe("when the wording moved underneath the worker", () => {
  /** The server amends the wording at the moment the act arrives. */
  function amendingServer() {
    let revision = "2026.1";
    let hash = HASH_A;
    return server({
      subjects: () =>
        envelope([
          subjectFixture({
            content: { ...subjectFixture().content, revision, contentHash: hash },
          }),
        ]),
      submit: () => {
        revision = "2026.2";
        hash = HASH_B;
        return refusal("EXECUTION_CONTENT_STALE");
      },
    });
  }

  async function attemptAgainstStaleWording() {
    const harness = amendingServer();
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);
    await act(async () => {
      fireEvent.click(submitButton());
    });
    await screen.findByText("Version 2026.2");
    return harness;
  }

  it("never shows the act as done", async () => {
    await attemptAgainstStaleWording();

    expect(document.querySelector("[data-execution-complete]")).toBeNull();
    expect(
      document.querySelector('[data-requires-execution="true"]'),
    ).not.toBeNull();
  });

  it("says in plain words that the wording changed", async () => {
    await attemptAgainstStaleWording();

    const notice = document.querySelector('[data-execution-refusal="STALE"]');
    expect(notice?.textContent).toContain("updated while you were reading it");
    expect(notice?.textContent).not.toContain("STALE");
  });

  it("puts the current wording on screen and asks for it to be read again", async () => {
    await attemptAgainstStaleWording();

    expect(document.querySelector('[data-presented-revision="2026.2"]')).not.toBeNull();
    await makeOverflowing();
    expect(submitButton().disabled).toBe(true);
  });

  it("never executes the replacement on the worker's behalf", async () => {
    const { calls } = await attemptAgainstStaleWording();

    // Exactly the one act the worker performed, against the wording he was shown.
    expect(submissions(calls)).toHaveLength(1);
    expect(
      (submissions(calls)[0] as { presented: { revision: string } }).presented.revision,
    ).toBe("2026.1");
  });
});

describe("an act already on the record", () => {
  it("is treated as satisfied rather than shown to the worker as a failure", async () => {
    let recorded = false;
    server({
      subjects: () =>
        envelope([
          recorded
            ? subjectFixture({ current: executionFixture(), requiresExecution: false })
            : subjectFixture(),
        ]),
      submit: () => {
        recorded = true;
        return refusal("EXECUTION_ALREADY_RECORDED");
      },
    });
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() =>
      expect(document.querySelector("[data-execution-complete]")).not.toBeNull(),
    );
    expect(document.querySelector("[data-execution-refusal]")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("what the surface will not show or send", () => {
  it("renders nothing from the protected side of the record", async () => {
    server({
      subjects: () =>
        envelope([
          {
            ...subjectFixture({
              current: executionFixture(),
              requiresExecution: false,
            }),
            // Fields no worker-facing contract carries, in case one ever appears.
            ciphertext: "AQICAHh-not-for-a-worker",
            encryptionEnvelope: { keyId: "arn:aws:kms:us-east-1:1:key/abc" },
            storageKey: "s3://bucket/execution/abc",
          } as unknown as OnboardingExecutionSubject,
        ]),
    });
    await renderSection();

    const rendered = document.body.innerHTML;
    for (const secret of ["AQICAHh", "kms", "arn:aws", "s3://", "storageKey"]) {
      expect({ secret, rendered: rendered.includes(secret) }).toEqual({
        secret,
        rendered: false,
      });
    }
  });

  it("computes no content hash anywhere in the execution surface", () => {
    const directory = join(
      process.cwd(),
      "components/workforce/onboarding/execution",
    );
    for (const file of [
      "OnboardingExecutionCapture.tsx",
      "ExecutionSubjectCard.tsx",
      "ExecutionFormControl.tsx",
      "ExecutionCaptureSurface.tsx",
      "useExecutionSubmission.ts",
      "useReadGate.ts",
    ]) {
      const source = readFileSync(join(directory, file), "utf8");
      for (const forbidden of ["createHash", "subtle", "sha256", "SHA-256"]) {
        expect({ file, forbidden, present: source.includes(forbidden) }).toEqual({
          file,
          forbidden,
          present: false,
        });
      }
    }
  });
});

describe("reachable without a mouse", () => {
  it("lets a keyboard reach and operate the acknowledgement checkbox", async () => {
    server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "CHECKBOX_ACKNOWLEDGEMENT" })]),
    });
    await renderSection();

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    checkbox.focus();
    expect(document.activeElement).toBe(checkbox);

    // A native checkbox is toggled by Space, which the browser delivers as a click.
    await act(async () => {
      fireEvent.click(checkbox);
    });

    expect(checkbox.checked).toBe(true);
    expect(submitButton().disabled).toBe(false);
  });

  it("labels the acknowledgement so it is announced, not merely visible", async () => {
    server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "CHECKBOX_ACKNOWLEDGEMENT" })]),
    });
    await renderSection();

    expect(
      screen.getByLabelText("I acknowledge the statement above."),
    ).toBeTruthy();
  });

  it("lets a keyboard reach the end of the governed wording and release the control", async () => {
    server({ subjects: () => envelope([subjectFixture()]) });
    await renderSection();
    const region = await makeOverflowing();

    region.focus();
    expect(document.activeElement).toBe(region);

    // End, or a run of Page Down: the browser scrolls a focused overflowing region and the
    // gate reads the position it lands at. No pointer is involved at any point.
    setGeometry(region, { scrollTop: 600, clientHeight: 300, scrollHeight: 900 });
    await act(async () => {
      fireEvent.keyDown(region, { key: "End" });
      fireEvent.scroll(region);
    });

    expect(submitButton().disabled).toBe(false);
  });

  it("names the drawing surface for a screen reader", async () => {
    server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "ELECTRONIC_SIGNATURE" })]),
    });
    await renderSection();

    const surface = pad();
    const labelId = surface.getAttribute("aria-labelledby");
    expect(document.getElementById(labelId as string)?.textContent).toBe(
      "Draw your signature",
    );
  });
});

describe("the vocabulary boundary", () => {
  /*
    A historical backend acceptance test scans the frontend for business and execution-form
    vocabulary outside the areas authorized to carry it. Asserting the same boundary here means
    a violation is caught by the suite that introduced it rather than four repositories away.
  */
  const forms = [
    "ELECTRONIC_SIGNATURE",
    "READ_ACKNOWLEDGEMENT",
    "CHECKBOX_ACKNOWLEDGEMENT",
    "INITIALS",
  ];

  it("keeps execution-form names out of the shared packet view", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/workforce/onboarding/runtime/OnboardingPacketView.tsx",
      ),
      "utf8",
    );
    for (const form of forms) {
      expect({ form, present: source.includes(form) }).toEqual({
        form,
        present: false,
      });
    }
  });

  it("keeps execution-form names out of the shared stylesheet", () => {
    const source = readFileSync(
      join(process.cwd(), "app/workforce/onboarding/onboarding.css"),
      "utf8",
    );
    for (const form of forms) {
      expect({ form, present: source.includes(form) }).toEqual({
        form,
        present: false,
      });
    }
  });
});

describe("the worker's own state and history", () => {
  it("says plainly when an update requires the subject to be completed again", async () => {
    server({
      subjects: () =>
        envelope([
          subjectFixture({
            content: { ...subjectFixture().content, revision: "2026.2", contentHash: HASH_B },
            current: executionFixture(),
            requiresExecution: true,
          }),
        ]),
    });
    await renderSection();

    expect(document.querySelector("[data-reexecution-required]")).not.toBeNull();
  });

  it("lists earlier versions without describing the evidence behind them", async () => {
    server({
      subjects: () =>
        envelope([
          subjectFixture({
            requiredForm: "ELECTRONIC_SIGNATURE",
            current: null,
            history: [
              executionFixture({
                executionId: "exec-old",
                executionForm: "ELECTRONIC_SIGNATURE",
                evidenceKind: "NATIVE_CAPTURE",
                evidence: {
                  strokeCount: 7,
                  captureDurationMs: 4210,
                  createdAt: "2026-08-01T10:00:00.000Z",
                },
                supersededAt: "2026-08-08T13:00:00.000Z",
              }),
            ],
          }),
        ]),
    });
    await renderSection();

    expect(document.querySelector("[data-history-execution]")).not.toBeNull();
    // Auditor descriptors belong to the Gate 5G evidence surface, not to the worker.
    expect(document.body.textContent).not.toContain("7");
    expect(document.body.textContent).not.toContain("4210");
    expect(document.body.textContent).not.toContain("strokeCount");
  });
});

describe("what never reaches the worker", () => {
  it("never renders a refusal code or a server message", async () => {
    server({
      subjects: () => envelope([subjectFixture()]),
      submit: () => refusal("EXECUTION_FORM_NOT_SATISFIED"),
    });
    await renderSection();
    const region = await makeOverflowing();
    await scrollTo(region, 600);

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() =>
      expect(document.querySelector("[data-execution-refusal]")).not.toBeNull(),
    );
    expect(document.body.textContent).not.toContain("EXECUTION_FORM_NOT_SATISFIED");
    expect(document.body.textContent).not.toContain("refused:");
  });

  it("sends no worker, candidate, actor, or packet identity", async () => {
    const { calls } = server({
      subjects: () =>
        envelope([subjectFixture({ requiredForm: "CHECKBOX_ACKNOWLEDGEMENT" })]),
    });
    await renderSection();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const body = submissions(calls)[0] as Record<string, unknown>;
    for (const forbidden of [
      "candidateId",
      "workerId",
      "actorId",
      "actorType",
      "packetId",
      "executedAt",
    ]) {
      expect({ forbidden, present: forbidden in body }).toEqual({
        forbidden,
        present: false,
      });
    }
  });
});
