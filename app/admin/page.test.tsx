import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AdminPage from "./page";

/**
 * Gate 10C-E1A. System Settings stopped being a planned shell and became a real
 * administrative feature, so the dashboard must actually take an administrator
 * there. What these tests also hold closed is the blast radius: activating one
 * card must not quietly promote a neighbour that has nothing behind it.
 */

afterEach(cleanup);

/** The card an administrator sees for a feature, found by its title. */
function cardFor(title: string): HTMLElement {
  const card = screen.getByText(title).closest(".admin-card");
  if (!card) throw new Error(`No admin card found for "${title}"`);
  return card as HTMLElement;
}

describe("Admin dashboard - System Settings card", () => {
  it("is navigable to the authenticated System Settings page", () => {
    render(<AdminPage />);

    const card = cardFor("System Settings");

    expect(card.tagName).toBe("A");
    expect(card.getAttribute("href")).toBe("/admin/settings");
  });

  it("is no longer presented as a future feature", () => {
    render(<AdminPage />);

    const card = cardFor("System Settings");

    expect(card.className).toContain("active");
    expect(card.className).not.toContain("disabled");
    expect(card.textContent).toContain("ACTIVE");
    expect(card.textContent).not.toContain("FUTURE");
    expect(card.textContent).not.toContain("UI shell planned");
  });

  it("tells the administrator what is behind it", () => {
    render(<AdminPage />);

    const card = cardFor("System Settings");

    expect(card.textContent).toContain("Workforce Onboarding");
    expect(card.textContent).toContain("Open System Settings");
  });
});

describe("Admin dashboard - unrelated future features", () => {
  it.each(["Integrations", "Audit Logs"])(
    "leaves the %s card exactly as it was",
    (title) => {
      render(<AdminPage />);

      const card = cardFor(title);

      expect(card.tagName).toBe("DIV");
      expect(card.getAttribute("href")).toBeNull();
      expect(card.className).toContain("disabled");
      expect(card.className).not.toContain("active");
      expect(card.textContent).toContain("FUTURE");
      expect(card.textContent).toContain("UI shell planned");
    },
  );

  it("activates no other card alongside System Settings", () => {
    const { container } = render(<AdminPage />);

    const stillPlanned = Array.from(
      container.querySelectorAll(".admin-card.disabled"),
    ).map((card) => card.querySelector(".card-title")?.textContent);

    expect(stillPlanned).toEqual(["Integrations", "Audit Logs"]);
  });
});
