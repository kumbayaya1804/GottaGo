import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

/** The five data-dependent filter chips (D-05..D-08). */
export type FilterKey =
  | 'openNow'
  | 'chillSpot'
  | 'wheelchair'
  | 'changing'
  | 'highConf';

/** snake_case filter params consumed by the bbox / nearby RPCs. */
export interface ActiveRpcFilters {
  filter_open_now: boolean;
  filter_chill_spot: boolean;
  filter_wheelchair: boolean;
  filter_changing: boolean;
  filter_high_conf: boolean;
}

/** The boolean flags portion of the store, all default false (D-05). */
export const EMPTY_FILTERS: Record<FilterKey, boolean> = {
  openNow: false,
  chillSpot: false,
  wheelchair: false,
  changing: false,
  highConf: false,
};

export interface FiltersState extends Record<FilterKey, boolean> {
  /** Per-process token used to detect cold starts (see mergePersistedFilters). */
  _sessionId: string;
  /** Flip a single filter chip. */
  toggle: (key: FilterKey) => void;
  /** Reset every filter to inactive. */
  clearAll: () => void;
  /** The snake_case params the RPCs expect. AND logic is applied server-side. */
  activeRpcFilters: () => ActiveRpcFilters;
}

/** MMKV key under which the persisted filter slice is stored. */
export const FILTERS_STORAGE_KEY = 'gotta-go-filters';

/**
 * A per-process token. Generated once at module load, so every fresh JS runtime
 * (cold start) gets a new value that will NOT match a token persisted by a prior
 * process — which is how `mergePersistedFilters` distinguishes a cold start
 * (reset, D-05) from within-session navigation (preserve, D-06).
 */
export const PROCESS_SESSION_ID = `${Date.now()}-${Math.random()}`;

const mmkv = createMMKV();

/** zustand StateStorage backed by MMKV (synchronous). */
export const mmkvFilterStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => mmkv.remove(name),
};

/** The slice we persist: the five flags plus the process token. */
type PersistedFilters = Record<FilterKey, boolean> & { _sessionId: string };

/**
 * Merges the persisted filter slice into the freshly-created store state.
 * Preserves persisted filters only when the persisted process token matches the
 * current process (same session → D-06). On a mismatch or when nothing was
 * persisted (cold start / first launch → D-05) it seeds empty filters and
 * stamps the current process token.
 */
export function mergePersistedFilters(
  persisted: PersistedFilters | undefined,
  current: FiltersState,
  processId: string,
): FiltersState {
  if (!persisted || persisted._sessionId !== processId) {
    return { ...current, ...EMPTY_FILTERS, _sessionId: processId };
  }
  return {
    ...current,
    openNow: persisted.openNow,
    chillSpot: persisted.chillSpot,
    wheelchair: persisted.wheelchair,
    changing: persisted.changing,
    highConf: persisted.highConf,
    _sessionId: processId,
  };
}

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set, get) => ({
      ...EMPTY_FILTERS,
      _sessionId: PROCESS_SESSION_ID,
      toggle: (key) => set((state) => ({ [key]: !state[key] })),
      clearAll: () => set({ ...EMPTY_FILTERS }),
      activeRpcFilters: () => {
        const s = get();
        return {
          filter_open_now: s.openNow,
          filter_chill_spot: s.chillSpot,
          filter_wheelchair: s.wheelchair,
          filter_changing: s.changing,
          filter_high_conf: s.highConf,
        };
      },
    }),
    {
      name: FILTERS_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvFilterStorage),
      partialize: (state) => ({
        openNow: state.openNow,
        chillSpot: state.chillSpot,
        wheelchair: state.wheelchair,
        changing: state.changing,
        highConf: state.highConf,
        _sessionId: state._sessionId,
      }),
      merge: (persisted, current) =>
        mergePersistedFilters(
          persisted as PersistedFilters | undefined,
          current,
          PROCESS_SESSION_ID,
        ),
    },
  ),
);
