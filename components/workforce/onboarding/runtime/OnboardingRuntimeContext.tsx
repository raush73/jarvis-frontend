"use client";

/**
 * Phase 1 - the runtime state container.
 *
 * ONE container holds the projection, the current module's draft, and in-flight save state.
 *
 * The governing rule is that SERVER STATE IS AUTHORITATIVE and local state is a cache that
 * is invalidated on every server response. The runtime therefore never computes progress,
 * never decides which module comes next, and never remembers a position: it re-reads the
 * projection whenever the server has said something new, and renders whatever came back.
 *
 * Draft handling has three properties the error contract depends on:
 *
 *  - Saves are explicit AND debounced, so a worker who types and leaves does not lose the
 *    last few seconds of work.
 *  - A failed save is never silently discarded. The entered answers stay in state, marked
 *    unsaved, with the failure surfaced and a retry available. Nothing clears a draft
 *    except a successful save.
 *  - Saves are SERIALIZED through one queue. Awaiting a save therefore means the newest
 *    answers have reached the server, not merely that some earlier save was already in
 *    flight - which is what lets completion be validated against what the worker actually
 *    typed rather than against whatever the last request happened to carry.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { completeOnboardingModule } from "@/lib/workforce/onboardingApi";
import {
  getOnboardingRuntime,
  getRuntimeModuleDraft,
  saveRuntimeModuleDraft,
  type OnboardingRuntime,
  type OnboardingRuntimeModule,
  type OnboardingRuntimePacket,
} from "@/lib/workforce/onboardingRuntimeApi";

/** How long after the last keystroke an unsaved draft is persisted. */
const DRAFT_DEBOUNCE_MS = 1200;

type DraftState = {
  invocationId: string;
  moduleSlug: string;
  moduleKey: string;
  data: Record<string, unknown>;
  /** True when local answers have not yet reached the server. */
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  /** Sticky until a save succeeds. The answers behind it are still in `data`. */
  saveError: unknown;
  updatedAt: string | null;
};

