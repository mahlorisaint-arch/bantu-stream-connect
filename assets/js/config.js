// ----- SUPABASE CONFIG -----
export const SUPABASE_URL = "https://ydnxqnbjoshvxteevemc.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbnhxbmJqb3Nodnh0ZWVjZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU3NjMyNDkzLCJleHAiOjIwNzMyMDg0OTN9.NlaCCnLPSz1mM7AFeSlfZQ78kYEKUMh_Fi-7P_ccs_U";

// ----- IMPORT SUPABASE CLIENT -----
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ----- INIT SUPABASE INSTANCE -----
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- HELPER: TEST CONNECTION -----
export async function testSupabase() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) throw error;
    console.log("✅ Supabase connection works, sample data:", data);
  } catch (err) {
    console.error("❌ Supabase connection failed:", err.message);
  }
}
