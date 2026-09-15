import { buildSeed, DEMO_COUPLE_ID, DEMO_EMAIL, DEMO_PARTNER_ID, DEMO_USER_ID } from './seed';

/**
 * An in-memory stand-in for the Supabase client, for the demo build.
 *
 * It implements exactly the slice of supabase-js the app uses — the chained
 * query builder (select / insert / update / upsert / delete with eq, neq, gte,
 * in, order, limit, single, maybeSingle), rpc, realtime channels and auth — so
 * the hooks run unmodified against it. Nothing leaves the device and nothing is
 * persisted: every launch starts from [[seed]] again.
 *
 * Realtime is simulated by firing `postgres_changes` bindings whenever a write
 * lands, which is what keeps screens that only refetch on a change event
 * behaving like the real thing.
 */

type Row = Record<string, any>;
type Filter = { column: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is'; value: any };
type Result = { data: any; error: { message: string; code?: string } | null; count: null; status: number; statusText: string };

const tables = new Map<string, Row[]>();

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  const tail = (Date.now().toString(16) + idCounter.toString(16)).padStart(12, '0').slice(-12);
  return `d3m0${Math.random().toString(16).slice(2, 6)}-0000-4000-8000-${tail}`;
}

function withDefaults(row: Row): Row {
  const now = new Date().toISOString();
  return { id: newId(), created_at: now, updated_at: now, ...row };
}

function reset() {
  tables.clear();
  const seed = buildSeed();
  for (const [name, rows] of Object.entries(seed)) {
    tables.set(name, rows.map(withDefaults));
  }
}
reset();

function table(name: string): Row[] {
  if (!tables.has(name)) tables.set(name, []);
  return tables.get(name)!;
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compare(a: any, b: any): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ column, op, value }) => {
    const v = row[column];
    switch (op) {
      case 'eq': return v === value;
      case 'neq': return v !== value;
      case 'gt': return v != null && compare(v, value) > 0;
      case 'gte': return v != null && compare(v, value) >= 0;
      case 'lt': return v != null && compare(v, value) < 0;
      case 'lte': return v != null && compare(v, value) <= 0;
      case 'in': return Array.isArray(value) && value.includes(v);
      case 'is': return v === value;
    }
  });
}

// ---------------------------------------------------------------------------
// Realtime

type Binding = { type: string; filter: any; callback: (payload: any) => void };

const liveChannels = new Set<DemoChannel>();

class DemoChannel {
  state = 'closed';
  private bindings: Binding[] = [];

  constructor(public topic: string) {}

  on(type: string, filter: any, callback: (payload: any) => void) {
    this.bindings.push({ type, filter, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    this.state = 'joined';
    liveChannels.add(this);
    if (callback) setTimeout(() => callback('SUBSCRIBED'), 0);
    return this;
  }

  /** Broadcasts go to the partner's device, and there is no partner device here. */
  send(_message: any) {
    return Promise.resolve('ok');
  }

  unsubscribe() {
    this.state = 'closed';
    liveChannels.delete(this);
    return Promise.resolve('ok');
  }

  deliver(tableName: string, eventType: string, next: Row | null, prev: Row | null) {
    for (const b of this.bindings) {
      if (b.type !== 'postgres_changes') continue;
      if (b.filter?.table && b.filter.table !== tableName) continue;
      if (b.filter?.event && b.filter.event !== '*' && b.filter.event !== eventType) continue;
      if (typeof b.filter?.filter === 'string') {
        const [column, rest] = b.filter.filter.split('=');
        const expected = rest?.replace(/^eq\./, '');
        const row = next ?? prev;
        if (!row || String(row[column]) !== expected) continue;
      }
      const payload = { schema: 'public', table: tableName, eventType, new: clone(next) ?? {}, old: clone(prev) ?? {} };
      setTimeout(() => b.callback(payload), 0);
    }
  }
}

function emit(tableName: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', next: Row | null, prev: Row | null) {
  for (const channel of liveChannels) channel.deliver(tableName, eventType, next, prev);
}

// ---------------------------------------------------------------------------
// Query builder

class DemoQuery implements PromiseLike<Result> {
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private returning = false;
  private payload: any = null;
  private conflictKeys: string[] = [];
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private max: number | null = null;
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(private tableName: string) {}

  select(_columns?: string) {
    if (this.action === 'select') return this;
    this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.action = 'insert'; this.payload = rows; return this; }
  update(patch: Row) { this.action = 'update'; this.payload = patch; return this; }
  upsert(rows: Row | Row[], options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = rows;
    this.conflictKeys = (options?.onConflict ?? 'id').split(',').map((k) => k.trim());
    return this;
  }
  delete() { this.action = 'delete'; return this; }

  eq(column: string, value: any) { this.filters.push({ column, op: 'eq', value }); return this; }
  neq(column: string, value: any) { this.filters.push({ column, op: 'neq', value }); return this; }
  gt(column: string, value: any) { this.filters.push({ column, op: 'gt', value }); return this; }
  gte(column: string, value: any) { this.filters.push({ column, op: 'gte', value }); return this; }
  lt(column: string, value: any) { this.filters.push({ column, op: 'lt', value }); return this; }
  lte(column: string, value: any) { this.filters.push({ column, op: 'lte', value }); return this; }
  in(column: string, values: any[]) { this.filters.push({ column, op: 'in', value: values }); return this; }
  is(column: string, value: any) { this.filters.push({ column, op: 'is', value }); return this; }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(count: number) { this.max = count; return this; }
  single() { this.cardinality = 'single'; return this; }
  maybeSingle() { this.cardinality = 'maybeSingle'; return this; }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: any) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    // A short hop off the current tick, so loading states render the way they
    // do against a network.
    return new Promise<Result>((resolve) => setTimeout(() => resolve(this.run()), 60)).then(onfulfilled, onrejected);
  }