type RuntimeContextValue = {
  runtime: OnboardingRuntime | null;
  loading: boolean;
  /** A failure loading the projection itself. */
  error: unknown;
  reload: () => Promise<void>;

  draft: DraftState | null;
  /** Load a module's captured input. Safe to call repeatedly for the same module. */
  openModule: (invocationId: string, moduleSlug: string) => Promise<void>;
  setValue: (key: string, value: unknown) => void;
  saveDraft: () => Promise<void>;
  completeModule: (options?: { confirmNoChange?: boolean }) => Promise<void>;

  /** Lookups over the projection. They read; they never derive a new answer. */
  findPacket: (invocationId: string) => OnboardingRuntimePacket | null;
  findModule: (
    invocationId: string,
    moduleSlug: string,
  ) => OnboardingRuntimeModule | null;
};

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function OnboardingRuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<OnboardingRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);

  // Held in refs so the debounce timer always persists the newest answers, and so a save
  // in flight can be reconciled against what the worker typed while it was running.
  const draftRef = useRef<DraftState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The save queue. Every save - debounced, explicit, or pre-completion - joins it, so
  // there is exactly one order in which writes reach the server.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const applyDraft = useCallback(
    (next: DraftState | null) => {
      draftRef.current = next;
      setDraft(next);
    },
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getOnboardingRuntime();
      setRuntime(next);
      setError(null);
    } catch (err) {
      // The previous projection is deliberately kept. Blanking the screen on a transient
      // read failure would read as "your onboarding disappeared".
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * One save attempt, run only from the queue.
   *
   * It re-reads the draft when its turn comes rather than closing over the state at the
   * moment it was requested, so a save that waited behind another writes the newest
   * answers and a save whose work was already covered does nothing.
   */
  const persistOnce = useCallback(async () => {
    const current = draftRef.current;
    if (!current || !current.dirty) return;

    const attempted = current.data;
    applyDraft({ ...current, saving: true });
    try {
      const saved = await saveRuntimeModuleDraft(
        current.invocationId,
        current.moduleSlug,
        attempted,
      );
      const latest = draftRef.current;
      if (!latest || latest.moduleSlug !== current.moduleSlug) return;
      // Answers typed while the save was in flight stay unsaved rather than being
      // overwritten by the response, which is older than what the worker just typed.
      const changedDuringSave = latest.data !== attempted;
      applyDraft({
        ...latest,
        saving: false,
        dirty: changedDuringSave,
        saveError: null,
        updatedAt: saved.updatedAt,
      });
    } catch (err) {
      const latest = draftRef.current;
      if (!latest || latest.moduleSlug !== current.moduleSlug) return;
      // The answers stay exactly where they are. Only the failure is added.
      applyDraft({ ...latest, saving: false, dirty: true, saveError: err });
    }
  }, [applyDraft]);

  /**
   * Persist through the queue, and resolve only once this caller's turn has run.
   *
   * A caller that awaits this has a guarantee it could not have had while an in-flight
   * save caused an early return: when it resumes, everything the worker had typed when it
   * asked is either saved or has surfaced a failure.
   */
  const persist = useCallback((): Promise<void> => {
    const run = queueRef.current.then(persistOnce, persistOnce);
    // The queue itself must never hold a rejection, or one failure would poison every
    // later save. Failures travel through draft state, which is where the retry lives.
    queueRef.current = run.catch(() => undefined);
    return run;
  }, [persistOnce]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist();
    }, DRAFT_DEBOUNCE_MS);
  }, [persist]);

  // A pending debounce must not outlive the runtime, or a save fires against a module the
  // worker has already left.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const openModule = useCallback(
    async (invocationId: string, moduleSlug: string) => {
      const current = draftRef.current;
      if (
        current &&
        current.invocationId === invocationId &&
        current.moduleSlug === moduleSlug
      ) {
        // Already open. Re-reading would discard unsaved answers, which is the one thing
        // the draft contract forbids.
        return;
      }
      applyDraft({
        invocationId,
        moduleSlug,
        moduleKey: "",
        data: {},
        dirty: false,
        loading: true,
        saving: false,
        saveError: null,
        updatedAt: null,
      });
      try {
        const loaded = await getRuntimeModuleDraft(invocationId, moduleSlug);
        applyDraft({
          invocationId,
          moduleSlug,
          moduleKey: loaded.moduleKey,
          data: loaded.data ?? {},
          dirty: false,
          loading: false,
          saving: false,
          saveError: null,
          updatedAt: loaded.updatedAt,
        });
      } catch (err) {
        applyDraft({
          invocationId,
          moduleSlug,
          moduleKey: "",
          data: {},
          dirty: false,
          loading: false,
          saving: false,
          saveError: err,
          updatedAt: null,
        });
      }
    },
    [applyDraft],
  );

  const setValue = useCallback(
    (key: string, value: unknown) => {
      const current = draftRef.current;
      if (!current) return;
      applyDraft({
        ...current,
        data: { ...current.data, [key]: value },
        dirty: true,
      });
      scheduleSave();
    },
    [applyDraft, scheduleSave],
  );

  const saveDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await persist();
  }, [persist]);

  const completeModule = useCallback(
    async (options: { confirmNoChange?: boolean } = {}) => {
      const current = draftRef.current;
      if (!current) return;
      // Unsaved answers go first: completion is validated against what the SERVER holds,
      // so submitting without flushing would ask the validator about stale input.
      //
      // Unconditional, and awaited through the save queue. Testing `dirty` here would be
      // exactly the race the queue exists to remove: an autosave in flight leaves the
      // draft looking clean while the newest keystrokes have not landed, and completion
      // would then be judged on input the worker has already changed. A flush with
      // nothing to write costs a queue turn and no request.
      await saveDraft();
      const flushed = draftRef.current;
      if (flushed?.saveError) throw flushed.saveError;

      applyDraft({ ...(draftRef.current as DraftState), saving: true });
      try {
        // The Phase 0 completion endpoint, which the module's own validator governs. The
        // runtime records no completion of its own and cannot force one.
        //
        // The packet the draft was captured against is stated explicitly, so completion
        // and the answers behind it can only ever be recorded in the SAME packet: if the
        // session has since bound a different one, this is refused rather than recorded
        // against a packet these answers were never saved into.
        await completeOnboardingModule((draftRef.current as DraftState).moduleKey, {
          ...options,
          invocationId: (draftRef.current as DraftState).invocationId,
        });
        applyDraft({
          ...(draftRef.current as DraftState),
          saving: false,
          saveError: null,
        });
        // The projection is now stale in every respect - status, progress, next module,
        // resume target - so it is re-read rather than patched locally.
        await reload();
      } catch (err) {
        applyDraft({ ...(draftRef.current as DraftState), saving: false });
        throw err;
      }
    },
    [applyDraft, reload, saveDraft],
  );

  const findPacket = useCallback(
    (invocationId: string) =>
      runtime?.packets.find((packet) => packet.invocationId === invocationId) ?? null,
    [runtime],
  );

  const findModule = useCallback(
    (invocationId: string, moduleSlug: string) =>
      findPacket(invocationId)?.modules.find(
        (module) => module.moduleSlug === moduleSlug,
      ) ?? null,
    [findPacket],
  );

  const value = useMemo<RuntimeContextValue>(
    () => ({
      runtime,
      loading,
      error,
      reload,
      draft,
      openModule,
      setValue,
      saveDraft,
      completeModule,
      findPacket,
      findModule,
    }),
    [
      completeModule,
      draft,
      error,
      findModule,
      findPacket,
      loading,
      openModule,
      reload,
      runtime,
      saveDraft,
      setValue,
    ],
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useOnboardingRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error(
      "useOnboardingRuntime must be used inside an OnboardingRuntimeProvider",
    );
  }
  return value;
}
