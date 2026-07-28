import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CategorizedSelector from "./CategorizedSelector";
import type { CatalogView } from "./catalogContract";

/**
 * These cases exist to hold the locked presentation contract, not to exercise React. Each one
 * corresponds to a rule that a consuming surface previously reimplemented and got wrong.
 *
 * Governance: 02_backend/governance/MASTER_CATALOG_PRESENTATION_CONTRACT.md
 */

/** Curated order is deliberately NOT alphabetical, so any client re-sort is visible. */
const PPE_VIEW: CatalogView = {
  catalogKey: "PPE",
  categorized: true,
  groups: [
    {
      category: "Head Protection",
      displayOrder: 0,
      options: [
        { id: "hard-hat", name: "Hard Hat", displayOrder: 0 },
        { id: "bump-cap", name: "Bump Cap", displayOrder: 1 },
      ],
    },
    {
      category: "Eye & Face Protection",
      displayOrder: 1,
      options: [{ id: "goggles", name: "Safety Goggles", displayOrder: 0 }],
    },
    {
      category: null,
      displayOrder: 2,
      options: [{ id: "misc", name: "Knee Pads", displayOrder: 0 }],
    },
  ],
};

function groupTitles(container: HTMLElement = document.body) {
  return Array.from(
    container.querySelectorAll(".jp-catalog-group-title"),
  ).map((element) => element.textContent);
}

function optionLabels() {
  return screen
    .getAllByRole("checkbox")
    .map((box) => box.closest("label")?.textContent ?? "");
}

