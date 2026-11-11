/* FixHub public settings — safe to ship. These three keys are PUBLIC BY
   DESIGN (Supabase anon + Paystack public key are enforced server-side by
   RLS / dashboard settings). The Groq key is NOT here — it lives in the
   server's .env and the browser never sees it. Fill in the placeholders. */
window.FIXHUB_CONFIG = {
  apiBaseUrl: window.FIXHUB_API_BASE_URL || "",
  supabaseUrl: "https://acslkbrlxpjnsqrcgnou.supabase.co",
  supabaseAnonKey: "sb_publishable_m4t_Lf7c0lpMU9fqVrrKDA_cH715vsO",
  paystackPublicKey: "pk_live_e8f1f9deb4f52160339981feb63f2ce0b92ca8f0"
};
