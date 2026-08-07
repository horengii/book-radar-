import { FETCH_TIMEOUT_MS, RANKING_SIZE } from './config.js';
import { getSettings } from './state.js';
import { stripTags } from './util.js';

async function callProxy(method, params) {
  const { proxyUrl } = getSettings();
  if (!proxyUrl) throw new Error('설정에서 프록시 주소를 먼저 입력해 주세요.');

  let res;
  try {
    res = await fetch(`${proxyUrl.replace(/\/+$/, '')}/aladin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, params }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new Error('알라딘에 연결하지 못했습니다. 프록시 주소와 네트워크를 확인해 주세요.');
  }
  if (!res.ok) throw new Error('알라딘 조회에 실패했습니다.');

  // output=js 응답은 끝에 세미콜론이 붙어 오는 경우가 있어 JSON.parse 전에 다듬는다.
  const text = (await res.text()).trim().replace(/;$/, '');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('알라딘 응답을 읽지 못했습니다.');
  }
  if (data.errorCode) throw new Error('알라딘이 요청을 거절했습니다. TTB 키를 확인해 주세요.');
  return data;
}

function toBook(item) {
  return {
    isbn13: item.isbn13 || item.isbn || '',
    itemId: item.itemId ?? null,
    title: item.title ?? '',
    author: item.author ?? '',
    publisher: item.publisher ?? '',
    pages: item.subInfo?.itemPage ?? null,
    cover: item.cover ?? '',
    link: item.link ?? '',
  };
}

export async function fetchRanking(cid) {
  const data = await callProxy('ItemList', {
    QueryType: 'Bestseller',
    CategoryId: cid,
    MaxResults: RANKING_SIZE,
    start: 1,
    SearchTarget: 'Book',
    Cover: 'MidBig',
  });
  return (data.item ?? []).map((item, index) => ({ ...toBook(item), rank: item.bestRank ?? index + 1 }));
}

export async function fetchDetail(isbn13) {
  const data = await callProxy('ItemLookUp', {
    ItemId: isbn13,
    ItemIdType: 'ISBN13',
    OptResult: 'Toc,fulldescription',
    Cover: 'MidBig',
  });
  const item = (data.item ?? [])[0];
  if (!item) return null;
  return {
    ...toBook(item),
    isbn13: item.isbn13 || isbn13,
    description: stripTags(item.fullDescription || item.description || ''),
    toc: stripTags(item.subInfo?.toc || ''),
  };
}

export async function searchBooks(query, max = 5) {
  const data = await callProxy('ItemSearch', {
    Query: query,
    QueryType: 'Keyword',
    MaxResults: max,
    start: 1,
    SearchTarget: 'Book',
  });
  return (data.item ?? []).map(toBook);
}
