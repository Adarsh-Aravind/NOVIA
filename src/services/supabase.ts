import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { LargeSecureStore } from './secureStore';
import { IS_DEMO } from '../demo/config';
import { createDemoSupabase } from '../demo/demoSupabase';

// Modern Expo public environment variables (loaded automatically from .env)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

const createRealClient = () => createClient(supabaseUrl, supabaseAnonKey, {
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

type Client = ReturnType<typeof createRealClient>;

// The demo build never constructs a real client — see src/demo/config.ts.
export const supabase: Client = IS_DEMO
  ? (createDemoSupabase() as unknown as Client)
  : createRealClient();