function search() {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

function checkboxes() {
  return screen.getAllByRole("checkbox") as HTMLInputElement[];
}

afterEach(cleanup);

describe("CategorizedSelector", () => {
  it("renders groups and options in served order rather than alphabetically", () => {
    render(
      <CategorizedSelector view={PPE_VIEW} selectedIds={[]} onToggle={vi.fn()} />,
    );

    // Alphabetical would put "Eye & Face Protection" first and "Bump Cap" before "Hard Hat".
    expect(groupTitles()).toEqual([
      "Head Protection",
      "Eye & Face Protection",
      "Other",
    ]);
    expect(optionLabels()).toEqual([
      "Hard Hat",
      "Bump Cap",
      "Safety Goggles",
      "Knee Pads",
    ]);
  });

  it("omits group headings for a catalog with no category dimension", () => {
    const trades: CatalogView = {
      catalogKey: "TRADE",
      categorized: false,
      groups: [
        {
          category: null,
          displayOrder: 0,
          options: [
            { id: "boilermaker", name: "Boilermaker", displayOrder: 0 },
            { id: "millwright", name: "Millwright", displayOrder: 1 },
          ],
        },
      ],
    };

    render(
      <CategorizedSelector view={trades} selectedIds={[]} onToggle={vi.fn()} />,
    );

    expect(groupTitles()).toEqual([]);
    expect(screen.queryByText("Other")).toBeNull();
    expect(optionLabels()).toEqual(["Boilermaker", "Millwright"]);
  });

  it("renders a multi-category item under every group and keeps selection in step", () => {
    const capabilities: CatalogView = {
      catalogKey: "CAPABILITY",
      categorized: true,
      groups: [
        {
          category: "Welding",
          displayOrder: 0,
          options: [{ id: "tig", name: "TIG Welding", displayOrder: 0 }],
        },
        {
          category: "Pipefitting",
          displayOrder: 1,
          options: [{ id: "tig", name: "TIG Welding", displayOrder: 0 }],
        },
      ],
    };

    const onToggle = vi.fn();
    const { rerender } = render(
      <CategorizedSelector
        view={capabilities}
        selectedIds={[]}
        onToggle={onToggle}
      />,
    );

    expect(checkboxes()).toHaveLength(2);
    expect(checkboxes().every((box) => !box.checked)).toBe(true);

    fireEvent.click(checkboxes()[0]);
    expect(onToggle).toHaveBeenCalledWith("tig");

    // Selection is keyed by stable identifier, so both renderings reflect it.
    rerender(
      <CategorizedSelector
        view={capabilities}
        selectedIds={["tig"]}
        onToggle={onToggle}
      />,
    );
    expect(checkboxes().every((box) => box.checked)).toBe(true);
  });

  it("keeps identically named categories in different catalogs separate", () => {
    const weldingGroup = (
      catalogKey: CatalogView["catalogKey"],
      id: string,
      name: string,
    ): CatalogView => ({
      catalogKey,
      categorized: true,
      groups: [
        {
          category: "Welding",
          displayOrder: 0,
          options: [{ id, name, displayOrder: 0 }],
        },
      ],
    });

    render(
      <>
        <CategorizedSelector
          view={weldingGroup("TOOL", "tool-1", "Welding Machine")}
          selectedIds={[]}
          onToggle={vi.fn()}
          ariaLabel="Tools"
        />
        <CategorizedSelector
          view={weldingGroup("PPE", "ppe-1", "Welding Hood")}
          selectedIds={[]}
          onToggle={vi.fn()}
          ariaLabel="PPE"
        />
      </>,
    );

    // Two separate "Welding" groups, never merged into one.
    expect(groupTitles()).toEqual(["Welding", "Welding"]);
    expect(
      within(screen.getByRole("group", { name: "Tools" })).getByText(
        "Welding Machine",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("group", { name: "PPE" })).getByText(
        "Welding Hood",
      ),
    ).toBeTruthy();
  });

  it("retains an unresolvable selection, flags it, and never shows its identifier", () => {
    render(
      <CategorizedSelector
        view={PPE_VIEW}
        selectedIds={["hard-hat", "retired-uuid-1234"]}
        onToggle={vi.fn()}
        staleSelections={[
          {
            id: "retired-uuid-1234",
            name: null,
            category: null,
            unavailable: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("No longer available")).toBeTruthy();
    expect(document.body.textContent).not.toContain("retired-uuid-1234");
    expect(screen.getByText("2 selected")).toBeTruthy();
  });

  it("keeps a resolvable name alongside the unavailable flag", () => {
    render(
      <CategorizedSelector
        view={PPE_VIEW}
        selectedIds={["retired-hood"]}
        onToggle={vi.fn()}
        staleSelections={[
          {
            id: "retired-hood",
            name: "Legacy Welding Hood",
            category: "Welding Protection",
            unavailable: true,
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Legacy Welding Hood — No longer available"),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("retired-hood");
  });

  it("ignores resolved entries passed alongside stale ones", () => {
    render(
      <CategorizedSelector
        view={PPE_VIEW}
        selectedIds={["hard-hat"]}
        onToggle={vi.fn()}
        staleSelections={[
          {
            id: "hard-hat",
            name: "Hard Hat",
            category: "Head Protection",
            unavailable: false,
          },
        ]}
      />,
    );

    expect(screen.queryByText("Previously selected")).toBeNull();
    expect(screen.queryByText("No longer available")).toBeNull();
  });

  it("filters on search without disturbing served order", () => {
    render(
      <CategorizedSelector view={PPE_VIEW} selectedIds={[]} onToggle={vi.fn()} />,
    );

    fireEvent.change(search(), { target: { value: "p" } });

    // "Bump Cap" and "Knee Pads" match; the goggles group drops out entirely. The surviving
    // groups and options stay in served order, and the filter never promotes a match.
    expect(groupTitles()).toEqual(["Head Protection", "Other"]);
    expect(optionLabels()).toEqual(["Bump Cap", "Knee Pads"]);
  });

  it("reports when nothing matches and when nothing is available", () => {
    const { rerender } = render(
      <CategorizedSelector view={PPE_VIEW} selectedIds={[]} onToggle={vi.fn()} />,
    );

    fireEvent.change(search(), { target: { value: "zzz" } });
    expect(screen.getByText(/No matches for/)).toBeTruthy();

    rerender(
      <CategorizedSelector
        view={{ catalogKey: "PPE", categorized: true, groups: [] }}
        selectedIds={[]}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Nothing available to select.")).toBeTruthy();
    expect(search().disabled).toBe(true);
  });

  describe("single-select mode", () => {
    const trades: CatalogView = {
      catalogKey: "TRADE",
      categorized: false,
      groups: [
        {
          category: null,
          displayOrder: 0,
          options: [
            { id: "boilermaker", name: "Boilermaker", displayOrder: 0 },
            { id: "millwright", name: "Millwright", displayOrder: 1 },
          ],
        },
      ],
    };

    it("renders one radio group and reports the chosen entry", () => {
      const onToggle = vi.fn();
      render(
        <CategorizedSelector
          view={trades}
          selectionMode="single"
          selectedIds={["boilermaker"]}
          onToggle={onToggle}
        />,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios).toHaveLength(2);
      // One shared name, so the browser enforces mutual exclusivity.
      expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
      expect(radios[0].checked).toBe(true);

      fireEvent.click(radios[1]);
      expect(onToggle).toHaveBeenCalledWith("millwright");
    });

    it("omits the running count, which is meaningless for one choice", () => {
      render(
        <CategorizedSelector
          view={trades}
          selectionMode="single"
          selectedIds={["boilermaker"]}
          onToggle={vi.fn()}
        />,
      );
      expect(screen.queryByText(/selected$/)).toBeNull();
    });

    it("puts a retired prior choice in the same group so a new pick replaces it", () => {
      render(
        <CategorizedSelector
          view={trades}
          selectionMode="single"
          selectedIds={["retired-trade"]}
          onToggle={vi.fn()}
          staleSelections={[
            {
              id: "retired-trade",
              name: "Pipefitter",
              category: null,
              unavailable: true,
            },
          ]}
        />,
      );

      const radios = screen.getAllByRole("radio") as HTMLInputElement[];
      expect(radios).toHaveLength(3);
      expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
      expect(
        screen.getByText("Pipefitter — No longer available"),
      ).toBeTruthy();
      expect(screen.queryByRole("checkbox")).toBeNull();
    });
  });

  /**
   * The slots exist so Job Orders can carry its own governed per-entry semantics - enforcement
   * mode, baseline provenance - without those leaking into the catalog contract or forcing a
   * second selector implementation.
   */
  describe("consumer-owned per-entry slots", () => {
    it("renders a locked entry selected and not clearable", () => {
      const onToggle = vi.fn();
      render(
        <CategorizedSelector
          view={PPE_VIEW}
          selectedIds={["hard-hat", "goggles"]}
          lockedIds={["hard-hat"]}
          onToggle={onToggle}
        />,
      );

      const [hardHat, bumpCap, goggles] = checkboxes();
      expect(hardHat.checked).toBe(true);
      expect(hardHat.disabled).toBe(true);
      // Locking one entry must not disable the rest of the catalog.
      expect(bumpCap.disabled).toBe(false);
      expect(goggles.checked).toBe(true);
      expect(goggles.disabled).toBe(false);
    });

    it("keeps a locked entry checked even when the caller omits it from selectedIds", () => {
      render(
        <CategorizedSelector
          view={PPE_VIEW}
          selectedIds={[]}
          lockedIds={["bump-cap"]}
          onToggle={vi.fn()}
        />,
      );

      expect(checkboxes()[1].checked).toBe(true);
    });

    it("places an adornment beside an entry without capturing its label", () => {
      const onToggle = vi.fn();
      render(
        <CategorizedSelector
          view={PPE_VIEW}
          selectedIds={["hard-hat"]}
          onToggle={onToggle}
          renderOptionAdornment={({ id, selected }) =>
            selected ? <button type="button">{`configure ${id}`}</button> : null
          }
        />,
      );

      // Only the selected entry gets one, and it sits outside the toggle's label.
      const adornments = screen.getAllByRole("button");
      expect(adornments).toHaveLength(1);
      expect(adornments[0].closest("label")).toBeNull();

      fireEvent.click(adornments[0]);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("gives a retained unavailable entry its adornment too", () => {
      render(
        <CategorizedSelector
          view={PPE_VIEW}
          selectedIds={["retired-hood"]}
          onToggle={vi.fn()}
          staleSelections={[
            {
              id: "retired-hood",
              name: "Legacy Welding Hood",
              category: "Welding Protection",
              unavailable: true,
            },
          ]}
          renderOptionAdornment={({ unavailable }) =>
            unavailable ? <span>still enforced</span> : null
          }
        />,
      );

      // A requirement does not stop being enforced because its catalog entry was retired.
      expect(screen.getByText("still enforced")).toBeTruthy();
      expect(screen.getAllByText("still enforced")).toHaveLength(1);
    });

    it("reports the served category to the adornment without exposing a category id", () => {
      const seen: Array<string | null> = [];
      render(
        <CategorizedSelector
          view={PPE_VIEW}
          selectedIds={[]}
          onToggle={vi.fn()}
          renderOptionAdornment={({ category }) => {
            seen.push(category);
            return null;
          }}
        />,
      );

      expect(seen).toEqual([
        "Head Protection",
        "Head Protection",
        "Eye & Face Protection",
        null,
      ]);
    });
  });

  it("disables every control when disabled", () => {
    render(
      <CategorizedSelector
        view={PPE_VIEW}
        selectedIds={["retired"]}
        onToggle={vi.fn()}
        staleSelections={[
          { id: "retired", name: null, category: null, unavailable: true },
        ]}
        disabled
      />,
    );

    // Includes the retained unavailable entry, which must not be clearable either.
    expect(checkboxes()).toHaveLength(5);
    expect(checkboxes().every((box) => box.disabled)).toBe(true);
    expect(search().disabled).toBe(true);
  });
});
