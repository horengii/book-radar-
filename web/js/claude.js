import { CLAUDE_API_URL, CLAUDE_TIMEOUT_MS, MAX_DESCRIPTION_CHARS, MAX_TOKENS, MODELS } from './config.js';
import { bumpUsage, getSettings, isUnderLimit } from './state.js';
import { tocHeadings, truncate } from './util.js';
import {
  RECOMMEND_SYSTEM,
  SUMMARY_SYSTEM,
  TASTE_SYSTEM,
  recommendUser,
  summaryUser,
  tasteUser,
} from './prompts.js';

// 모델이 펜스를 붙여 오는 경우가 있다. 실패하면 null — 재시도하지 않는다(T2.3).
function parseJson(text) {
  const cleaned = String(text ?? '')
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function call({ system, user, model, maxTokens, thinking = null }) {
  if (!isUnderLimit()) return { ok: false, reason: '이번 달 생성 한도에 도달했습니다.' };

  const { apiKey } = getSettings();
  if (!apiKey) return { ok: false, reason: '설정에서 Claude API 키를 먼저 입력해 주세요.' };

  const body = {
    model,
    max_tokens: maxTokens,
    // 시스템 프롬프트는 매 호출 동일하므로 캐시 대상으로 분리한다(T2.2).
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  };

  // Sonnet 5 는 thinking 을 생략하면 적응형 사고가 켜진다. max_tokens 가 작아
  // 사고 토큰이 답변을 밀어내면 JSON 이 잘려 파싱 실패 → 결과 0건이 된다.
  if (thinking) body.thinking = thinking;

  let res;
  try {
    res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'Claude에 연결하지 못했습니다.' };
  }

  // 401 과 403 을 합치면 "키가 틀렸다"는 오해를 부른다. 403 은 키는 맞는데 권한·정책 문제다.
  if (res.status === 401) return { ok: false, reason: 'API 키가 올바르지 않습니다.' };
  if (res.status === 403) return { ok: false, reason: '이 키로는 호출이 허용되지 않습니다(권한 또는 차단).' };
  if (res.status === 429) return { ok: false, reason: '요청이 몰렸습니다. 잠시 후 다시 열어 주세요.' };
  if (!res.ok) return { ok: false, reason: '생성 요청이 거절되었습니다. 크레딧 잔액을 확인해 주세요.' };

  const payload = await res.json().catch(() => null);
  const text = payload?.content?.find((block) => block.type === 'text')?.text;
  const parsed = parseJson(text);
  if (!parsed) return { ok: false, reason: '응답을 읽지 못했습니다.' };

  bumpUsage();
  return { ok: true, data: parsed };
}

/* 요약 + 태그 — 한 번에 생성한다(T2.2) */

export function buildSourceText(description, toc) {
  const headings = tocHeadings(toc);
  const body = truncate(description ?? '', MAX_DESCRIPTION_CHARS);
  return headings ? `${body}\n\n[목차]\n${headings}` : body;
}

export async function generateSummary(book, sourceText) {
  return call({
    system: SUMMARY_SYSTEM,
    user: summaryUser(book, sourceText),
    model: MODELS.summary,
    maxTokens: MAX_TOKENS.summary,
  });
}

/* 유사 도서 추천 — gate3 전 후보 목록만 만든다 */

export async function recommendSimilar(book, exclusionTitles) {
  return call({
    system: RECOMMEND_SYSTEM,
    user: recommendUser(book, exclusionTitles),
    model: MODELS.recommend,
    maxTokens: MAX_TOKENS.recommend,
    thinking: { type: 'disabled' },
  });
}

/* 취향 종합 필터 — 주어진 순위 목록 안에서만 고른다 */

export async function filterByTaste(profile, candidates, exclusionTitles) {
  return call({
    system: TASTE_SYSTEM,
    user: tasteUser(profile, candidates, exclusionTitles),
    model: MODELS.taste,
    maxTokens: MAX_TOKENS.taste,
  });
}
