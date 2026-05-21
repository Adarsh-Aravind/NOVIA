import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

const BACKGROUND_ALARM_SYNC_TASK = 'BACKGROUND_ALARM_SYNC_TASK';

// Define the background execution block
TaskManager.defineTask(BACKGROUND_ALARM_SYNC_TASK, async () => {
  try {
    const today = new Date().toISOString();
    console.log(`[Background Fetch] Execution check triggered at ${today}`);

    // Verify authentication session status
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return BackgroundFetch.BackgroundFetchResult.NoData;

    // A. Query profile to get couple pairing context
    const { data: profile } = await supabase
      .from('profiles')
      .select('couple_id')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.couple_id) return BackgroundFetch.BackgroundFetchResult.NoData;

    // B. Check active alarms or punishment status updates
    const { data: alarms } = await supabase
      .from('alarms')
      .select('*')
      .eq('couple_id', profile.couple_id)
      .eq('is_enabled', true);

    if (!alarms || alarms.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    // In a real application, background tasks can check if alarms need to trigger local system alerts
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[Background Fetch] Failed task execution:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetchAsync() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_ALARM_SYNC_TASK);
  if (isRegistered) {
    console.log(`[Background Tasks] worker "${BACKGROUND_ALARM_SYNC_TASK}" already active.`);
    return;
  }
  
  return BackgroundFetch.registerTaskAsync(BACKGROUND_ALARM_SYNC_TASK, {
    minimumInterval: 15 * 60, // 15 Minutes (Android operating system minimum threshold limit)
    stopOnTerminate: false,   // Continue fetch checkups on phone restarts
    startOnBoot: true,
  });
}
