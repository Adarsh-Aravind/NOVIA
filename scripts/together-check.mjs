// Two simulated phones on the real Supabase Realtime server, each running a
// line-for-line port of TogetherProvider (src/next/hooks/useTogether.tsx):
// broadcast hello/here/away with a heartbeat and a staleness sweep, holds with
// their own heartbeat, capped nudges, and a rebuild after a close.
//
// It uses a throwaway topic, so the real couple's channel is never touched.
// It needs only the publishable key in .env and no account.
//
//   node scripts/together-check.mjs
//
// Keep it in step with useTogether.tsx. If the protocol changes there,
// change it here and run it.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

const root = process.cwd();
const require = createRequire(`${root}/package.json`);
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(
  fs.readFileSync(`${root}/.env`, 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const coupleId = `test-${randomUUID()}`;

const HOLD_BEAT_MS = 1500, HOLD_STALE_MS = 4500, HERE_BEAT_MS = 10000, HERE_STALE_MS = 25000, NUDGE_GAP_MS = 800, REJOIN_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

class Phone {
  constructor(name, userId) {
    Object.assign(this, { name, userId, active: true, holding: false, partnerHere: false, partnerHolding: false, nudges: 0, closes: 0, connected: false });
    this.sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    this.seenAt = 0;
    this.hereBeat = setInterval(() => this.active && this.joined && this.say('here'), HERE_BEAT_MS);
    this.partnerHoldAt = 0;
    this.lastNudgeSent = 0;
    this.gen = 0;
    this.build();
  }
  build() {
    const gen = ++this.gen;
    const topic = `realtime:together:${coupleId}`;
    const stale = this.sb.getChannels().filter((c) => c.topic === topic);
    this.ready = Promise.all(stale.map((c) => this.sb.removeChannel(c).catch(() => {}))).then(
      () =>
        new Promise((resolve) => {
          if (gen !== this.gen) return resolve();
          const ch = this.sb.channel(`together:${coupleId}`, { config: { broadcast: { self: false } } });
          this.ch = ch;
          const seen = () => { this.seenAt = Date.now(); this.partnerHere = true; };
          const gone = () => { this.seenAt = 0; this.partnerHoldAt = 0; this.partnerHere = false; this.partnerHolding = false; };
          this.gone = gone;
          ch.on('broadcast', { event: 'hello' }, () => { seen(); if (this.active) this.say('here'); });
          ch.on('broadcast', { event: 'here' }, seen);
          ch.on('broadcast', { event: 'away' }, gone);
          ch.on('broadcast', { event: 'hold' }, ({ payload }) => { seen(); this.partnerHoldAt = payload?.on ? Date.now() : 0; this.partnerHolding = !!payload?.on; });
          ch.on('broadcast', { event: 'nudge' }, () => { seen(); this.nudges++; });
          ch.on('system', {}, (m) => { if (m?.status === 'error') errors.push(`${this.name}: ${m.message}`); });
          ch.subscribe((status) => {
            if (gen !== this.gen) return;
            if (status === 'SUBSCRIBED') {
              this.joined = true; this.connected = true;
              if (this.active) this.say('hello');
              if (this.holding) this.sendHold(true);
              resolve();
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              this.joined = false; this.connected = false; this.closes++;
              setTimeout(() => gen === this.gen && !this.dead && this.build(), REJOIN_MS);
            }
          });
          clearInterval(this.sweep);
          this.sweep = setInterval(() => {
            if (this.partnerHoldAt && Date.now() - this.partnerHoldAt > HOLD_STALE_MS) { this.partnerHoldAt = 0; this.partnerHolding = false; }
            if (this.seenAt && Date.now() - this.seenAt > HERE_STALE_MS) this.gone();
          }, 500);
        })
    );
  }
  say(event) { this.ch?.send({ type: 'broadcast', event, payload: { from: this.userId } }).catch(() => {}); }
  sendHold(on) { this.ch?.send({ type: 'broadcast', event: 'hold', payload: { from: this.userId, on } }).catch(() => {}); }
  setHolding(on) {
    if (this.holding === on) return;
    this.holding = on;
    clearInterval(this.beat); this.beat = null;
    this.sendHold(on);
    if (on) this.beat = setInterval(() => this.sendHold(true), HOLD_BEAT_MS);
  }
  appState(active) {
    if (active === this.active) return;
    this.active = active;
    if (active) this.say('hello');
    else { this.setHolding(false); this.say('away'); }
  }
  nudge() {
    if (Date.now() - this.lastNudgeSent < NUDGE_GAP_MS) return;
    this.lastNudgeSent = Date.now();
    this.ch?.send({ type: 'broadcast', event: 'nudge', payload: { from: this.userId } }).catch(() => {});
  }
  /** The phone loses power mid-whatever: no goodbye of any kind. */
  die() { this.dead = true; clearInterval(this.beat); clearInterval(this.hereBeat); this.sb.realtime.disconnect(); }
  close() { this.dead = true; clearInterval(this.beat); clearInterval(this.sweep); clearInterval(this.hereBeat); return this.sb.removeAllChannels(); }
}

let failed = 0;
async function until(cond, label, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) { console.log(`  PASS  ${label}  (${Date.now() - t0} ms)`); return; }
    await sleep(15);
  }
  failed++; console.log(`  FAIL  ${label}  (not true after ${ms} ms)`);
  console.log('        A: here', A.partnerHere, 'holding', A.partnerHolding, '| B: active', B.active, 'joined', B.joined);
}
function check(cond, label) { if (cond) console.log(`  PASS  ${label}`); else { failed++; console.log(`  FAIL  ${label}`); } }

