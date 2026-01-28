import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug Logs (Verify in Browser Console)
console.log("Supabase URL Detected:", !!supabaseUrl, supabaseUrl ? supabaseUrl.slice(0, 5) + "..." : "MISSING");
console.log("Supabase Key Detected:", !!supabaseKey, supabaseKey ? "YES (Hidden)" : "MISSING");


// Safe initialization to allow ErrorBoundary to catch missing envs
// If keys are missing, we return null.
// AuthContext will try to access supabase.auth, fail, and trigger ErrorBoundary.
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;
