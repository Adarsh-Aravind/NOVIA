/**
 * Demo build switch.
 *
 * `EXPO_PUBLIC_DEMO_MODE=1` is inlined into the bundle at build time, so a demo
 * APK carries no code path that can reach Supabase or Groq: the backend is the
 * in-memory fake in [[demoSupabase]], seeded with fictional data, and the
 * assistant answers from [[demoAssistant]]. app.config.js reads the same flag to
 * give the demo its own package name and switch OTA updates off — a demo that
 * pulled a production update would pick up the real backend.
 */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === '1';
