/**
 * MSW server + handlers for the four Phase 3 Supabase RPCs.
 *
 * These intercept the PostgREST `/rest/v1/rpc/*` HTTP calls the supabase client
 * makes. Tests that want to exercise the real HTTP/serialization layer import
 * `server` + `setupMswLifecycle()`. Most hook tests instead mock the
 * `lib/supabase` module directly (the profileStats.test.ts pattern) because it
 * is lighter and asserts the exact rpc() arguments — each test file documents
 * which approach it uses. Both are supported here.
 *
 * The `get_location_detail` handler mirrors the RPC: it echoes a `distance_m`
 * only when the request body carries `user_lat`/`user_lng`, and null otherwise.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/native';
import {
  bboxRows,
  nearbyRows,
  detailRowWithDistance,
  detailRowWithoutDistance,
} from './fixtures/locations';

const RPC = '*/rest/v1/rpc';

export const handlers = [
  http.post(`${RPC}/search_locations_bbox`, () => HttpResponse.json(bboxRows)),

  http.post(`${RPC}/search_locations_nearby`, () => HttpResponse.json(nearbyRows)),

  http.post(`${RPC}/get_location_detail`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      user_lat?: number | null;
      user_lng?: number | null;
    };
    const hasCoords =
      body?.user_lat !== undefined &&
      body?.user_lat !== null &&
      body?.user_lng !== undefined &&
      body?.user_lng !== null;
    // The RPC returns a one-element set.
    return HttpResponse.json([
      hasCoords ? detailRowWithDistance : detailRowWithoutDistance,
    ]);
  }),

  http.post(`${RPC}/update_profile`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);

/**
 * Wires MSW into a test file's lifecycle: listen before all, reset handlers
 * after each test, close after all. Call once at the top of a describe file.
 */
export function setupMswLifecycle(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
