import React from "react";

/**
 * Industrial Light V1 — Card
 *
 * The standard white surface container for Jarvis Prime page content.
 *
 * Visual rules:
 *   Background:    #ffffff (--color-bg-card)
 *   Border:        1px solid #e5e7eb (--color-border)
 *   Border-radius: 12px
 *   Padding:       20px
 *   Shadow:        NONE — border is the visual boundary in Industrial Light V1
 *
 * Use Card for:
 *   - Summary cards (key facts about an entity)
 *   - Content panels (tab content areas)
 *   - Action/approval cards
 *   - Any white surface that needs a visible border
 *
 * Do NOT use Card for:
 *   - The global nav or module tabs (those are dark surfaces)
 *   - Modals (use inline styles with the modal overlay pattern)
 *   - The page background itself
 */
export default function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
