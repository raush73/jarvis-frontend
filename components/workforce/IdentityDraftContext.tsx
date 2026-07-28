"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type IdentityStageView,
  type SaveIdentityInput,
  getIdentity,
  saveIdentity,
} from "@/lib/workforce/workforceApi";

/**
 * Shared draft for the Identity and Contact Information screens.
 *
 * The backend Identity stage is a SINGLE atomic save: one PUT carries name, date of
 * birth, SSN, and contact/address together, and it always requires the SSN. Presenting
 * that as two screens therefore means holding the first screen's values until the
 * second screen is complete, then saving once. This is a presentation split only - the
 * backend contract is unchanged and remains the sole validator.
 *
 * The SSN lives in memory for the life of the page session and is never written to
 * localStorage or sessionStorage. A reload clears it, and the server only ever returns
 * a masked last-4, so an existing SSN must be re-entered to save the stage again.
 */

export type IdentityDraft = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  ssn: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
};

const EMPTY: IdentityDraft = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  dateOfBirth: "",
  ssn: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
};

type IdentityDraftContextValue = {
  draft: IdentityDraft;
  setField: <K extends keyof IdentityDraft>(
    key: K,
    value: IdentityDraft[K],
  ) => void;
  /** Server-reported stage view (null until first load). */
  serverView: IdentityStageView | null;
  loading: boolean;
  /** Load the stored stage into the draft. Safe to call repeatedly. */
  load: () => Promise<void>;
  /** Persist the whole Identity stage. Throws the backend error verbatim. */
  save: () => Promise<void>;
};

const IdentityDraftContext = createContext<IdentityDraftContextValue | null>(
  null,
);

export function IdentityDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<IdentityDraft>(EMPTY);
  const [serverView, setServerView] = useState<IdentityStageView | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const setField = useCallback(
    <K extends keyof IdentityDraft>(key: K, value: IdentityDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyView = useCallback((view: IdentityStageView) => {
    setServerView(view);
    // Keep anything the worker has already typed; only fill blanks from the server.
    setDraft((prev) => ({
      ...prev,
      firstName: prev.firstName || view.firstName || "",
      middleName: prev.middleName || view.middleName || "",
      lastName: prev.lastName || view.lastName || "",
      suffix: prev.suffix || view.suffix || "",
      dateOfBirth: prev.dateOfBirth || view.dateOfBirth || "",
      email: prev.email || view.email || "",
      phone: prev.phone || view.phone || "",
      address1: prev.address1 || view.address1 || "",
      address2: prev.address2 || view.address2 || "",
      city: prev.city || view.city || "",
      state: prev.state || view.state || "",
      zip: prev.zip || view.zip || "",
    }));
  }, []);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      applyView(await getIdentity());
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [applyView, loaded]);

  const save = useCallback(async () => {
    const payload: SaveIdentityInput = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      dateOfBirth: draft.dateOfBirth.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      address1: draft.address1.trim(),
      city: draft.city.trim(),
      state: draft.state.trim(),
      zip: draft.zip.trim(),
      ssn: draft.ssn.trim(),
    };
    const middleName = draft.middleName.trim();
    if (middleName) payload.middleName = middleName;
    const suffix = draft.suffix.trim();
    if (suffix) payload.suffix = suffix;
    const address2 = draft.address2.trim();
    if (address2) payload.address2 = address2;

    const view = await saveIdentity(payload);
    setServerView(view);
  }, [draft]);

  const value = useMemo(
    () => ({ draft, setField, serverView, loading, load, save }),
    [draft, setField, serverView, loading, load, save],
  );

  return (
    <IdentityDraftContext.Provider value={value}>
      {children}
    </IdentityDraftContext.Provider>
  );
}

export function useIdentityDraft(): IdentityDraftContextValue {
  const ctx = useContext(IdentityDraftContext);
  if (!ctx) {
    throw new Error("useIdentityDraft must be used inside IdentityDraftProvider");
  }
  return ctx;
}

/**
 * Load the stored Identity stage once when a screen mounts.
 *
 * A failed prefill is returned as `loadError` rather than absorbed: an empty form after a
 * dead session looks like a stage the worker never filled in, and saving it would replace
 * real answers with blanks.
 */
export function useLoadIdentity(): IdentityDraftContextValue & { loadError: unknown } {
  const ctx = useIdentityDraft();
  const [loadError, setLoadError] = useState<unknown>(null);
  useEffect(() => {
    void ctx.load().catch(setLoadError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ...ctx, loadError };
}
