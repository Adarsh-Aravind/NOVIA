import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, BatteryWarning } from 'lucide-react-native';

import { Card, Label, Button, Field, Empty, ui } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { useMoney } from '../hooks/useMoney';
import { directionFor } from '../../hooks/useTransactions';
import { C, F } from '../theme';

const SOURCES: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'com.paypal.android.p2pmobile': 'PayPal',
  'com.sbi.lotusintouch': 'SBI',
  'android.sms': 'Bank SMS',
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Money between you, read from bank texts and payment-app notifications on
 * this phone. Nobody types anything in. Ported from the old Payments tab:
 * setup, the battery warning, name matching and the feed grouped by day.
 */
export function Payments({ me, partnerName }: { me: string; partnerName: string }) {
  const m = useMoney();
  const [names, setNames] = useState<string | null>(null);

  const days = useMemo(() => {
    const groups: { label: string; items: typeof m.transactions }[] = [];
    for (const t of m.transactions) {
      const label = dayLabel(t.occurred_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(t);
      else groups.push({ label, items: [t] });
    }
    return groups;
  }, [m.transactions]);

  const totals = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    let sent = 0;
    let received = 0;
    for (const t of m.transactions) {
      if (new Date(t.occurred_at).getTime() < monthStart) continue;
      if (directionFor(t, me) === 'sent') sent += t.amount;
      else received += t.amount;
    }
    return { sent, received };
  }, [m.transactions, me]);

  if (!m.supported) {
    return (
      <Card>
        <Label>Money between you</Label>
        <Text style={ui.soft}>Payment detection needs the Android build with the listener module.</Text>
      </Card>
    );
  }

  const listening = m.smsGranted || m.permitted;

  return (
    <Card>
      <Label>Money between you</Label>
      {m.permissionsChecked && !listening && (
        <View style={{ gap: 8 }}>
          <Text style={ui.body}>NOVIA can spot money you send each other from your bank’s texts. Only the amount, direction, name and time are saved; the text never leaves your phone.</Text>
          <Button title="Allow payment texts" onPress={m.requestSms} />
        </View>
      )}
      {listening && !m.batteryExempt && (
        <View style={styles.warn}>
          <BatteryWarning size={18} color={C.danger} />
          <Text style={[ui.soft, { flex: 1, color: C.ink }]}>Battery saving can put NOVIA to sleep and miss payments.</Text>
          <Text
            style={styles.link}
            onPress={() => {
              try {
                require('../../../modules/notification-listener').requestIgnoreBatteryOptimizations();
              } catch {
                // Not in this build.
              }
            }}
          >
            Fix
          </Text>
        </View>
      )}
      {m.transactions.length > 0 && (
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={styles.totalK}>You sent this month</Text>
            <Text style={[styles.totalV, { color: C.me }]}>{rupees(totals.sent)}</Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalK}>{partnerName} sent you</Text>
            <Text style={[styles.totalV, { color: C.partner }]}>{rupees(totals.received)}</Text>
          </View>
        </View>
      )}
      {listening && m.transactions.length === 0 && <Empty title="No payments yet" body={`When you and ${partnerName} send each other money, it shows up here by itself.`} />}
      {days.slice(0, 12).map((g) => (
        <View key={g.label} style={{ gap: 6 }}>
          <Text style={styles.day}>{g.label}</Text>
          {g.items.map((t) => {
            const sent = directionFor(t, me) === 'sent';
            return (
              <View key={t.id} style={styles.row}>
                {sent ? <ArrowUpRight size={18} color={C.me} /> : <ArrowDownLeft size={18} color={C.partner} />}
                <View style={{ flex: 1 }}>
                  <Text style={ui.body}>{sent ? `To ${partnerName}` : `From ${partnerName}`}</Text>
                  <Text style={ui.soft}>
                    {new Date(t.occurred_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} · {SOURCES[t.source_package] ?? 'Payment app'}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: sent ? C.me : C.partner }]}>{rupees(t.amount)}</Text>
              </View>
            );
          })}
        </View>
      ))}
      {listening && (
        <Text style={styles.link} onPress={() => setNames(m.aliases.join(', '))}>
          Match names{m.aliases.length ? ` (${m.aliases.length})` : ''}
        </Text>
      )}
      <Sheet visible={names !== null} title="Match names" onClose={() => setNames(null)}>
        <Text style={ui.soft}>
          Banks often show a longer or different spelling than “{partnerName}”. Add the names your bank uses for {partnerName}, separated by commas.
        </Text>
        <Field placeholder="e.g. PRIYA SHARMA, P SHARMA" value={names ?? ''} onChangeText={setNames} autoCapitalize="characters" />
        <Button
          title="Save names"
          onPress={async () => {
            await m.setAliases((names ?? '').split(',').map((n) => n.trim()).filter(Boolean));
            setNames(null);
          }}
        />
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  warn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,107,107,0.12)' },
  link: { fontFamily: F.semibold, fontSize: 13.5, color: C.star },
  totals: { flexDirection: 'row', gap: 10 },
  total: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', gap: 4 },
  totalK: { fontFamily: F.medium, fontSize: 12, color: C.inkSoft },
  totalV: { fontFamily: F.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  day: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: C.inkFaint, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amount: { fontFamily: F.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
});
