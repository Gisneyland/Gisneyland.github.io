import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const projectUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cacheHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
  'Cache-Control': 'private, max-age=300, must-revalidate',
  'Content-Type': 'text/calendar; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow'
};

function response(status: number, message: string) {
  return new Response(message, { status, headers: { ...cacheHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
}

function escapeText(value: unknown) {
  return String(value || '').replaceAll('\\', '\\\\').replace(/\r\n?|\n/g, '\\n')
    .replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function foldLine(line: string) {
  let folded = '';
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { folded += '\r\n '; bytes = 1; }
    folded += character;
    bytes += size;
  }
  return folded;
}

function utcStamp(value: string | Date) {
  return new Date(value).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}

function dateKey(value: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function nextScreeningSlot(preferences: unknown, now = new Date()) {
  const rules = (preferences as { rules?: Array<Record<string, unknown>> } | null)?.rules;
  if (!Array.isArray(rules)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);

  for (let offset = 0; offset <= 370; offset += 1) {
    const date = new Date(today + offset * 86400000);
    const weekday = date.getUTCDay();
    const day = date.getUTCDate();
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    const candidates = rules.filter(rule => {
      const place = rule.place as { label?: unknown; coordinates?: unknown } | undefined;
      if (typeof place?.label !== 'string' || !Array.isArray(place.coordinates) || place.coordinates.length !== 2
        || !place.coordinates.every(value => Number.isFinite(Number(value)))) return false;
      if (typeof rule.startTime !== 'string' || typeof rule.endTime !== 'string'
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.startTime)
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.endTime) || rule.startTime >= rule.endTime) return false;
      if (rule.frequency === 'weekly') return Array.isArray(rule.weekdays) && rule.weekdays.includes(weekday);
      if (rule.frequency !== 'monthly' || Number(rule.weekday) !== weekday) return false;
      return Number(rule.ordinal) === -1
        ? day + 7 > monthEnd
        : Number.isInteger(Number(rule.ordinal)) && Math.floor((day - 1) / 7) + 1 === Number(rule.ordinal);
    }).filter(rule => offset > 0 || Number(String(rule.endTime).slice(0, 2)) * 60
      + Number(String(rule.endTime).slice(3, 5)) > currentMinutes)
      .sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)));
    if (!candidates.length) continue;
    const rule = candidates[0];
    return {
      date: date.toISOString().slice(0, 10),
      startTime: rule.startTime as string,
      endTime: rule.endTime as string,
      name: typeof rule.name === 'string' ? rule.name : '',
      place: rule.place as { label: string; coordinates: number[] }
    };
  }
  return null;
}

