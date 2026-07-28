import { apiFetch } from "@/lib/api";
import type {
  CatalogKey,
  CatalogSelectionView,
  CatalogView,
} from "@/components/catalog/catalogContract";

/**
 * Staff-facing master catalog access for operational selection surfaces: Job Orders,
 * Recruiting, Dispatch, Careers.
 *
 * Governance: 02_backend/governance/MASTER_CATALOG_PRESENTATION_CONTRACT.md
 *
 * These surfaces select from a catalog rather than administer it, so they receive the consumer
 * projection - active entries only, already grouped and ordered. Catalog administration is a
 * different audience behind a different guard and is not reachable from here.
 */

export function getCatalog(catalogKey: CatalogKey): Promise<CatalogView> {
  return apiFetch<CatalogView>(`/catalogs/${catalogKey}`);
}

/**
 * Name stored identifiers that the consumer projection cannot account for, such as a baseline
 * entry deactivated after the baseline was configured.
 *
 * Resolution is server-side deliberately: a surface must never infer staleness itself, and must
 * never fall back to rendering an identifier when a name does not resolve.
 */
export async function resolveCatalogSelections(
  catalogKey: CatalogKey,
  ids: string[],
): Promise<CatalogSelectionView[]> {
  if (ids.length === 0) return [];
  return apiFetch<CatalogSelectionView[]>(`/catalogs/${catalogKey}/selections`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export const EMPTY_CATALOG_VIEW = (catalogKey: CatalogKey): CatalogView => ({
  catalogKey,
  categorized: false,
  groups: [],
});
