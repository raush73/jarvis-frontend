import React from "react";

/**
 * Industrial Light V1 — Button Component
 *
 * Variants:
 *   primary     — blue fill (#2563eb), white text. Use for: save, create, add, confirm.
 *   secondary   — white fill, dark text, border. Use for: cancel, back, close.
 *   destructive — red fill (#dc2626), white text. Use for: delete confirmation ONLY.
 *
 * Never use destructive for cancel or close actions.
 * Never use primary for delete actions.
 */
export default function Button({
  children,
  variant = "primary",
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "destructive";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  const styles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "9px 16px",
    borderRadius: "7px",
    fontSize: "13px",
    fontWeight: variant === "secondary" ? 600 : 700,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.12s ease",
    whiteSpace: "nowrap",
    ...(variant === "primary" && {
      background: disabled ? "var(--color-accent-primary-disabled)" : "var(--color-accent-primary)",
      color: "#ffffff",
      border: "none",
    }),
    ...(variant === "secondary" && {
      background: "var(--color-bg-card)",
      color: "var(--color-text-secondary)",
      border: "1px solid var(--color-border)",
      opacity: disabled ? 0.5 : 1,
    }),
    ...(variant === "destructive" && {
      background: disabled ? "var(--color-danger-disabled)" : "var(--color-danger)",
      color: "#ffffff",
      border: "none",
    }),
  };

  return (
    <button onClick={onClick} disabled={disabled} type={type} style={styles}>
      {children}
    </button>
  );
}
