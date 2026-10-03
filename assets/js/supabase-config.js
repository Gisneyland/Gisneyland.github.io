// Replace these values with the Project URL and Publishable/anon key from Supabase.
const SUPABASE_URL = 'https://adivkorccnvtboffzvfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wee7ek-BFrbvu0lo3A-gNQ_JC4WSlk-';
// Optional: set this after deploying supabase/functions/submit-questionnaire.
const SUPABASE_FUNCTION_NAME = 'submit-questionnaire';

const hasSupabaseConfig = !SUPABASE_URL.includes('YOUR_PROJECT_REF')
  && !SUPABASE_ANON_KEY.includes('YOUR_');

if (hasSupabaseConfig && window.supabase?.createClient) {
  window.SUPABASE_FUNCTION_NAME = SUPABASE_FUNCTION_NAME;
  window.questionnaireSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
