import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Alert } from 'react-native';

/**
 * Normalise a profile as it comes off the wire.
 *
 * display_name is interpolated into a dozen sentences ("<name> is feeling
 * Happy", "Waiting for <name>'s first sync"), so a single stray space stored on
 * the row shows up as a double space or a floating apostrophe on every one of
 * them. Trimming on write only helps names saved since that was added; trimming
 * on read fixes the rows already in the database too.
 */
function normalizeProfile(row: Profile): Profile {
  return { ...row, display_name: (row.display_name || '').trim() };
}

export function useAuth() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        bootstrapUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        bootstrapUser(session.user.id);
      } else {
        resetState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetState = () => {
    setProfile(null);
    setPartnerProfile(null);
    setCoupleId(null);
    setLoading(false);
  };

  const bootstrapUser = async (userId: string) => {
    try {
      setLoading(true);
      
      // 1. Get profile
      const { data: myProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr || !myProfile) {
        console.warn('Profile not found, waiting for auth trigger...', profileErr);
        setLoading(false);
        return;
      }

      setProfile(normalizeProfile(myProfile));
      setCoupleId(myProfile.couple_id);

      if (myProfile.couple_id) {
        // 2. Fetch partner's profile
        const { data: partnerData, error: partnerErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('couple_id', myProfile.couple_id)
          .neq('id', userId)
          .maybeSingle();

        if (partnerErr) {
          // A failed lookup is not evidence the partner is gone — leave whatever
          // we already had rather than blanking the UI on a flaky connection.
          console.warn('[Auth] Partner profile fetch failed:', partnerErr);
        } else {
          // Assign unconditionally, null included. Only ever setting a non-null
          // partner meant an unpair performed on the *partner's* device left
          // their name, mood and advice card stranded on this one for the rest
          // of the session.
          setPartnerProfile(partnerData ? normalizeProfile(partnerData) : null);
        }
      } else {
        setPartnerProfile(null);
      }
    } catch (err) {
      console.error('Error bootstrapping profile context:', err);
    } finally {
      setLoading(false);
    }
  };

  // Listen to profile updates (e.g. if partner links with us)
  useEffect(() => {
    if (!session) return;

    const profileChannel = supabase
      .channel(`profile-self:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        (payload: any) => {
          const updatedProfile = normalizeProfile(payload.new as Profile);
          setProfile(updatedProfile);
          setCoupleId(updatedProfile.couple_id);
          if (updatedProfile.couple_id) {
            bootstrapUser(session.user.id);
          } else {
            setPartnerProfile(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [session]);

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          }
        }
      });
      if (error) throw error;
      Alert.alert("Success", "Account created! Please log in.");
    } catch (err: any) {
      Alert.alert("Signup Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert("Sign In Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      resetState();
    } catch (err: any) {
      Alert.alert("Sign Out Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  const pairPartner = async (partnerUserId: string) => {
    if (!session) return;
    try {
      setLoading(true);

      // Pairing runs through a validated SECURITY DEFINER RPC so neither the
      // couple row nor couple_id can be spoofed from the client.
      const { error } = await supabase.rpc('pair_with_partner', {
        partner_uuid: partnerUserId,
      });

      if (error) throw error;

      Alert.alert("Success", "Successfully paired with your partner!");
      await bootstrapUser(session.user.id);
    } catch (err: any) {
      Alert.alert("Pairing Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  const unpairPartner = async () => {
    if (!coupleId) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('unpair');

      if (error) throw error;
      Alert.alert("Success", "Successfully unpaired.");
      resetState();
    } catch (err: any) {
      Alert.alert("Unpairing Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateDisplayName = async (name: string) => {
    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);
      
    if (!error && profile) {
      setProfile({ ...profile, display_name: name });
    }
  };

  /**
   * Write (or clear) the profile picture.
   *
   * `avatar_url` holds a `data:image/jpeg;base64,...` string rather than a
   * remote URL: the bytes live in the column, which is why there is no bucket,
   * no storage policy and no signed-URL refresh anywhere in this app. See the
   * size guard at the call site — a row this wide is only safe because the
   * image is resized to 256px before it gets here.
   *
   * Unlike updateDisplayName above, this *throws*. That one swallows its error,
   * which is why the try/catch around it can never fire; a picture that
   * silently fails to save is worse, because the old one stays on screen and
   * looks like it worked.
   */
  const updateAvatar = async (dataUri: string | null) => {
    if (!session) return;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: dataUri, updated_at: new Date().toISOString() })
      .eq('id', session.user.id);

    if (error) throw new Error(error.message);
    if (profile) setProfile({ ...profile, avatar_url: dataUri });
  };

  return {
    session,
    loading,
    profile,
    partnerProfile,
    coupleId,
    updateDisplayName,
    updateAvatar,
    signUp,
    signIn,
    signOut,
    pairPartner,
    unpairPartner,
    refetchAuth: () => session && bootstrapUser(session.user.id)
  };
}
