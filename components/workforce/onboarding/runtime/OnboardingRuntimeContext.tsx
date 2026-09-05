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
 *
 * The container also holds the LEAVE GUARD seam. A module that keeps unsaved state of its own -
 * one whose values are committed by an explicit act rather than by the draft cycle above - may
 * register a guard, and navigation consults it before a transition. The runtime learns nothing
 * about that state by doing so: see the contract below.
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
import {
  completeOnboardingModule,
  onOnboardingWrite,
} from "@/lib/workforce/onboardingApi";
import {
  getOnboardingPacket,
  getOnboardingRuntime,
  getRuntimeModuleDraft,
  saveRuntimeModuleDraft,
  type OnboardingRuntime,
  type OnboardingRuntimeModule,
  type OnboardingRuntimePacket,
} from "@/lib/workforce/onboardingRuntimeApi";
import { getWorkerPortalIdentity } from "@/lib/workforce/workerPortalApi";

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

/**
 * What a module answers when the worker tries to leave it.
 *
 * LEAVE is indistinguishable from having registered nothing. BLOCK hands the module the
 * continuation and the decision with it.
 */
export type OnboardingLeaveDecision = "LEAVE" | "BLOCK";

/**
 * A module's leave guard.
 *
 * The runtime knows only that one is registered. It does not know what makes the module
 * unsaved, what saving it would mean, whether it validates, or whether it completes - all of
 * which belong to the module and none of which can be inferred from this signature. A guard
 * that blocks keeps `proceed` and performs it later, or does not, as the WORKER decides.
 */
export type OnboardingLeaveGuard = (request: {
  /** Perform the transition the worker asked for. The guard is not consulted again. */
  proceed: () => void;
}) => OnboardingLeaveDecision;

/**
 * What a module states about its own completion.
 *
 * There is no longer an option asking to be kept on the module afterwards. Staying is what
 * completion now does for every module, so an option selecting between two behaviours would
 * select between one.
 */
export type OnboardingCompleteOptions = {
  /** Records that a re-presented record needed no change. It writes nothing. */
  confirmNoChange?: boolean;
};

type RuntimeContextValue = {
  runtime: OnboardingRuntime | null;
  loading: boolean;
  /** A failure loading the projection itself. */
  error: unknown;
  reload: () => Promise<void>;

  /**
   * Whose onboarding this is, as the certified worker portal projects it.
   *
   * READ FROM THE SESSION, NEVER FROM THE URL. It is resolved server-side from the
   * candidate the worker's own session is bound to, so a typed or shared link cannot make
   * one worker's screen carry another worker's name. Null is the only fallback: a name that
   * could not be read is shown as no name at all, because guessing one is the single
   * failure this display must never have.
   */
  workerDisplayName: string | null;

  /**
   * True when a worker write has succeeded since the projection was last read from the
   * server, so what is cached may no longer be what onboarding says.
   *
   * It is a statement about the CACHE and never about completion. Nothing acts on it except
   * by re-reading, which is what keeps the server the only authority for status and progress.
   */
  stale: boolean;
  /** Re-read ONE packet from the server and put its answer in place of the cached one. */
  refreshPacket: (invocationId: string) => Promise<void>;
  /** Re-read one packet only if a write has made the cache stale. Safe to call on render. */
  refreshPacketIfStale: (invocationId: string) => Promise<void>;

  draft: DraftState | null;
  /** Load a module's captured input. Safe to call repeatedly for the same module. */
  openModule: (invocationId: string, moduleSlug: string) => Promise<void>;
  setValue: (key: string, value: unknown) => void;
  saveDraft: () => Promise<void>;
  completeModule: (options?: OnboardingCompleteOptions) => Promise<void>;

  /**
   * Register the open module's leave guard. Returns the disposer, for effect cleanup.
   *
   * Referentially stable, so a module registers once for the life of its component and its
   * guard reads whatever it needs from its own refs rather than being re-registered.
   */
  registerLeaveGuard: (guard: OnboardingLeaveGuard) => () => void;
  /**
   * True while a guard is registered.
   *
   * Exists so a navigation affordance can stay exactly as it is when no module has anything
   * to protect, rather than routing every ordinary transition through a guard path.
   */
  leaveGuardActive: boolean;
  /**
   * Ask to leave. With no guard, `proceed` runs synchronously and nothing else happens,
   * which is what keeps every existing navigation path behaving as it did.
   */
  requestLeave: (proceed: () => void) => void;

  /** Lookups over the projection. They read; they never derive a new answer. */
  findPacket: (invocationId: string) => OnboardingRuntimePacket | null;
  findModule: (
    invocationId: string,
    moduleSlug: string,
  ) => OnboardingRuntimeModule | null;
};

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

