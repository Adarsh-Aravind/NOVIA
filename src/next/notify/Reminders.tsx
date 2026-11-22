import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTodos } from '../../hooks/useTodos';
import { useMilestones } from '../../hooks/useMilestones';
import { usePeriods } from '../../hooks/usePeriods';
import { useComplaints } from '../../hooks/useComplaints';
import { elapsedAt, formatElapsed, nextOccurrence } from '../../utils/milestoneMath';
import { withLock } from '../../utils/asyncLock';
import { CH, cancelNext, configureNext, notify, remindersEnabled } from './notify';

const T = Notifications.SchedulableTriggerInputTypes;

/**
 * Schedules NOVIA Next's reminders from the shared data, the same way the
 * current app does (each phone schedules from the same lists, so both get
 * reminded), but only when the "Get reminders from NOVIA Next" switch is on.
 * Renders nothing.
 */
export function Reminders({ coupleId, me, partnerName, version }: { coupleId: string; me: string; partnerName: string; version: number }) {
  const [on, setOn] = useState(false);
  const { todos } = useTodos(coupleId, me);
  const { milestones } = useMilestones(coupleId, me);
  const { predictions } = usePeriods(coupleId);
  const { complaints } = useComplaints(coupleId, me);

  useEffect(() => {
    remindersEnabled().then(async (v) => {
      setOn(v);
      if (v) await configureNext();
    });
  }, [version]);

  // Plans
  useEffect(() => {
    if (!on) return;
    withLock('next-plans', async () => {
      await cancelNext('plan:');
      await Promise.all(
        todos
          .filter((t) => !t.is_completed)
          .map((t) => {
            const due = new Date(t.due_at);
            if (isNaN(due.getTime())) return null;
            const hour = due.getHours();
            const minute = due.getMinutes();
            let trigger: any;
            let when = '';
            if (t.recurrence === 'weekly') {
              trigger = { type: T.WEEKLY, weekday: due.getDay() + 1, hour, minute };
              when = 'Every week';
            } else if (t.recurrence === 'monthly') {
              trigger = { type: T.MONTHLY, day: due.getDate(), hour, minute };
              when = 'Every month';
            } else if (t.recurrence === 'yearly') {
              trigger = { type: T.YEARLY, month: due.getMonth() + 1, day: due.getDate(), hour, minute };
              when = 'Every year';
            } else {
              if (due.getTime() <= Date.now()) return null;
              trigger = due;
            }
            const body = t.notes?.trim() || (when ? `${when} · from your shared plans` : 'From your shared plans');
            return notify({ channel: CH.plans, title: t.title.trim(), body, trigger, key: `plan:${t.id}`, data: { kind: 'todo' } });
          })
      );
    });
  }, [on, todos]);

  // Dates: the day itself, and a heads-up the day before (not for monthly ones).
  useEffect(() => {
    if (!on) return;
    withLock('next-dates', async () => {
      await cancelNext('date:');
      const now = new Date();
      await Promise.all(
        milestones.flatMap((m) => {
          const next = nextOccurrence(m, now);
          if (!next) return [];
          const name = m.emoji ? `${m.emoji} ${m.title}` : m.title;
          const elapsed = formatElapsed(elapsedAt(m, next).count, elapsedAt(m, next).unit);
          const jobs: Promise<unknown>[] = [];
          const at9 = (d: Date) => {
            const x = new Date(d);
            x.setHours(9, 0, 0, 0);
            return x;
          };
          const dayTrigger =
            m.recurrence === 'yearly'
              ? { type: T.YEARLY, month: next.getMonth() + 1, day: next.getDate(), hour: 9, minute: 0 }
              : m.recurrence === 'monthly'
                ? { type: T.MONTHLY, day: next.getDate(), hour: 9, minute: 0 }
                : at9(next).getTime() > Date.now()
                  ? at9(next)
                  : null;
          if (dayTrigger) {
            jobs.push(
              notify({
                channel: CH.dates,
                title: name,
                body: elapsed ? `${elapsed} today` : 'Today',
                trigger: dayTrigger as any,
                key: `date:${m.id}:day`,
              })
            );
          }
          if (m.recurrence !== 'monthly') {
            const eve = new Date(next);
            eve.setDate(eve.getDate() - 1);
            const eveTrigger =
              m.recurrence === 'yearly'
                ? { type: T.YEARLY, month: eve.getMonth() + 1, day: eve.getDate(), hour: 9, minute: 0 }
                : at9(eve).getTime() > Date.now()
                  ? at9(eve)
                  : null;
            if (eveTrigger) {
              jobs.push(
                notify({
                  channel: CH.dates,
                  title: `${m.title} is tomorrow`,
                  body: elapsed ? `${elapsed}. A little time to plan something.` : 'A little time to plan something.',
                  trigger: eveTrigger as any,
                  key: `date:${m.id}:eve`,
                })
              );
            }
          }
          return jobs;
        })
      );
    });
  }, [on, milestones]);

  // Cycle: the morning before, or that morning if the day before has passed.
  useEffect(() => {
    if (!on) return;
    withLock('next-care', async () => {
      await cancelNext('care:');
      if (!predictions) return;
      const start = new Date(predictions.nextPeriodStart);
      start.setHours(9, 0, 0, 0);
      const eve = new Date(start);
      eve.setDate(eve.getDate() - 1);
      const target = eve.getTime() > Date.now() ? eve : start.getTime() > Date.now() ? start : null;
      if (!target) return;
      const isEve = target === eve;
      await notify({
        channel: CH.care,
        title: isEve ? 'Period likely tomorrow' : 'Period likely starts today',
        body: isEve ? 'A little extra care goes a long way.' : 'Be ready with warmth and comfort.',
        trigger: target,
        key: 'care:next',
      });
    });
  }, [on, predictions]);

  // A repair your partner starts, while the app is in the background.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seen.current === null) {
      if (complaints.length) seen.current = new Set(complaints.map((c) => c.id));
      return;
    }
    for (const c of complaints) {
      if (seen.current.has(c.id)) continue;
      seen.current.add(c.id);
      if (on && c.created_by !== me && AppState.currentState !== 'active') {
        notify({ channel: CH.partner, title: `${partnerName} started a repair`, body: c.title, trigger: null, key: `repair:${c.id}` });
      }
    }
  }, [complaints, on, me, partnerName]);

  return null;
}
