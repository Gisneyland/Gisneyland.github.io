const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const sources = [
  { id: 'gdacs', url: 'https://www.gdacs.org/xml/rss.xml' },
  { id: 'ptwc', url: 'https://www.tsunami.gov/events/xml/PHEBAtom.xml' },
  { id: 'ntwc', url: 'https://www.tsunami.gov/events/xml/PAAQAtom.xml' }
];
let cachedResponse = null;
let cachedAt = 0;
let pendingRequest = null;

async function fetchSources() {
  return Promise.all(sources.map(async source => {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) throw new Error('Upstream unavailable');
      const xml = await response.text();
      if (xml.length > 2000000 || !xml.trim().startsWith('<') || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Invalid feed');
      return { ...source, ok: true, fetchedAt: new Date().toISOString(), xml };
    } catch {
      return { ...source, ok: false, fetchedAt: new Date().toISOString(), xml: null };
    }
  }));
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  if (!cachedResponse || Date.now() - cachedAt >= 60000) {
    if (!pendingRequest) {
      pendingRequest = fetchSources().then(results => {
        cachedResponse = { sources: results };
        cachedAt = Date.now();
      }).finally(() => { pendingRequest = null; });
    }
    await pendingRequest;
  }
  return new Response(JSON.stringify(cachedResponse), { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
});