function eventLines(uid: string, title: string, properties: string[], changedAt: string | Date = new Date()) {
  const timestamp = utcStamp(changedAt);
  return [
    'BEGIN:VEVENT', `UID:${uid}@gisneyland.github.io`, `DTSTAMP:${timestamp}`,
    `LAST-MODIFIED:${timestamp}`, `SUMMARY:${escapeText(title)}`, ...properties, 'END:VEVENT'
  ];
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cacheHeaders });
  if (request.method !== 'GET' && request.method !== 'HEAD') return response(405, 'Method not allowed');
  if (!projectUrl || !serviceRoleKey) return response(503, 'Calendar feed unavailable');
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[0-9a-f]{64}$/.test(token)) return response(404, 'Calendar feed not found');

  const client = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: feed, error: feedError } = await client.from('staff_calendar_feeds')
    .select('user_id').eq('token_hash', await tokenHash(token)).is('revoked_at', null).maybeSingle();
  if (feedError || !feed?.user_id) return response(404, 'Calendar feed not found');

  const [{ data: authResult, error: authError }, { data: profile, error: profileError }] = await Promise.all([
    client.auth.admin.getUserById(feed.user_id),
    client.from('admin_profiles').select('nickname,account_role,approval_status,privacy_consent_at')
      .eq('user_id', feed.user_id).maybeSingle()
  ]);
  if (authError || profileError || !authResult.user || !profile
    || !['administrator', 'screener'].includes(profile.account_role)
    || profile.approval_status !== 'approved' || !profile.privacy_consent_at) {
    return response(404, 'Calendar feed not found');
  }

  const records = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('site_content')
      .select('id,content_type,title,summary,body,published_at,created_at,updated_at,event_start,event_end,is_all_day,event_start_at,event_end_at,location,url,location_latitude,location_longitude')
      .eq('is_published', true).in('content_type', ['event', 'news'])
      .order('created_at', { ascending: true }).range(offset, offset + 499);
    if (error) return response(503, 'Calendar feed temporarily unavailable');
    records.push(...(data || []));
    if (!data || data.length < 500) break;
  }

  const today = dateKey(new Date());
  const until = addDays(today, 366);
  const events: string[][] = [];
  for (const record of records || []) {
    if (record.content_type === 'event' && record.event_start) {
      const timed = record.is_all_day === false && record.event_start_at && record.event_end_at;
      const startDate = String(record.event_start).slice(0, 10);
      const endDate = addDays(String(record.event_end || startDate).slice(0, 10), 1);
      if (endDate <= today || startDate >= until) continue;
      const properties = timed
        ? [`DTSTART:${utcStamp(record.event_start_at)}`, `DTEND:${utcStamp(record.event_end_at)}`]
        : [`DTSTART;VALUE=DATE:${startDate.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${endDate.replaceAll('-', '')}`];
      properties.push('CATEGORIES:風城部屋活動', 'STATUS:CONFIRMED');
      if (record.summary || record.body) properties.push(`DESCRIPTION:${escapeText([record.summary, record.body].filter(Boolean).join('\n'))}`);
      if (record.location) properties.push(`LOCATION:${escapeText(record.location)}`);
      if (record.url) properties.push(`URL:${escapeText(record.url)}`);
      if (Number.isFinite(Number(record.location_latitude)) && Number.isFinite(Number(record.location_longitude))) {
        properties.push(`GEO:${record.location_latitude};${record.location_longitude}`);
      }
      events.push(eventLines(`activity-${record.id}`, record.title, properties, record.updated_at || record.published_at || record.created_at));
    } else if (record.content_type === 'news' && (record.published_at || record.created_at)) {
      const date = dateKey(new Date(record.published_at || record.created_at));
      if (date < today || date >= until) continue;
      events.push(eventLines(`news-${record.id}`, `消息：${record.title}`, [
        `DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${addDays(date, 1).replaceAll('-', '')}`,
        'CATEGORIES:風城部屋消息', 'STATUS:CONFIRMED',
        ...(record.summary || record.body ? [`DESCRIPTION:${escapeText([record.summary, record.body].filter(Boolean).join('\n'))}`] : [])
      ], record.updated_at || record.published_at || record.created_at));
    }
  }

  const slot = nextScreeningSlot(authResult.user.user_metadata?.screening_preferences);
  if (slot && slot.date >= today && slot.date < until) {
    const nickname = String(profile.nickname || authResult.user.user_metadata?.nickname || '篩檢員').trim();
    const description = [`篩檢員：${nickname}`, `安排：${slot.name || '篩檢'}`, `地點：${slot.place.label}`].join('\n');
    events.push(eventLines(`screening-${feed.user_id}`, `篩檢規劃・${nickname}${slot.name ? `・${slot.name}` : ''}`, [
      `DTSTART:${utcStamp(new Date(`${slot.date}T${slot.startTime}:00+08:00`))}`,
      `DTEND:${utcStamp(new Date(`${slot.date}T${slot.endTime}:00+08:00`))}`,
      `DESCRIPTION:${escapeText(description)}`, `LOCATION:${escapeText(slot.place.label)}`,
      `GEO:${slot.place.coordinates[1]};${slot.place.coordinates[0]}`,
      'CATEGORIES:篩檢規劃', 'STATUS:CONFIRMED'
    ], authResult.user.updated_at || new Date()));
  }

  const calendar = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GisneyLand//Staff Subscription Calendar//ZH-TW',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(`風城部屋工作行事曆・${profile.nickname || '篩檢員'}`)}`,
    'X-WR-TIMEZONE:Asia/Taipei', ...events.flat(), 'END:VCALENDAR'
  ].map(foldLine).join('\r\n') + '\r\n';
  const etagBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(calendar));
  const etag = `"${Array.from(new Uint8Array(etagBytes), byte => byte.toString(16).padStart(2, '0')).join('')}"`;
  const headers = { ...cacheHeaders, ETag: etag, 'Content-Disposition': 'inline; filename="gisneyland-staff-calendar.ics"' };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : calendar, { headers });
});