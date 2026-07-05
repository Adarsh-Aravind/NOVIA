import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { LargeSecureStore } from './secureStore';

// Modern Expo public environment variables (loaded automatically from .env)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in the device keystore (encrypted at rest) rather
    // than plaintext AsyncStorage. See src/services/secureStore.ts.
    storage: LargeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
