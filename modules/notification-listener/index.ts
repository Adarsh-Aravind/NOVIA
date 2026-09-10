import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';

/**
 * JS face of the Android notification listener.
 *
 * Android-only and permanently so: iOS has no equivalent API and no
 * entitlement that would grant one. Every call degrades to a no-op elsewhere,
 * and — more importantly — degrades to a no-op on an Android build that
 * predates this module. The app ships most changes over the air, so a JS
 * bundle regularly lands on a binary that has never heard of the native module
 * it is calling; a bare `requireNativeModule` at import time would white-screen
 * the whole app on those installs rather than quietly disabling one feature.
 */

export interface CapturedNotification {
  packageName: string;
  title: string;
  text: string;
  /** Epoch milliseconds, from the OS — not from this device's clock at drain. */
  postTime: number;
}

interface NativeModule {
  isPermissionGranted(): boolean;
  openSettings(): void;
  setWatchedPackages(packages: string[]): void;
  getWatchedPackages(): string[];
  drainPending(): CapturedNotification[];
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  addListener(
    event: 'onNotification',
    listener: (payload: CapturedNotification) => void
  ): EventSubscription;
}

let resolved = false;
let native: NativeModule | null = null;

function getNative(): NativeModule | null {
  if (resolved) return native;
  resolved = true;

  if (Platform.OS !== 'android') return null;
  try {
    const { requireNativeModule } = require('expo-modules-core');
    native = requireNativeModule('NoviaNotificationListener') as NativeModule;
  } catch {
    native = null;
  }
  return native;
}

/** False on iOS, and on any Android build that predates the native module. */
export function isAvailable(): boolean {
  return getNative() !== null;
}

export function isPermissionGranted(): boolean {
  try {
    return getNative()?.isPermissionGranted() ?? false;
  } catch {
    return false;
  }
}

export function openSettings(): void {
  try {
    getNative()?.openSettings();
  } catch {
    // The settings screen is missing on some heavily skinned builds. Nothing
    // useful to do about it beyond not crashing.
  }
}

export function setWatchedPackages(packages: string[]): void {
  try {
    getNative()?.setWatchedPackages(packages);
  } catch {
    /* leaves the native defaults in place */
  }
}

export function drainPending(): CapturedNotification[] {
  try {
    return getNative()?.drainPending() ?? [];
  } catch {
    return [];
  }
}

export function isIgnoringBatteryOptimizations(): boolean {
  try {
    return getNative()?.isIgnoringBatteryOptimizations() ?? true;
  } catch {
    // Claiming "exempt" on failure is the right default: it suppresses a
    // nag we cannot verify, rather than showing a warning we cannot dismiss.
    return true;
  }
}

export function requestIgnoreBatteryOptimizations(): void {
  try {
    getNative()?.requestIgnoreBatteryOptimizations();
  } catch {
    /* ignore */
  }
}

export function addNotificationListener(
  listener: (payload: CapturedNotification) => void
): EventSubscription | null {
  try {
    return getNative()?.addListener('onNotification', listener) ?? null;
  } catch {
    return null;
  }
}
