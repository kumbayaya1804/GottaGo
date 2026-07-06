// The react-native-mmkv mock (jest.setup.ts) is backed by a shared in-memory
// Map, so the persist middleware writes/reads through it. Store state is reset
// to defaults before each test for isolation.
import { createMMKV } from 'react-native-mmkv';
import {
  useFiltersStore,
  mmkvFilterStorage,
  mergePersistedFilters,
  EMPTY_FILTERS,
  FILTERS_STORAGE_KEY,
} from '../useFiltersStore';

beforeEach(() => {
  useFiltersStore.getState().clearAll();
});

describe('useFiltersStore defaults', () => {
  it('starts with no filter active (D-05)', () => {
    const s = useFiltersStore.getState();
    expect(s.openNow).toBe(false);
    expect(s.chillSpot).toBe(false);
    expect(s.wheelchair).toBe(false);
    expect(s.changing).toBe(false);
    expect(s.highConf).toBe(false);
  });
});

describe('toggle', () => {
  it('flips a single filter on and off', () => {
    useFiltersStore.getState().toggle('wheelchair');
    expect(useFiltersStore.getState().wheelchair).toBe(true);
    useFiltersStore.getState().toggle('wheelchair');
    expect(useFiltersStore.getState().wheelchair).toBe(false);
  });

  it('lets multiple filters coexist (AND semantics reported)', () => {
    useFiltersStore.getState().toggle('openNow');
    useFiltersStore.getState().toggle('chillSpot');
    const s = useFiltersStore.getState();
    expect(s.openNow).toBe(true);
    expect(s.chillSpot).toBe(true);
    expect(s.wheelchair).toBe(false);
  });
});

describe('clearAll', () => {
  it('resets every filter to false', () => {
    const s = useFiltersStore.getState();
    s.toggle('openNow');
    s.toggle('highConf');
    useFiltersStore.getState().clearAll();
    const after = useFiltersStore.getState();
    expect(after.openNow).toBe(false);
    expect(after.highConf).toBe(false);
  });
});

describe('activeRpcFilters', () => {
  it('returns the snake_case RPC filter param object', () => {
    useFiltersStore.getState().toggle('openNow');
    useFiltersStore.getState().toggle('wheelchair');
    expect(useFiltersStore.getState().activeRpcFilters()).toEqual({
      filter_open_now: true,
      filter_chill_spot: false,
      filter_wheelchair: true,
      filter_changing: false,
      filter_high_conf: false,
    });
  });
});

describe('persistence within a session', () => {
  it('writes the current filters through MMKV', () => {
    useFiltersStore.getState().toggle('changing');
    const raw = createMMKV().getString(FILTERS_STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(raw as string).toContain('"changing":true');
  });
});

describe('mergePersistedFilters (cold-start vs within-session)', () => {
  const current = {
    ...EMPTY_FILTERS,
    _sessionId: 'process-A',
  } as never;

  it('preserves persisted filters when the session token matches (D-06)', () => {
    const persisted = {
      openNow: true,
      chillSpot: false,
      wheelchair: true,
      changing: false,
      highConf: false,
      _sessionId: 'process-A',
    };
    const merged = mergePersistedFilters(persisted as never, current, 'process-A');
    expect(merged.openNow).toBe(true);
    expect(merged.wheelchair).toBe(true);
  });

  it('discards persisted filters on a cold start — different session token (D-05)', () => {
    const persisted = {
      openNow: true,
      chillSpot: true,
      wheelchair: true,
      changing: true,
      highConf: true,
      _sessionId: 'process-OLD',
    };
    const merged = mergePersistedFilters(persisted as never, current, 'process-A');
    expect(merged.openNow).toBe(false);
    expect(merged.chillSpot).toBe(false);
    expect(merged.wheelchair).toBe(false);
    expect(merged.changing).toBe(false);
    expect(merged.highConf).toBe(false);
    expect(merged._sessionId).toBe('process-A');
  });

  it('seeds empty filters on first-ever launch — no persisted state', () => {
    const merged = mergePersistedFilters(undefined as never, current, 'process-A');
    expect(merged.openNow).toBe(false);
    expect(merged._sessionId).toBe('process-A');
  });
});

describe('mmkvFilterStorage adapter', () => {
  it('sets, gets, and removes items through MMKV', () => {
    mmkvFilterStorage.setItem('probe-key', 'probe-value');
    expect(mmkvFilterStorage.getItem('probe-key')).toBe('probe-value');
    mmkvFilterStorage.removeItem('probe-key');
    expect(mmkvFilterStorage.getItem('probe-key')).toBeNull();
  });
});
