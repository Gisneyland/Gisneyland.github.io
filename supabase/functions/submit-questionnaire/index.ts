import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN');

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': allowedOrigin ?? '*',
  'Content-Type': 'application/json'
};

const maxBodyBytes = 120_000;

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const requestOrigin = request.headers.get('origin');
  if (allowedOrigin && requestOrigin !== allowedOrigin) {
    return jsonResponse({ error: 'Origin not allowed' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxBodyBytes) {
    return jsonResponse({ error: 'Request is too large' }, 413);
  }

  try {
    const payload = await request.json();
    const responseData = payload?.response_data;
    const language = payload?.language;
    const schemaVersion = payload?.schema_version;

    if (
      !responseData ||
      typeof responseData !== 'object' ||
      Array.isArray(responseData) ||
      !['zh-TW', 'en'].includes(language) ||
      schemaVersion !== 1 ||
      JSON.stringify(responseData).length > 100_000
    ) {
      return jsonResponse({ error: 'Invalid questionnaire payload' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase
      .from('questionnaire_responses')
      .insert({ response_data: responseData, language, schema_version: schemaVersion });

    if (error) {
      console.error('Database insert failed:', error.message);
      return jsonResponse({ error: 'Unable to save questionnaire' }, 500);
    }

    return jsonResponse({ message: 'Questionnaire saved' }, 201);
  } catch (error) {
    console.error('Request handling failed:', error);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
});
