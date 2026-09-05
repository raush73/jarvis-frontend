/**
 * Where the worker is supposed to type.
 *
 * The Owner's finding: worker-facing editable controls were bounded in a light gray on a
 * white card and were hard to FIND. On a surface that captures banking, tax and identity
 * details, not being able to see the field is not a cosmetic problem.
 *
 * The ruling: editable worker controls carry a clearly visible dark boundary at rest, focus
 * stays at least as obvious as that, an error stays unmistakably an error, and a control the
 * worker may not edit must not look like one he may.
 *
 * WHY THIS IS ASSERTED AGAINST THE STYLESHEETS. A class name on an input proves nothing if
 * nothing styles it, and the contrast itself lives in CSS rather than in any component - so
 * the rules are read from the stylesheet exactly as the delivered payroll suite already
 * reads its own. The suite then reads the module SOURCES to prove which classes the worker's
 * forms actually put on their controls, which is what makes the treatment reach him rather
 * than merely exist.
 *
 * Contrast is CALCULATED rather than string-matched, so this proves the boundary is dark
 * against the worker's white card and not merely that a particular hex was typed.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const WORKFORCE_CSS = read("app/workforce/workforce.css");
const PAYROLL_CSS = read(
  "components/workforce/onboarding/modules/payroll-payment/payroll-payment.css",
);

/**
 * Every rule in a stylesheet, keyed by its selector list.
 *
 * Parsed rather than pattern-matched so a lookup means what it says: comments are removed so
 * a commented-out declaration cannot satisfy an assertion, line endings and wrapping are
 * normalised so a selector list spanning several lines is found, and the key is the WHOLE
 * selector list - without which `.wf-choice` would happily match the error rule for
 * `.wf-choices[aria-invalid="true"] .wf-choice` and prove nothing about the choice card.
 */
function parseRules(stylesheet: string): Map<string, string> {
  const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = new Map<string, string>();
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(withoutComments)) !== null) {
    const selector = found[1].replace(/\s+/g, " ").trim();
    // First declaration wins, so a top-level rule is never shadowed by a later override.
    if (!rules.has(selector)) rules.set(selector, found[2]);
  }
  return rules;
}

const RULES = new Map<string, Map<string, string>>();

/** The body of the rule whose selector list is exactly `selector`, or null. */
function rule(stylesheet: string, selector: string): string | null {
  let parsed = RULES.get(stylesheet);
  if (!parsed) {
    parsed = parseRules(stylesheet);
    RULES.set(stylesheet, parsed);
  }
  return parsed.get(selector.replace(/\s+/g, " ").trim()) ?? null;
}

/* ---------------------------------------------------------------- contrast maths */

