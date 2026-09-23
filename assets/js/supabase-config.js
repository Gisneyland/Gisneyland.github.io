// Replace these values with the Project URL and Publishable/anon key from Supabase.
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY';
// Optional: set this after deploying supabase/functions/submit-questionnaire.
const SUPABASE_FUNCTION_NAME = '';

const hasSupabaseConfig = !SUPABASE_URL.includes('YOUR_PROJECT_REF')
  && !SUPABASE_ANON_KEY.includes('YOUR_');

if (hasSupabaseConfig && window.supabase?.createClient) {
  window.SUPABASE_FUNCTION_NAME = SUPABASE_FUNCTION_NAME;
  window.questionnaireSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
