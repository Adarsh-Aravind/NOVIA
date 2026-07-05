import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * A Supabase-compatible storage adapter backed by the device keystore
 * (iOS Keychain / Android Keystore) via expo-secure-store, instead of the
 * plaintext AsyncStorage. This encrypts the persisted auth session (access +
 * refresh tokens) at rest so it can't be lifted off a rooted device or an
 * unencrypted backup.
 *
 * SecureStore rejects large values on some platforms (historically ~2 KB on
 * iOS), and a Supabase session JSON can exceed that once user metadata is
 * included. So we split the value into UTF-8-byte-bounded chunks, store each
 * under its own key, and keep a small header key recording the chunk count so
 * we can reassemble and clean up reliably.
 */

// Stay comfortably under the ~2 KB platform limit, in UTF-8 bytes.
const MAX_CHUNK_BYTES = 1800;

const chunkKey = (key: string, index: number) => `${key}.${index}`;

/** UTF-8 byte length of a single Unicode code point. */
function utf8Len(codePoint: string): number {
  const cp = codePoint.codePointAt(0)!;
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/**
 * Split `value` into pieces whose UTF-8 encoding stays within `maxBytes`,
 * never splitting a Unicode code point. Iterating with `for..of` walks full
 * code points, so surrogate pairs (e.g. emoji in a display name) stay intact.
 */
function splitByBytes(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of value) {
    const chBytes = utf8Len(ch);
    if (currentBytes + chBytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  // Always emit at least one chunk so an empty string round-trips.
  if (current.length > 0 || chunks.length === 0) chunks.push(current);
  return chunks;
}

async function getChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function setItem(key: string, value: string): Promise<void> {
  const previousCount = await getChunkCount(key);
  const chunks = splitByBytes(value, MAX_CHUNK_BYTES);

  // Write the chunks first, then the header last, so a crash mid-write never
  // leaves the header pointing at chunks that don't exist yet.
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
  }
  await SecureStore.setItemAsync(key, String(chunks.length));

  // Drop any leftover chunks from a previously longer value.
  for (let i = chunks.length; i < previousCount; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    const count = await getChunkCount(key);

    if (count === 0) {
      // One-time upgrade: an earlier build stored the session in plaintext
      // AsyncStorage. Move it into SecureStore and purge the plaintext copy so
      // the user isn't forced to sign in again and no cleartext token lingers.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        await setItem(key, legacy);
        await AsyncStorage.removeItem(key);
        return legacy;
      }
      return null;
    }

    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part == null) return null; // partial/corrupted write — treat as absent
      parts.push(part);
    }
    return parts.join('');
  } catch {
    // A keystore hiccup should look like "no session" (user re-authenticates),
    // never a hard crash during auth bootstrap.
    return null;
  }
}

async function removeItem(key: string): Promise<void> {
  const count = await getChunkCount(key);
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
  await SecureStore.deleteItemAsync(key);
  // Also clear any stray legacy plaintext copy.
  await AsyncStorage.removeItem(key);
}

export const LargeSecureStore = { getItem, setItem, removeItem };
