// Paste your Supabase project's PUBLIC values here.
// Dashboard -> Project Settings -> API
//
// SUPABASE_URL is the "Project URL".
// SUPABASE_ANON_KEY is the "anon" / "public" key — safe to put in
// client-side code like this, because the database's row-level security
// (set up in supabase/schema.sql) only lets this key read rows where
// matched = true. It can never write, and never sees non-matched rows.
//
// Do NOT put the "service_role" key here — that one is secret and only
// belongs in the local server's .env file.

window.SUPABASE_CONFIG = {
  url: "https://sjeudspqdjdukdtsjedv.supabase.co",
  anonKey: "sb_publishable_nc6w4tG9YBvHjMemz1j4rw_A3xs_2Qw",
};

// Firebase web configuration is in firebase-config.js, which is also loaded
// by the service worker.
