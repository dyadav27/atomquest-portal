import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../app/types';

interface AuthState {
  token: string | null;
  role: UserRole | null;
  user: any | null;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithAzure: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  user: null,

  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) return { success: false, error: error.message };
      
      // Fetch role from users table
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();
        
      const role = (profile?.role as UserRole) || 'employee';
      
      set({ 
        token: data.session.access_token, 
        role, 
        user: data.user 
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  },

  loginWithAzure: async () => {
    try {
      const { signInWithMicrosoft } = await import('../lib/msal');
      const result = await signInWithMicrosoft();

      const idToken = result.idToken;
      const azureOid = result.account?.homeAccountId || result.account?.localAccountId || '';
      const email = result.account?.username || '';
      const name = result.account?.name || '';

      if (!idToken) throw new Error('No ID token returned from Microsoft');

      // Call our backend to validate the token and get a Supabase session
      const response = await fetch('/api/auth/azure-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, azureOid, email, name }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Azure SSO backend error');

      // Verify the OTP token_hash to establish a Supabase session
      if (data.token_hash) {
        const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
          email: data.email,
          token: data.token_hash,
          type: 'magiclink',
        });

        if (verifyErr) throw verifyErr;

        if (sessionData.session) {
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', sessionData.session.user.id)
            .single();

          set({
            token: sessionData.session.access_token,
            role: (profile?.role as any) || 'employee',
            user: sessionData.session.user,
          });
        }
      }
    } catch (err: any) {
      console.error('[AuthStore] Azure SSO failed:', err.message);
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ token: null, role: null, user: null });
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Fetch role
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
        
      set({ 
        token: session.access_token,
        role: (profile?.role as UserRole) || 'employee',
        user: session.user
      });
    }
    
    // Set up real-time listener for Auth changes (like OAuth callback)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        set({
          token: session.access_token,
          role: (profile?.role as UserRole) || 'employee',
          user: session.user
        });
      } else if (event === 'SIGNED_OUT') {
        set({ token: null, role: null, user: null });
      }
    });
  }
}));

export default useAuthStore;
