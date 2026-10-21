import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN');

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': allowedOrigin ?? '*',
  'Content-Type': 'application/json'
};

const maxBodyBytes = 120_000;
const maxMultipartBytes = 6_000_000;
const maxPhotoBytes = 2_500_000;
const photoBucket = 'screening-test-photos';
const contactTypes = new Set([
  'phone', 'email', 'line', 'facebook', 'instagram', 'threads', 'whatsapp', 'telegram', 'address'
]);
const photoRequiredResult: Record<string, string> = {
  hiv: 'hiv_positive',
  syphilis: 'syphilis_positive'
};

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function detectImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isRiff && isWebp ? { mime: 'image/webp', ext: 'webp' } : null;
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

  const isMultipart = (request.headers.get('content-type') ?? '').startsWith('multipart/form-data');
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (isMultipart && contentLength === 0) {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
  if (contentLength > (isMultipart ? maxMultipartBytes : maxBodyBytes)) {
    return jsonResponse({ error: 'Request is too large' }, 413);
  }

  const uploadedPaths: string[] = [];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    let payload;
    const photoFiles = new Map<string, File>();

    if (isMultipart) {
      const form = await request.formData();
      const rawPayload = form.get('payload');
      if (typeof rawPayload !== 'string' || rawPayload.length > 110_000) {
        return jsonResponse({ error: 'Invalid questionnaire payload' }, 400);
      }
      payload = JSON.parse(rawPayload);
      for (const kind of Object.keys(photoRequiredResult)) {
        const file = form.get(`photo_${kind}`);
        if (file instanceof File) photoFiles.set(kind, file);
      }
    } else {
      payload = await request.json();
    }

    const responseData = payload?.response_data;
    const language = payload?.language;
    const schemaVersion = payload?.schema_version;

    if (
      !responseData ||
      typeof responseData !== 'object' ||
      Array.isArray(responseData) ||
      typeof responseData.screener !== 'string' ||
      responseData.screener.trim().length === 0 ||
      !['zh-TW', 'en'].includes(language) ||
      schemaVersion !== 1 ||
      JSON.stringify(responseData).length > 100_000
    ) {
      return jsonResponse({ error: 'Invalid questionnaire payload' }, 400);
    }

    // 照片路徑只能由伺服器寫入，避免前端指定任意儲存路徑。
    delete responseData.screening_photos;

    const contacts = responseData.hiv_positive_contacts;
    const consultCode = responseData.anonymous_consult_code;
    if (
      consultCode !== undefined &&
      (typeof consultCode !== 'string' || (consultCode !== '' && !/^[A-Za-z0-9-]{4,32}$/.test(consultCode)))
    ) {
      return jsonResponse({ error: 'Invalid anonymous consultation code' }, 400);
    }
    if (
      contacts !== undefined &&
      (!Array.isArray(contacts) ||
        contacts.length > 8 ||
        contacts.some(contact =>
          !contact ||
          typeof contact !== 'object' ||
          !contactTypes.has(contact.type) ||
          typeof contact.value !== 'string' ||
          contact.value.length === 0 ||
          contact.value.length > 300
        ))
    ) {
      return jsonResponse({ error: 'Invalid contact methods' }, 400);
    }

    if (photoFiles.size > 0) {
      const results = Array.isArray(responseData.screening_interpretation)
        ? responseData.screening_interpretation
        : [];
      const photoPaths: Record<string, string> = {};
      const folder = crypto.randomUUID();
      const validatedPhotos = [];

      for (const [kind, file] of photoFiles) {
        if (!results.includes(photoRequiredResult[kind]) || file.size === 0 || file.size > maxPhotoBytes) {
          return jsonResponse({ error: 'Invalid photo' }, 400);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const imageType = detectImageType(bytes);
        if (!imageType) {
          return jsonResponse({ error: 'Invalid photo' }, 400);
        }
        validatedPhotos.push({ kind, bytes, imageType });
      }

      for (const { kind, bytes, imageType } of validatedPhotos) {
        const path = `${folder}/${kind}.${imageType.ext}`;
        const { error: uploadError } = await supabase.storage
          .from(photoBucket)
          .upload(path, bytes, { contentType: imageType.mime, cacheControl: '0', upsert: false });
        if (uploadError) {
          console.error('Photo upload failed:', uploadError.message);
          if (uploadedPaths.length) await supabase.storage.from(photoBucket).remove(uploadedPaths);
          return jsonResponse({ error: 'Unable to save photo' }, 500);
        }
        uploadedPaths.push(path);
        photoPaths[kind] = path;
      }
      responseData.screening_photos = photoPaths;
    }

    const { error } = await supabase
      .from('questionnaire_responses')
      .insert({ response_data: responseData, language, schema_version: schemaVersion });

    if (error) {
      console.error('Database insert failed:', error.message);
      if (uploadedPaths.length) await supabase.storage.from(photoBucket).remove(uploadedPaths);
      return jsonResponse({ error: 'Unable to save questionnaire' }, 500);
    }

    return jsonResponse({ message: 'Questionnaire saved' }, 201);
  } catch (error) {
    console.error('Request handling failed:', error);
    if (uploadedPaths.length) await supabase.storage.from(photoBucket).remove(uploadedPaths);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
});
