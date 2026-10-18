import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://gisneyland.github.io',
  'http://127.0.0.1:4000',
  'http://localhost:4000'
]);
const redirectTo = 'https://gisneyland.github.io/admin/';

function headers(origin: string | null) {
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

function jsonResponse(body: Record<string, string>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ code: 'origin_not_allowed' }, 403, origin);
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: headers(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ code: 'method_not_allowed' }, 405, origin);
  }

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return jsonResponse({ code: 'unauthorized' }, 401, origin);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 8_000) return jsonResponse({ code: 'request_too_large' }, 413, origin);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ code: 'invalid_request' }, 400, origin);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonResponse({ code: 'invalid_request' }, 400, origin);
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const nickname = typeof payload.nickname === 'string' ? payload.nickname.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ code: 'invalid_email' }, 400, origin);
  }
  if (!nickname || nickname.length > 40) {
    return jsonResponse({ code: 'invalid_nickname' }, 400, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ code: 'server_configuration_error' }, 500, origin);
  }

  const requesterClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error: authError } = await requesterClient.auth.getUser(token);
  if (authError || !userData.user) {
    return jsonResponse({ code: 'unauthorized' }, 401, origin);
  }

  const { data: canManageStaff, error: permissionError } = await requesterClient.rpc(
    'has_admin_permission',
    { required_permission: 'staff.manage' }
  );
  if (permissionError) {
    return jsonResponse({ code: 'permission_check_failed' }, 500, origin);
  }
  if (canManageStaff !== true) {
    return jsonResponse({ code: 'staff_management_required' }, 403, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  await adminClient
    .from('staff_invite_authorizations')
    .delete()
    .lt('expires_at', new Date().toISOString());

  const { error: authorizationError } = await adminClient
    .from('staff_invite_authorizations')
    .insert({
      email,
      invited_by: userData.user.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  if (authorizationError) {
    if (authorizationError.code === '23505') {
      return jsonResponse({ code: 'invitation_pending' }, 409, origin);
    }
    console.error('Staff invitation authorization failed:', authorizationError.code || 'unknown');
    return jsonResponse({ code: 'invite_failed' }, 500, origin);
  }

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { nickname },
    redirectTo
  });
  if (inviteError) {
    await adminClient
      .from('staff_invite_authorizations')
      .delete()
      .eq('email', email)
      .eq('invited_by', userData.user.id);
    const message = `${inviteError.code || ''} ${inviteError.message || ''}`.toLowerCase();
    if (/already|exists|registered/.test(message)) {
      return jsonResponse({ code: 'email_already_registered' }, 409, origin);
    }
    if (/rate limit|too many requests/.test(message)) {
      return jsonResponse({ code: 'email_rate_limited' }, 429, origin);
    }
    console.error('Staff invitation failed:', inviteError.code || 'unknown');
    return jsonResponse({ code: 'invite_failed' }, 502, origin);
  }

  return jsonResponse({ code: 'invitation_sent' }, 200, origin);
});