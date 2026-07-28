/**
 * Browser-side mirror of the C4E master catalog presentation contract, consumer projection.
 *
 * Governance: 02_backend/governance/MASTER_CATALOG_PRESENTATION_CONTRACT.md
 * Backend source of truth: 02_backend/src/catalog-presentation/catalog-presentation.contracts.ts
 *
 * Only the CONSUMER projection is mirrored here. The administrative projection carries lifecycle
 * state and business codes and belongs to administration screens, which read their own endpoints.
 *
 * These types are structural mirrors, not imports: the two applications are separate deployables
 * and the frontend must not reach into backend source.
 */

export const CATALOG_KEYS = [
  'TRADE',
  'TOOL',
  'PPE',
  'CERTIFICATION',
  'CAPABILITY',
] as const;

export type CatalogKey = (typeof CATALOG_KEYS)[number];

/** The single platform-wide label for a selection that can no longer be resolved (§11.2). */
export const CATALOG_UNAVAILABLE_LABEL = 'No longer available';

/** Label for the uncategorized bucket. Supported for edge cases; never the primary experience. */
export const CATALOG_UNCATEGORIZED_LABEL = 'Other';

/**
 * Carries no category identifier, no business code, and no lifecycle flag. There is no active
 * flag because this projection is pre-filtered to active entries server-side.
 */
export interface CatalogOption {
  id: string;
  name: string;
  /** Zero-based render position, already applied to the array order. */
  displayOrder: number;
}

export interface CatalogGroup {
  /** Category name, or null for the uncategorized bucket. */
  category: string | null;
  /** Zero-based render position, already applied to the array order. */
  displayOrder: number;
  options: CatalogOption[];
}

/**
 * A whole catalog, already grouped and ordered by the server. Rendered as given: client-side
 * re-sorting is prohibited (§7.1, §13.8).
 */
export interface CatalogView {
  catalogKey: CatalogKey;
  categorized: boolean;
  groups: CatalogGroup[];
}

/**
 * A stored selection resolved against the live catalog. An entry that can no longer be resolved
 * is retained and flagged rather than silently dropped (§11.2).
 */
export interface CatalogSelectionView {
  id: string;
  name: string | null;
  category: string | null;
  unavailable: boolean;
}

/**
 * Group identity is scoped by catalog key so that a surface rendering more than one catalog never
 * collapses identically named categories into a single group (§5, Amendment 3). "Welding" as a
 * Tool category and "Welding" as a PPE category are different business concepts.
 */
export function catalogGroupKey(
  catalogKey: CatalogKey,
  category: string | null,
): string {
  return `${catalogKey}::${category ?? '\u0000uncategorized'}`;
}