function channel(component: number): number {
  const ratio = component / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors. */
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** The worker's card background, which every one of these controls sits on. */
const CARD_BACKGROUND = "#ffffff";

describe("the worker form-control boundary is declared where both surfaces read it", () => {
  it("declares the boundary tokens on the workforce page root and not in the global layer", () => {
    const pageRoot = rule(WORKFORCE_CSS, ".wf-page");
    expect(pageRoot).not.toBeNull();
    expect(pageRoot).toMatch(/--wf-control-border:\s*#111827/);
    expect(pageRoot).toMatch(/--wf-control-border-inactive:/);
    expect(pageRoot).toMatch(/--wf-control-bg-inactive:/);

    /*
      SCOPE IS THE POINT. Declared on the workforce page root, the darker boundary reaches
      the worker's application and onboarding pages and nothing else in Jarvis. Redefining a
      shared token would have restyled admin, dispatch, careers and catalog surfaces that are
      not this correction's product surface, so the global layer is left alone.
    */
    const globals = read("app/globals.css");
    expect(globals).not.toContain("--wf-control-border");
    // The shared token every other Jarvis surface borrows is left exactly as it was.
    expect(globals).toMatch(/--color-border-strong:\s*#d1d5db/);
    expect(globals).toMatch(/--color-border:\s*#e5e7eb/);
  });

  it("makes that boundary genuinely dark against the worker's white card", () => {
    // Not "a different gray". A near-black edge, verified by contrast rather than by hex.
    expect(contrast("#111827", CARD_BACKGROUND)).toBeGreaterThan(15);
    // And plainly darker than the faint panel gray it replaced, which failed even 3:1.
    expect(contrast("#d1d5db", CARD_BACKGROUND)).toBeLessThan(2);
  });
});

describe("shared worker text, select and textarea controls", () => {
  const SHARED = ".wf-input,\n.wf-select,\n.wf-textarea";

  it("carries the dark boundary at rest", () => {
    const resting = rule(WORKFORCE_CSS, SHARED);
    expect(resting).not.toBeNull();
    expect(resting).toMatch(/border:\s*1px solid var\(--wf-control-border/);
    // The design language is preserved: same white fill, same rounding, same padding.
    expect(resting).toMatch(/background:\s*var\(--color-bg-card\)/);
    expect(resting).toMatch(/border-radius:\s*6px/);
    expect(resting).toMatch(/padding:\s*9px 11px/);
  });

  it("keeps focus louder than the darker resting state", () => {
    const focus = rule(
      WORKFORCE_CSS,
      ".wf-input:focus,\n.wf-select:focus,\n.wf-textarea:focus",
    );
    expect(focus).not.toBeNull();
    /*
      Against a near-black border a recolored border alone would be a change of hue and not
      of weight, so focus is asserted to add something OUTSIDE the control: an accent outline
      and a halo behind it. That is visible at a glance, which resting contrast is not.
    */
    expect(focus).toMatch(/outline:\s*2px solid var\(--color-accent-primary\)/);
    expect(focus).toMatch(/outline-offset:/);
    expect(focus).toMatch(/box-shadow:\s*0 0 0 3px var\(--color-accent-subtle-border\)/);
    expect(focus).toMatch(/border-color:\s*var\(--color-accent-primary\)/);
  });

  it("keeps an error unmistakably an error", () => {
    const invalid = rule(
      WORKFORCE_CSS,
      '.wf-input[aria-invalid="true"],\n.wf-select[aria-invalid="true"],\n.wf-textarea[aria-invalid="true"]',
    );
    expect(invalid).not.toBeNull();
    expect(invalid).toMatch(/border-color:\s*var\(--color-danger\)/);
    // Not colour alone, and not the same weight as the resting boundary it has to beat.
    expect(invalid).toMatch(/border-width:\s*2px/);
    expect(invalid).toMatch(/box-shadow:\s*0 0 0 3px var\(--color-danger-bg\)/);
  });

  it("makes a control the worker may not edit stop looking like one he may", () => {
    const inactive = rule(
      WORKFORCE_CSS,
      ".wf-input:disabled,\n.wf-select:disabled,\n.wf-textarea:disabled,\n.wf-input[readonly],\n.wf-textarea[readonly]",
    );
    expect(inactive).not.toBeNull();
    // It GIVES UP the dark boundary, which is now what says "type here".
    expect(inactive).toMatch(/border-color:\s*var\(--wf-control-border-inactive/);
    expect(inactive).toMatch(/background:\s*var\(--wf-control-bg-inactive/);
    expect(inactive).toMatch(/cursor:\s*not-allowed/);
    // Read-only is covered too, not just disabled: neither is his to change.
    expect(WORKFORCE_CSS).toContain(".wf-input[readonly]");
  });
});

describe("shared worker choice controls", () => {
  it("puts the dark boundary on the choice card", () => {
    const choice = rule(WORKFORCE_CSS, ".wf-choice");
    expect(choice).not.toBeNull();
    expect(choice).toMatch(/border:\s*1px solid var\(--wf-control-border/);
    expect(choice).toMatch(/border-radius:\s*8px/);
  });

  it("distinguishes a choice that cannot be taken, and one that has been", () => {
    expect(rule(WORKFORCE_CSS, ".wf-choice:has(input:disabled)")).toMatch(
      /border-color:\s*var\(--wf-control-border-inactive/,
    );
    expect(rule(WORKFORCE_CSS, ".wf-choice.is-selected")).toMatch(
      /border-color:\s*var\(--color-accent-primary\)/,
    );
  });

  it("keeps radios and checkboxes native, darkened and visibly focusable", () => {
    /*
      NATIVE CONTROLS ARE NOT REPLACED. A styled substitute would buy a darker outline at the
      cost of the platform's keyboard behaviour, role and accessible name, so the control
      itself is darkened where the browser allows it and given the same explicit focus ring
      the text controls get. The card above supplies the visible boundary.
    */
    expect(
      rule(WORKFORCE_CSS, '.wf-page input[type="radio"],\n.wf-page input[type="checkbox"]'),
    ).toMatch(/accent-color:\s*var\(--color-accent-primary\)/);
    expect(
      rule(
        WORKFORCE_CSS,
        '.wf-page input[type="radio"]:focus-visible,\n.wf-page input[type="checkbox"]:focus-visible',
      ),
    ).toMatch(/outline:\s*2px solid var\(--color-accent-primary\)/);
    // No appearance reset that would have taken the native control away to get there.
    expect(WORKFORCE_CSS).not.toMatch(/input\[type="(radio|checkbox)"\][^{]*\{[^}]*appearance/);
  });
});

describe("the payroll payment module, which carries its own control class", () => {
  it("takes the same boundary, focus, error and inactive treatment", () => {
    const resting = rule(PAYROLL_CSS, ".pp-input");
    expect(resting).not.toBeNull();
    expect(resting).toMatch(/border:\s*1px solid var\(--wf-control-border/);

    expect(rule(PAYROLL_CSS, ".pp-input:focus")).toMatch(
      /outline:\s*2px solid var\(--color-accent-primary/,
    );
    expect(rule(PAYROLL_CSS, ".pp-input:focus")).toMatch(/box-shadow:/);

    const invalid = rule(PAYROLL_CSS, '.pp-input[aria-invalid="true"]');
    expect(invalid).toMatch(/border-color:\s*var\(--color-danger/);
    expect(invalid).toMatch(/border-width:\s*2px/);

    const inactive = rule(PAYROLL_CSS, ".pp-input:disabled,\n.pp-input[readonly]");
    expect(inactive).toMatch(/border-color:\s*var\(--wf-control-border-inactive/);
    expect(inactive).toMatch(/cursor:\s*not-allowed/);

    // The payment-method card is this module's choice boundary.
    expect(rule(PAYROLL_CSS, ".pp-choice")).toMatch(
      /border:\s*1px solid var\(--wf-control-border/,
    );
  });

  it("no longer bounds an invalid field with an undefined token", () => {
    /*
      The error border referenced `--color-error-border`, which is DECLARED NOWHERE, so every
      invalid payroll field fell back to a pale rose that read as decoration. It now uses the
      same danger token as the rest of Jarvis.
    */
    expect(read("app/globals.css")).not.toContain("--color-error-border");
    expect(PAYROLL_CSS).not.toContain("--color-error-border");
  });
});

describe("the treatment reaches the worker's actual forms, and not only payroll's", () => {
  /*
    A rule that no control wears is not a correction. These read the delivered module sources
    to prove which classes the worker's own forms put on their entry controls - so the rules
    above are known to land on the fields he types into, in more than one module.
  */
  const wearers: Array<{ module: string; path: string; control: string }> = [
    {
      module: "payroll payment",
      path: "components/workforce/onboarding/modules/payroll-payment/DepositAccountEditor.tsx",
      control: "pp-input",
    },
    {
      module: "emergency contacts",
      path: "components/workforce/onboarding/modules/emergency-contacts/ContactEditor.tsx",
      control: "wf-input",
    },
    {
      module: "emergency contacts relationship select",
      path: "components/workforce/onboarding/modules/emergency-contacts/RelationshipSelect.tsx",
      control: "wf-input",
    },
    {
      module: "federal tax",
      path: "components/workforce/onboarding/modules/federal-tax/QuestionField.tsx",
      control: "wf-input",
    },
    {
      module: "employment eligibility",
      path: "components/workforce/onboarding/modules/employment-eligibility/DocumentFields.tsx",
      control: "wf-input",
    },
  ];

  for (const { module, path, control } of wearers) {
    it(`${module} enters through a control the shared treatment covers`, () => {
      expect(read(path)).toContain(`className="${control}`);
    });
  }

  it("covers more than one module, which is what makes it shared", () => {
    const modules = new Set(
      wearers.map(({ path }) => path.split("/modules/")[1].split("/")[0]),
    );
    expect(modules.size).toBeGreaterThan(1);
    expect(modules).toContain("payroll-payment");
  });
});
