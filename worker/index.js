// 알라딘이 CORS 헤더를 주지 않아 브라우저에서 직접 못 부른다.
// 어차피 프록시가 필요하므로 Claude 호출도 같은 곳으로 모은다(4장).

const ALADIN_BASE = 'https://www.aladin.co.kr/ttb/api';
const ALADIN_PATHS = { ItemList: 'ItemList.aspx', ItemLookUp: 'ItemLookUp.aspx', ItemSearch: 'ItemSearch.aspx' };
const RANKING_TTL = 21600; // 6시간
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const JSON_TYPE = 'application/json; charset=utf-8';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-api-key, anthropic-version',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function withCors(res, env) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(corsHeaders(env))) out.headers.set(k, v);
  return out;
}

function fail(message, status, env) {
  const headers = { 'content-type': JSON_TYPE, ...corsHeaders(env) };
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

async function handleAladin(request, env, ctx) {
  const { method, params } = await request.json();
  const path = ALADIN_PATHS[method];
  if (!path) return fail('지원하지 않는 요청입니다.', 400, env);
  if (!env.ALADIN_TTB_KEY) return fail('프록시에 알라딘 키가 설정되지 않았습니다.', 500, env);

  const url = new URL(`${ALADIN_BASE}/${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
  url.searchParams.set('output', 'js');
  url.searchParams.set('Version', '20131101');

  // 캐시 키는 TTB 키를 붙이기 전 URL로 만든다. 키가 캐시에 남지 않도록.
  const cache = caches.default;
  const cacheKey = new Request(url.toString());
  const cacheable = method === 'ItemList';
  if (cacheable) {
    const hit = await cache.match(cacheKey);
    if (hit) return withCors(hit, env);
  }

  url.searchParams.set('ttbkey', env.ALADIN_TTB_KEY);
  const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const res = new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': JSON_TYPE },
  });
  if (cacheable && upstream.ok) {
    res.headers.set('cache-control', `public, max-age=${RANKING_TTL}`);
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return withCors(res, env);
}

async function handleClaude(request, env) {
  const key = request.headers.get('x-api-key');
  if (!key) return fail('API 키가 없습니다.', 400, env);

  // 키는 전달만 한다. 저장·로깅하지 않는다(4장 BYOK).
  // 15초는 생성 호출에 짧아 정상 응답이 끊긴다. 재시도가 금지라 손실이 크므로 60초.
  const upstream = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': request.headers.get('anthropic-version') ?? '2023-06-01',
    },
    body: await request.text(),
    signal: AbortSignal.timeout(60000),
  });
  const headers = { 'content-type': JSON_TYPE };
  return withCors(new Response(await upstream.text(), { status: upstream.status, headers }), env);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
    if (request.method !== 'POST') return fail('POST만 지원합니다.', 405, env);

    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/aladin') return await handleAladin(request, env, ctx);
      if (pathname === '/claude') return await handleClaude(request, env);
      return fail('없는 경로입니다.', 404, env);
    } catch {
      return fail('프록시 요청에 실패했습니다.', 502, env);
    }
  },
};