/**
 * The projection with ONE packet replaced by the server's fresher answer.
 *
 * A packet not already in the projection is not added: the worker's packet SET is the
 * server's answer to a different question, and quietly growing it here would let a single
 * packet read change what onboarding says he holds. The cross-packet resume target is
 * re-stated only when it pointed into the packet that was re-read, for the same reason -
 * it is the refreshed packet's own answer, not a new one computed here.
 */
function withPacket(
  runtime: OnboardingRuntime,
  packet: OnboardingRuntimePacket,
): OnboardingRuntime {
  if (!runtime.packets.some((held) => held.invocationId === packet.invocationId)) {
    return runtime;
  }
  return {
    ...runtime,
    packets: runtime.packets.map((held) =>
      held.invocationId === packet.invocationId ? packet : held,
    ),
    resume:
      runtime.resume?.invocationId === packet.invocationId
        ? packet.resume
        : runtime.resume,
  };
}

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

  /* --------------------------------------------------------- worker identity */

  /**
   * WHOSE onboarding is open, read once for the whole runtime.
   *
   * It is read HERE rather than in each header so the certified identity projection is
   * asked once per session and every worker-facing shell shows the same answer. The
   * projection is `GET /workforce/portal`, which resolves the candidate from the worker's
   * bound session; nothing on this client tells it who to answer about, which is what makes
   * a fabricated URL unable to relabel the page.
   *
   * A FAILURE LEAVES IT NULL AND SAYS NOTHING. The name is a courtesy on a page whose
   * authority is the projection above it, so a read that failed must not blank the screen,
   * must not retry the worker into a loop, and must never fall back to an identity supplied
   * by the browser.
   */
  const [workerDisplayName, setWorkerDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getWorkerPortalIdentity()
      .then((identity) => {
        if (live) setWorkerDisplayName(identity.displayName);
      })
      .catch(() => {
        if (live) setWorkerDisplayName(null);
      });
    return () => {
      live = false;
    };
  }, []);

  /* ------------------------------------------------- staleness and refresh */

  /**
   * WHY THE CACHE IS INVALIDATED BY A COUNTER AND NOT A BOOLEAN.
   *
   * A refresh that finished would clear a flag a write raised WHILE it was in flight, and the
   * projection would then be quietly one write behind with nothing left to say so. Counting
   * instead means a refresh only ever declares itself current as of the write it observed
   * when it started, and a later write leaves the cache stale until something re-reads it.
   */
  const writeSeq = useRef(0);
  const [written, setWritten] = useState(0);
  const [synced, setSynced] = useState(0);
  const stale = written > synced;

  useEffect(
    () =>
      onOnboardingWrite(() => {
        writeSeq.current += 1;
        setWritten(writeSeq.current);
      }),
    [],
  );

  /** Packet reads already running, so a refresh is not requested twice over one write. */
  const refreshing = useRef(new Map<string, Promise<void>>());

  /**
   * Re-read ONE packet and put the server's answer in place of the cached one.
   *
   * PACKET-SCOPED ON PURPOSE. Completing a module changes that module's status, its packet's
   * progress, its next module and its resume target - all of which live inside one packet. A
   * whole-runtime read would re-derive every packet the worker has ever held to learn the
   * same thing, which on a worker with a long onboarding history is the cost QA-L5-UX-8
   * measured.
   *
   * The SERVER still decides all of it. This replaces a cached answer with a fresher one
   * from the same authority; it patches nothing locally and computes no status or progress.
   */
  const refreshPacket = useCallback(async (invocationId: string) => {
    const already = refreshing.current.get(invocationId);
    if (already) return already;

    const observed = writeSeq.current;
    const run = (async () => {
      try {
        const packet = await getOnboardingPacket(invocationId);
        if (!packet) return;
        setRuntime((current) => (current ? withPacket(current, packet) : current));
        // Current as of the write this read observed, and no further. Anything written since
        // leaves the projection stale, which is exactly what the counter is for.
        setSynced((previous) => Math.max(previous, observed));
      } catch {
        // The previous projection is kept and the cache stays stale, so the next thing that
        // asks re-reads. A transient read failure must not blank a worker's onboarding, and
        // it must not be reported as a completion that did not happen either.
      } finally {
        refreshing.current.delete(invocationId);
      }
    })();

    refreshing.current.set(invocationId, run);
    return run;
  }, []);

  const refreshPacketIfStale = useCallback(
    async (invocationId: string) => {
      if (!stale) return;
      await refreshPacket(invocationId);
    },
    [refreshPacket, stale],
  );

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
    async (options: OnboardingCompleteOptions = {}) => {
      const current = draftRef.current;
      if (!current) return;
      const invocationId = current.invocationId;
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
          // Stated only when the MODULE stated it.
          ...(options.confirmNoChange === undefined
            ? {}
            : { confirmNoChange: options.confirmNoChange }),
          invocationId,
        });
        // The packet is now stale in every respect - status, progress, next module, resume
        // target - so it is re-read rather than patched locally. ONE packet, because one
        // packet is what a completion recorded inside it can have changed.
        //
        // THE MODULE STAYS BUSY ACROSS IT. Releasing the controls when the completion request
        // returned would tell the worker the section was finished while the projection behind
        // the screen still said it was not, which is the window he spent pressing a button
        // that had nothing left to do.
        await refreshPacket(invocationId);
        applyDraft({
          ...(draftRef.current as DraftState),
          saving: false,
          saveError: null,
        });
        // AND HE STAYS WHERE HE IS. Completing a section is not leaving it: the refreshed
        // packet re-renders this module in its completed state, which is both the
        // confirmation that the act landed and - for a module whose completion leaves
        // required post-act content in front of him - the only place that content is. A
        // container that navigated away here could carry him past it, and could do so
        // without ever knowing it had, because whether such content exists is the module's
        // fact and not this container's.
        //
        // The workspace rail is how he moves on, and "Back to my sections" is how he
        // returns to the packet overview if that is what he wants. Both are his choice.
      } catch (err) {
        applyDraft({ ...(draftRef.current as DraftState), saving: false });
        throw err;
      }
    },
    [applyDraft, refreshPacket, saveDraft],
  );

  /**
   * The open module's leave guard.
   *
   * ONE guard, held in a ref so consulting it never depends on a render having happened, plus
   * a boolean in state so a navigation control can re-render when a module starts or stops
   * protecting itself. The runtime stores the function and calls it. It reads nothing out of
   * it and passes nothing into it but the continuation the worker asked for.
   */
  const leaveGuardRef = useRef<OnboardingLeaveGuard | null>(null);
  const [leaveGuardActive, setLeaveGuardActive] = useState(false);

  const registerLeaveGuard = useCallback((guard: OnboardingLeaveGuard) => {
    leaveGuardRef.current = guard;
    setLeaveGuardActive(true);
    return () => {
      // Identity-checked. React unmounts the outgoing module AFTER the incoming one has
      // mounted, so an unguarded cleanup would let a departing module clear the guard its
      // successor had just registered - and the successor would then be silently unprotected.
      if (leaveGuardRef.current !== guard) return;
      leaveGuardRef.current = null;
      setLeaveGuardActive(false);
    };
  }, []);

  const requestLeave = useCallback((proceed: () => void) => {
    const guard = leaveGuardRef.current;
    if (!guard) {
      proceed();
      return;
    }
    if (guard({ proceed }) === "LEAVE") proceed();
  }, []);

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
      workerDisplayName,
      stale,
      refreshPacket,
      refreshPacketIfStale,
      draft,
      openModule,
      setValue,
      saveDraft,
      completeModule,
      registerLeaveGuard,
      leaveGuardActive,
      requestLeave,
      findPacket,
      findModule,
    }),
    [
      completeModule,
      draft,
      error,
      findModule,
      findPacket,
      leaveGuardActive,
      loading,
      openModule,
      refreshPacket,
      refreshPacketIfStale,
      registerLeaveGuard,
      reload,
      requestLeave,
      runtime,
      saveDraft,
      setValue,
      stale,
      workerDisplayName,
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
