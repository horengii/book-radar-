// 도서 데이터 공급원. 알라딘 OpenAPI 가 2026-10-30 종료되어 나뉘었다.
//   예스24 — 판매 베스트셀러 순위(페이지 수 포함)
//   카카오 책 검색 — 검색, ISBN13 단건 조회(소개글 포함), 추천 실존 검증
//   도서관 정보나루 — 인기대출 순위. 예스24 가 실패할 때만 쓴다
// 모두 Worker 프록시를 거친다. 예스24 는 CORS 를 주지 않고, 카카오는 CORS 를 열어주지만
// GitHub Pages 가 공개 호스팅이라 키를 소스에 박으면 그대로 노출되기 때문이다(4장).
import { FETCH_TIMEOUT_MS, RANKING_SIZE, RANKING_WINDOW_DAYS } from './config.js';
import { getSettings } from './state.js';
import { stripTags } from './util.js';

async function callProxy(path, body) {
  const { proxyUrl } = getSettings();
  if (!proxyUrl) throw new Error('설정에서 프록시 주소를 먼저 입력해 주세요.');

  let res;
  try {
    res = await fetch(`${proxyUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new Error('도서 정보를 불러오지 못했습니다. 프록시 주소와 네트워크를 확인해 주세요.');
  }
  if (!res.ok) throw new Error('도서 조회에 실패했습니다.');

  try {
    return await res.json();
  } catch {
    throw new Error('도서 정보를 읽지 못했습니다.');
  }
}

/* 카카오 책 검색 */

// isbn 필드는 "ISBN10 ISBN13" 공백 구분이지만 한쪽만 오기도 하고, 굿즈·비도서
// (팬사인회 상품 등)에는 ISBN 아닌 13자리 바코드가 들어온다. 위치로 자르면 안 된다 —
// 978/979 로 시작하는 13자리만 ISBN13 이다.
export function toIsbn13(raw) {
  for (const token of String(raw ?? '').split(/\s+/)) {
    if (/^97[89]\d{10}$/.test(token)) return token;
  }
  return '';
}

function fromKakao(doc) {
  return {
    isbn13: toIsbn13(doc.isbn),
    title: doc.title ?? '',
    author: (doc.authors ?? []).join(', '),
    publisher: doc.publisher ?? '',
    pages: null, // 카카오·정보나루 모두 페이지 수를 주지 않는다 — 예상 독서시간 불가
    cover: doc.thumbnail ?? '',
    link: doc.url ?? '',
  };
}

async function callKakao(params) {
  return callProxy('/kakao', { params });
}

export async function searchBooks(query, max = 5) {
  const data = await callKakao({ query, size: Math.min(Math.max(max, 1), 50) });
  return (data.documents ?? []).map(fromKakao).filter((book) => book.isbn13);
}

export async function fetchDetail(isbn13) {
  const data = await callKakao({ query: isbn13, target: 'isbn', size: 1 });
  const doc = (data.documents ?? [])[0];
  if (!doc) return null;

  return {
    ...fromKakao(doc),
    isbn13: toIsbn13(doc.isbn) || isbn13,
    description: stripTags(doc.contents ?? ''),
    toc: '', // 두 공급원 모두 목차를 주지 않는다
  };
}

/* 예스24 — 판매 베스트셀러 */

// 저자 표기가 공급원마다 다르다. 예스24 "무라카미 하루키 저/홍은주 역",
// 정보나루 "지은이: 한강" · "요한 하리 지음 ;김하현 옮김" · "글: 정문정 ;그림: 피도크".
// 역할 표기를 떼고 쉼표로 이어 카카오("구병모")와 같은 모양으로 맞춘다 —
// primaryAuthor 가 첫 저자만 쓰고, gate3 의 저자 일치 비교도 이 모양을 전제한다.
export function plainAuthors(raw) {
  return String(raw ?? '')
    .split(/[/;]/)
    .map((part) =>
      part
        .trim()
        .replace(/^[^:：]{1,6}[:：]\s*/, '')
        .replace(/\s*(저|글|그림|역|옮김|지음|편|편저|엮음|감수|원작|공저)$/, '')
        .trim(),
    )
    .filter(Boolean)
    .join(', ');
}

function fromYes24(item) {
  return {
    isbn13: toIsbn13(item.isbn13),
    title: item.title ?? '',
    author: plainAuthors(item.author),
    publisher: item.publisher ?? '',
    pages: Number(item.pages) || null,
    cover: item.cover ?? '',
    link: item.link ?? '',
    rank: Number(item.sortOrder) || null,
    source: 'yes24',
  };
}

async function fetchYes24Ranking(categoryId) {
  // detail=Y 여야 페이지 수가 온다 — 예상 독서시간(7.2)의 유일한 근거다.
  const params = { categoryId, pageSize: RANKING_SIZE, detail: 'Y' };
  const data = await callProxy('/yes24', { path: 'category/bestseller', params });
  if (!data.success) throw new Error(data.message || '예스24 순위를 불러오지 못했습니다.');

  return (data.data?.items ?? [])
    .map(fromYes24)
    .filter((book) => book.isbn13)
    .map((book, index) => ({ ...book, rank: book.rank ?? index + 1 }));
}

/* 도서관 정보나루 — 인기대출 순위(대체 경로) */

const LIBRARY_ERRORS = {
  vitalizationErr: '정보나루 인증키가 아직 활성화되지 않았습니다. 마이페이지에서 승인 상태를 확인해 주세요.',
  authErr: '정보나루 인증키가 올바르지 않습니다.',
};

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 대출 집계는 반영까지 시차가 있다. 창을 좁게 잡으면 빈 결과가 오므로 넉넉히 둔다.
function rankingWindow(today = new Date()) {
  const start = new Date(today);
  start.setDate(start.getDate() - RANKING_WINDOW_DAYS);
  return { startDt: ymd(start), endDt: ymd(today) };
}

function fromLibrary(doc) {
  return {
    isbn13: toIsbn13(doc.isbn13),
    // "안녕이라 그랬어 :김애란 소설" 처럼 KORMARC 부제가 " :" 뒤에 붙어 온다.
    title: String(doc.bookname ?? '').split(/\s+:/)[0].trim(),
    author: plainAuthors(doc.authors),
    publisher: doc.publisher ?? '',
    pages: null,
    cover: doc.bookImageURL ?? '',
    link: '',
    rank: Number(doc.ranking) || null,
    source: 'library',
  };
}

async function fetchLoanRanking(kdc) {
  const params = { ...rankingWindow(), pageNo: 1, pageSize: RANKING_SIZE };
  if (kdc) params.kdc = kdc; // 전체는 kdc 를 붙이지 않는다

  const data = await callProxy('/library', { method: 'loanItemSrch', params });
  const body = data.response ?? {};
  if (body.errCode) throw new Error(LIBRARY_ERRORS[body.errCode] ?? '정보나루 조회에 실패했습니다.');

  return (body.docs ?? [])
    .map((entry) => fromLibrary(entry.doc ?? {}))
    .filter((book) => book.isbn13)
    .map((book, index) => ({ ...book, rank: book.rank ?? index + 1 }));
}

// 알라딘이 종료되자 앱 전체가 멈췄다. 예스24 도 무료 API 라 같은 일이 생길 수 있어
// 대응이 깨끗한 분야만 대출 순위로 대신 보여준다. 둘 다 실패하면 예스24 의 사유를 보인다.
export async function fetchRanking(category) {
  try {
    return await fetchYes24Ranking(category.yes24Id);
  } catch (error) {
    if (!category.loanKdc) throw error;
    try {
      return await fetchLoanRanking(category.loanKdc === 'all' ? null : category.loanKdc);
    } catch {
      throw error;
    }
  }
}
