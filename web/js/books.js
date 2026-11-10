// 도서 데이터 공급원. 알라딘 OpenAPI 가 2026-10-30 종료되어 나뉘었다.
//   예스24 — 판매 베스트셀러 순위, ISBN13 상세(소개글·목차·페이지 수)
//   카카오 책 검색 — 검색, 추천 실존 검증, 예스24 에 소개글이 없을 때 대신 쓰는 소개글
//   도서관 정보나루 — 인기대출 순위. 예스24 가 실패할 때만 쓴다
// 모두 Worker 프록시를 거친다. 예스24 는 CORS 를 주지 않고, 카카오는 CORS 를 열어주지만
// GitHub Pages 가 공개 호스팅이라 키를 소스에 박으면 그대로 노출되기 때문이다(4장).
import { FETCH_TIMEOUT_MS, RANKING_SIZE, RANKING_WINDOW_DAYS } from './config.js';
import { getSettings } from './state.js';
import { cleanToc, plainAuthors, toIsbn13 } from './normalize.js';
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

async function fetchKakaoDetail(isbn13) {
  const data = await callKakao({ query: isbn13, target: 'isbn', size: 1 });
  const doc = (data.documents ?? [])[0];
  if (!doc) return null;

  return {
    ...fromKakao(doc),
    isbn13: toIsbn13(doc.isbn) || isbn13,
    description: stripTags(doc.contents ?? ''),
    toc: '', // 카카오는 목차를 주지 않는다
  };
}

// 요약 근거는 예스24 소개글(310~480자, 실측)을 먼저 쓴다. 카카오(250자 내외)의 두 배다.
// 예스24 소개글이 빈 책이 있어(싯다르타 등) 그때는 카카오 소개글만 빌리고, 페이지 수·목차·
// 상품 링크는 예스24 것을 살린다. 예스24 에 아예 없는 책은 카카오만으로 간다.
export async function fetchDetail(isbn13) {
  let yes24 = null;
  try {
    yes24 = await fetchYes24Detail(isbn13);
  } catch {
    yes24 = null; // 예스24 는 우선 공급원일 뿐이다. 실패해도 카카오로 넘어간다
  }
  if (yes24?.description) return yes24;

  let kakao = null;
  try {
    kakao = await fetchKakaoDetail(isbn13);
  } catch (error) {
    if (!yes24) throw error;
  }
  if (!yes24) return kakao;
  return { ...yes24, description: kakao?.description ?? '' };
}

/* 예스24 — 판매 베스트셀러 */

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

async function fetchYes24Detail(isbn13) {
  const params = { searchType: 'ISBN13', query: isbn13, detail: 'Y' }; // detail=Y 여야 페이지 수가 온다
  const data = await callProxy('/yes24', { path: 'goods/itemDetail', params });
  const item = data.success ? (data.data?.items ?? [])[0] : null;
  if (!item) return null;

  const content = item.contentDetail ?? {};
  const { rank, ...book } = fromYes24(item); // 순위는 상세 캐시에 남기지 않는다
  return {
    ...book,
    isbn13: book.isbn13 || isbn13,
    description: stripTags(content.bookIntroduction || content.bookSummary || ''),
    toc: cleanToc(content.tableOfContents ?? ''),
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