const A = new Phone('You', 'user-a');
const B = new Phone('Partner', 'user-b');
await Promise.all([A.ready, B.ready]);
console.log(`Two phones on together:${coupleId}\n`);

console.log('Presence');
await until(() => A.partnerHere && B.partnerHere, 'each phone sees the other as here');

console.log('\nHold');
B.setHolding(true);
await until(() => A.partnerHolding, 'partner holds: you see it');
A.setHolding(true);
await until(() => A.partnerHolding && B.partnerHolding, 'you hold too: both see both (lights merge)');
await sleep(6000);
check(A.partnerHolding && B.partnerHolding, 'a 6-second hold stays merged (the heartbeat keeps it alive)');
B.setHolding(false);
await until(() => !A.partnerHolding, 'partner lets go: merge ends on your side');
A.setHolding(false);
await until(() => !B.partnerHolding, 'you let go: clears on theirs');

console.log('\nAbuse: frantic press and release');
for (let i = 0; i < 20; i++) { B.setHolding(i % 2 === 0); await sleep(50); }
B.setHolding(false);
await sleep(1500);
check(B.closes === 0 && A.closes === 0, 'twenty presses in a second: no channel closed by the server');
check(!A.partnerHolding, 'ends on the right state: not holding');

console.log('\nAbuse: flipping in and out of the app');
for (let i = 0; i < 8; i++) { B.appState(i % 2 === 1); await sleep(60); }
B.appState(true);
await sleep(3000);
check(B.closes === 0, 'eight background/foreground flips: no channel closed');
await until(() => A.partnerHere, 'settles on the latest state: here');

console.log('\nBackground mid-hold');
B.setHolding(true);
await until(() => A.partnerHolding, 'partner holding');
B.appState(false);
await until(() => !A.partnerHolding, 'partner presses Home: their hold clears for you right away', 3000);
await until(() => !A.partnerHere, 'and they show as away', 1500);
B.appState(true);
await until(() => A.partnerHere && !A.partnerHolding, 'back in the app: here, not holding');

console.log('\nNudges');
let n0 = A.nudges;
B.nudge();
await until(() => A.nudges === n0 + 1, 'partner taps your light: arrives once');
await sleep(900);
n0 = A.nudges;
for (let i = 0; i < 10; i++) { B.nudge(); await sleep(100); }
await sleep(800);
check(A.nudges - n0 <= 2, `ten taps in a second arrive as ${A.nudges - n0} (capped, not ten buzzes)`);
await sleep(900);
const b0 = B.nudges;
A.nudge();
await until(() => B.nudges === b0 + 1, 'you tap theirs: arrives once');

console.log('\nForced reconnect');
B.ch.unsubscribe(); // the server dropping the channel looks like this to the client
await until(() => B.closes > 0, 'partner channel closed', 4000);
await until(() => B.connected, 'it rebuilds itself', 8000);
await until(() => A.partnerHere, 'you see them here again', 6000);
await sleep(900);
const a1 = A.nudges;
B.nudge();
await until(() => A.nudges === a1 + 1, 'nudges work after the rebuild');

console.log('\nPhone dies mid-hold');
B.setHolding(true);
await until(() => A.partnerHolding, 'partner holding');
B.die();
await until(() => !A.partnerHolding, 'their phone dies: the hold clears by itself (no stuck hold)', HOLD_STALE_MS + 2000);
await until(() => !A.partnerHere, 'and they show as away after 25 s of silence', HERE_STALE_MS + 3000);

check(errors.length === 0, errors.length ? `server errors: ${errors.join(' | ')}` : 'no server errors at any point');
await A.close();
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
setTimeout(() => process.exit(failed ? 1 : 0), 300);
