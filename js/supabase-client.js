/**
 * Shared Supabase Client
 * Dedicated Project: yaxyqpwsxknahehhmtch (ap-south-1)
 * Zero-build browser client using official @supabase/supabase-js CDN
 */

const SUPABASE_CONFIG = {
  url: 'https://yaxyqpwsxknahehhmtch.supabase.co',
  anonKey: 'sb_publishable_liMmiGXT56F4yDC4slZUEA_wNLwBFk3'
};

let _supabaseClientInstance = null;

function getSupabase() {
  if (_supabaseClientInstance) {
    return _supabaseClientInstance;
  }

  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    _supabaseClientInstance = window.supabase.createClient(
      SUPABASE_CONFIG.url, 
      SUPABASE_CONFIG.anonKey, 
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    return _supabaseClientInstance;
  }

  console.warn('[Supabase] SDK script not yet loaded or missing window.supabase.');
  return null;
}

// Expose globally
if (typeof window !== 'undefined') {
  window.getSupabase = getSupabase;
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
