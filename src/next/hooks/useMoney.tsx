import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTransactions, TransactionsState } from '../../hooks/useTransactions';

/**
 * Detected payments, mounted once at the app's root.
 *
 * useTransactions doesn't only read the feed: it also runs the capture path
 * (texts and payment-app notifications parsed on the device, then written
 * through record_transaction()). Mounting it at the root, as the old app did,
 * keeps capture running whichever screen is open, not only while the
 * payments list is showing.
 *
 * Extra spellings of the partner's name (banks often show "PRIYA SHARMA"
 * rather than "Priya") are kept under the same storage key the old app used,
 * so anything already set there carries over.
 */
const ALIAS_KEY = 'novia.payments.partnerAliases';

interface Money extends TransactionsState {
  aliases: string[];
  setAliases: (names: string[]) => Promise<void>;
}

const Ctx = createContext<Money | null>(null);

export function MoneyProvider({ coupleId, partnerName, children }: { coupleId: string; partnerName: string | null; children: React.ReactNode }) {
  const [custom, setCustom] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(ALIAS_KEY)
      .then((raw) => raw && setCustom(JSON.parse(raw)))
      .catch(() => undefined);
  }, []);
  const aliases = useMemo(() => [partnerName, ...custom].filter((n): n is string => !!n && n.trim().length > 0), [partnerName, custom]);
  const tx = useTransactions(coupleId, aliases);
  const setAliases = async (names: string[]) => {
    setCustom(names);
    await AsyncStorage.setItem(ALIAS_KEY, JSON.stringify(names)).catch(() => undefined);
  };
  return <Ctx.Provider value={{ ...tx, aliases: custom, setAliases }}>{children}</Ctx.Provider>;
}

export function useMoney(): Money {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMoney must be used inside <MoneyProvider>');
  return v;
}