  private run(): Result {
    const rows = table(this.tableName);
    let out: Row[];

    switch (this.action) {
      case 'select':
        out = rows.filter((r) => matches(r, this.filters));
        break;

      case 'insert': {
        const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(withDefaults);
        rows.push(...incoming);
        incoming.forEach((r) => emit(this.tableName, 'INSERT', r, null));
        out = incoming;
        break;
      }

      case 'upsert': {
        out = [];
        for (const raw of Array.isArray(this.payload) ? this.payload : [this.payload]) {
          const existing = rows.find((r) => this.conflictKeys.every((k) => r[k] === raw[k]));
          if (existing) {
            const prev = { ...existing };
            Object.assign(existing, raw);
            emit(this.tableName, 'UPDATE', existing, prev);
            out.push(existing);
          } else {
            const row = withDefaults(raw);
            rows.push(row);
            emit(this.tableName, 'INSERT', row, null);
            out.push(row);
          }
        }
        break;
      }

      case 'update':
        out = rows.filter((r) => matches(r, this.filters));
        for (const row of out) {
          const prev = { ...row };
          Object.assign(row, this.payload);
          emit(this.tableName, 'UPDATE', row, prev);
        }
        break;

      case 'delete':
        out = rows.filter((r) => matches(r, this.filters));
        tables.set(this.tableName, rows.filter((r) => !out.includes(r)));
        out.forEach((r) => emit(this.tableName, 'DELETE', null, r));
        break;
    }

    // Writes return nothing unless `.select()` asked for the rows back.
    if (this.action !== 'select' && !this.returning) return ok(null);

    for (const { column, ascending } of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]));
    }
    if (this.max != null) out = out.slice(0, this.max);

    if (this.cardinality === 'many') return ok(clone(out));
    if (out.length > 1) return fail('JSON object requested, multiple (or no) rows returned', 'PGRST116');
    if (out.length === 0) {
      return this.cardinality === 'maybeSingle'
        ? ok(null)
        : fail('JSON object requested, multiple (or no) rows returned', 'PGRST116');
    }
    return ok(clone(out[0]));
  }
}

function ok(data: any): Result {
  return { data, error: null, count: null, status: 200, statusText: 'OK' };
}

function fail(message: string, code: string): Result {
  return { data: null, error: { message, code }, count: null, status: 406, statusText: 'Not Acceptable' };
}

// ---------------------------------------------------------------------------
// RPCs

function rpc(name: string, _args?: Row): Promise<Result> {
  const profiles = table('profiles');
  const setCouple = (coupleId: string | null) => {
    for (const p of profiles) {
      const prev = { ...p };
      p.couple_id = coupleId;
      p.partner_id = coupleId ? (p.id === DEMO_USER_ID ? DEMO_PARTNER_ID : DEMO_USER_ID) : null;
      emit('profiles', 'UPDATE', p, prev);
    }
  };

  return new Promise((resolve) =>
    setTimeout(() => {
      switch (name) {
        // There is only one other person in the demo, so any key pairs with Sam.
        case 'pair_with_partner':
          setCouple(DEMO_COUPLE_ID);
          return resolve(ok(null));
        case 'unpair':
          setCouple(null);
          return resolve(ok(null));
        // Payment capture is disabled in the demo, so this is never reached.
        case 'record_transaction':
          return resolve(ok(null));
        default:
          return resolve(fail(`Unknown function ${name}`, 'PGRST202'));
      }
    }, 120)
  );
}

// ---------------------------------------------------------------------------
// Auth

type AuthListener = (event: string, session: any) => void;

function makeSession() {
  return {
    access_token: 'demo',
    refresh_token: 'demo',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    user: { id: DEMO_USER_ID, email: DEMO_EMAIL, user_metadata: { display_name: 'Alex' } },
  };
}

// Signed in from the first frame, so the demo opens on the app rather than a
// login form nobody has credentials for.
let session: any = makeSession();
const authListeners = new Set<AuthListener>();

function notify(event: string) {
  for (const listener of authListeners) setTimeout(() => listener(event, session), 0);
}

const auth = {
  getSession: () => Promise.resolve({ data: { session }, error: null }),
  onAuthStateChange: (listener: AuthListener) => {
    authListeners.add(listener);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
  },
  signInWithPassword: async (_credentials: { email: string; password: string }) => {
    session = makeSession();
    notify('SIGNED_IN');
    return { data: { session, user: session.user }, error: null };
  },
  signUp: async (_credentials: any) => ({ data: { session: null, user: null }, error: null }),
  signOut: async () => {
    session = null;
    notify('SIGNED_OUT');
    return { error: null };
  },
};

export function createDemoSupabase() {
  return {
    from: (name: string) => new DemoQuery(name),
    rpc,
    channel: (topic: string, _options?: any) => new DemoChannel(topic),
    removeChannel: (channel: DemoChannel) => channel.unsubscribe(),
    auth,
  };
}
