// 알라딘 OpenAPI 가 2026-10-30 전면 종료되어(errorCode 999) 공급원을 나눴다.
//   /yes24   — 예스24. 판매 베스트셀러 순위
//   /kakao   — 카카오 책 검색. 검색·ISBN 단건 조회·추천 실존 검증
//   /library — 도서관 정보나루. 인기대출 순위. 예스24 가 실패할 때의 대체 경로
// 예스24 는 CORS 헤더를 주지 않고, 문서도 키를 클라이언트 코드에 넣지 말라고 한다.
// 카카오는 CORS 를 열어주지만(Access-Control-Allow-Origin: *) 프록시를 거친다.
// GitHub Pages 는 공개 호스팅이라 REST 키를 소스에 박으면 그대로 노출되고,
// 그 키가 사용자의 카카오톡 '나에게 보내기' 앱과 같은 앱이라 쿼터 도용 피해가 번진다.
//
// /claude 는 현재 앱이 쓰지 않는다. Anthropic 이 Cloudflare Worker 에서 나가는 요청을
// 403 "Request not allowed" 로 차단해(2026-08-08 확인), 클라이언트가 브라우저에서
// 직접 호출하도록 바꿨다. Anthropic 이 다시 허용하면 이 경로로 되돌릴 수 있어 남겨둔다.

const YES24_BASE = 'https://apis.yes24.com/v1';
const YES24_PATHS = new Set(['category/list', 'category/bestseller']);
const KAKAO_URL = 'https://dapi.kakao.com/v3/search/book';
const LIBRARY_BASE = 'https://data4library.kr/api';
const LIBRARY_METHODS = new Set(['loanItemSrch', 'srchDtlList']);
const RANKING_TTL = 21600; // 6시간
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const JSON_TYPE = 'application/json; charset=utf-8';
const UPSTREAM_TIMEOUT = 15000;

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

function applyParams(url, params) {
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
  return url;
}

async function relay(upstream) {
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': JSON_TYPE },
  });
}

async function handleYes24(request, env, ctx) {
  if (!env.YES24_API_KEY) return fail('프록시에 예스24 키가 설정되지 않았습니다.', 500, env);
  const { path, params } = await request.json();
  if (!YES24_PATHS.has(path)) return fail('지원하지 않는 요청입니다.', 400, env);

  // 키는 헤더로만 가므로 URL 을 그대로 캐시 키로 써도 키가 남지 않는다.
  const url = applyParams(new URL(`${YES24_BASE}/${path}`), params);
  const cache = caches.default;
  const cacheKey = new Request(url.toString());
  const hit = await cache.match(cacheKey);
  if (hit) return withCors(hit, env);

  const upstream = await fetch(url, {
    headers: { 'X-Api-Key': env.YES24_API_KEY },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  const res = await relay(upstream);
  if (upstream.ok) {
    res.headers.set('cache-control', `public, max-age=${RANKING_TTL}`);
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return withCors(res, env);
}

async function handleKakao(request, env) {
  if (!env.KAKAO_REST_KEY) return fail('프록시에 카카오 키가 설정되지 않았습니다.', 500, env);
  const { params } = await request.json();

  const upstream = await fetch(applyParams(new URL(KAKAO_URL), params), {
    headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
  });
  return withCors(await relay(upstream), env);
}

async function handleLibrary(request, env, ctx) {
  if (!env.LIBRARY_AUTH_KEY) return fail('프록시에 정보나루 키가 설정되지 않았습니다.', 500, env);
  const { method, params } = await request.json();
  if (!LIBRARY_METHODS.has(method)) return fail('지원하지 않는 요청입니다.', 400, env);

  const url = applyParams(new URL(`${LIBRARY_BASE}/${method}`), params);
  url.searchParams.set('format', 'json');

  // 캐시 키는 인증키를 붙이기 전 URL로 만든다. 키가 캐시에 남지 않도록.
  const cache = caches.default;
  const cacheKey = new Request(url.toString());
  const cacheable = method === 'loanItemSrch';
  if (cacheable) {
    const hit = await cache.match(cacheKey);
    if (hit) return withCors(hit, env);
  }

  url.searchParams.set('authKey', env.LIBRARY_AUTH_KEY);
  const upstream = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
  const res = await relay(upstream);
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
  return withCors(await relay(upstream), env);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });

    if (request.method !== 'POST') return fail('POST만 지원합니다.', 405, env);

    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/yes24') return await handleYes24(request, env, ctx);
      if (pathname === '/kakao') return await handleKakao(request, env);
      if (pathname === '/library') return await handleLibrary(request, env, ctx);
      if (pathname === '/claude') return await handleClaude(request, env);
      return fail('없는 경로입니다.', 404, env);
    } catch {
      return fail('프록시 요청에 실패했습니다.', 502, env);
    }
  },
};
