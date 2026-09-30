import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-target',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Verify the caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: authData, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !authData.user) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }
  const userId = authData.user.id;

  const target = req.headers.get('x-target') ?? 'anthropic';

  // Speech-to-text for dictated anamnesis notes: Mistral Voxtral, EU. The app has put the recording
  // into the coach's own anamnesis folder; Mistral gets a 10-minute link to it, and the file is
  // deleted right after — only the text is kept.
  if (target === 'mistral-transcribe') {
    const mistralKey = Deno.env.get('MISTRAL_API_KEY');
    if (!mistralKey) {
      return new Response('Server misconfigured: MISTRAL_API_KEY missing', { status: 500, headers: CORS_HEADERS });
    }
    let payload: { path?: string; language?: string };
    try {
      payload = await req.json();
    } catch {
      return new Response('Bad request', { status: 400, headers: CORS_HEADERS });
    }
    const path = payload.path ?? '';
    // Only recordings in the caller's own anamnesis folder
    if (!path.startsWith(`anamnesis/${userId}/`) || path.includes('..')) {
      return new Response('Forbidden', { status: 403, headers: CORS_HEADERS });
    }
    const { data: signed, error: signError } = await supabase.storage
      .from('documents')
      .createSignedUrl(path, 600);
    if (signError || !signed) {
      return new Response('Recording not found', { status: 404, headers: CORS_HEADERS });
    }

    const form = new FormData();
    form.append('model', 'voxtral-mini-latest');
    form.append('file_url', signed.signedUrl);
    if (payload.language === 'de' || payload.language === 'en') form.append('language', payload.language);

    try {
      const upstream = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mistralKey}` },
        body: form,
      });
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } finally {
      await supabase.storage.from('documents').remove([path]);
    }
  }

  const body = await req.text();

  // Embeddings for document search (RAG): Mistral, EU. (Replaced OpenAI.)
  if (target === 'mistral-embed') {
    const mistralKey = Deno.env.get('MISTRAL_API_KEY');
    if (!mistralKey) {
      return new Response('Server misconfigured: MISTRAL_API_KEY missing', { status: 500, headers: CORS_HEADERS });
    }

    const upstream = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralKey}`,
      },
      body,
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Default: Anthropic
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response('Server misconfigured', { status: 500, headers: CORS_HEADERS });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
