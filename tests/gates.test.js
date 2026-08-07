import test from 'node:test';
import assert from 'node:assert/strict';

import { gate1_canGenerate, gate2_verifyOutput, gate3_verifyExists } from '../web/js/gates.js';
import { MIN_SOURCE_CHARS } from '../web/js/config.js';

const LONG = '이 책은 국민연금 수령 시기를 늦추면 연금액이 늘어난다는 점을 설명한다. '.repeat(6);

// 임계값을 하드코딩하지 않고 설정값 기준으로 경계를 만든다 — 값이 바뀌어도 테스트가 안 깨진다.
test('gate1 — 근거가 기준 미만이면 생성하지 않는다', () => {
  assert.equal(gate1_canGenerate('짧은 소개글', ''), false);
  assert.equal(gate1_canGenerate('', ''), false);
  assert.equal(gate1_canGenerate(null, undefined), false);
  assert.equal(gate1_canGenerate('ㄱ'.repeat(MIN_SOURCE_CHARS - 1), ''), false);
});

test('gate1 — 소개글과 목차를 합쳐 기준을 넘으면 생성한다', () => {
  const half = 'ㄱ'.repeat(Math.ceil(MIN_SOURCE_CHARS / 2));
  assert.equal(gate1_canGenerate(half, half), true);
  assert.equal(gate1_canGenerate('ㄱ'.repeat(MIN_SOURCE_CHARS), ''), true);
  assert.equal(gate1_canGenerate(LONG, ''), true);
});

test('gate1 — 공백만 있는 텍스트는 근거로 치지 않는다', () => {
  assert.equal(gate1_canGenerate(' '.repeat(400), ''), false);
});

test('gate2 — 원문에 없는 숫자가 든 요약은 폐기한다', () => {
  const source = '저자는 은퇴 후 국민연금 수령 시기를 늦추는 전략을 설명한다.';
  assert.equal(gate2_verifyOutput('연금을 5년 늦추면 수령액이 36% 늘어난다', source), null);
});

test('gate2 — 원문에 있는 숫자는 통과시킨다', () => {
  const source = '연금을 5년 늦추면 수령액이 36% 늘어난다고 저자는 말한다.';
  const field = '수령 시기를 5년 늦추면 36% 증가';
  assert.equal(gate2_verifyOutput(field, source), field);
});

test('gate2 — 쉼표 표기가 달라도 같은 숫자로 본다', () => {
  const source = '월 1,200만 원의 현금흐름을 만드는 방법을 다룬다.';
  const field = '월 1200만 원 현금흐름 만들기';
  assert.equal(gate2_verifyOutput(field, source), field);
});

test('gate2 — 원문에 없는 인명이 든 요약은 폐기한다', () => {
  const source = '저자는 30년간의 상담 경험을 바탕으로 노후 준비 방법을 정리했다.';
  assert.equal(gate2_verifyOutput('김철수 교수가 제안한 30년 노후 설계법', source), null);
});

test('gate2 — 원문에 없는 기관·상품명이 든 요약은 폐기한다', () => {
  const source = '저자는 연금 제도의 구조를 설명한다.';
  assert.equal(gate2_verifyOutput('삼성전자 퇴직연금 사례로 배우는 연금 구조', source), null);
  assert.equal(gate2_verifyOutput('Bloomberg 자료로 본 연금 구조', source), null);
});

test('gate2 — 원문에 있는 고유명사는 통과시킨다', () => {
  const source = '김영하 작가는 여행의 이유를 이렇게 설명한다. 국민연금공단 자료도 인용한다.';
  const field = '김영하 작가가 국민연금공단 자료로 설명하는 여행';
  assert.equal(gate2_verifyOutput(field, source), field);
});

test('gate2 — 원문 내용만으로 구성된 요약은 그대로 통과한다', () => {
  const source = '이 책은 은퇴 준비의 순서를 정리한다. 지출 점검이 먼저이고 투자는 그다음이다.';
  const field = '은퇴 준비는 지출 점검이 먼저다';
  assert.equal(gate2_verifyOutput(field, source), field);
});

test('gate2 — 배열 필드는 항목별로 검사해 통과분만 남긴다', () => {
  const source = '이 책은 지출 점검을 먼저 하라고 말한다. 투자는 그다음이다.';
  const result = gate2_verifyOutput(['지출 점검이 먼저다', '연 12% 수익을 노려라', '투자는 그다음이다'], source);
  assert.deepEqual(result, ['지출 점검이 먼저다', '투자는 그다음이다']);
});

test('gate2 — 통과 항목이 하나도 없는 배열은 null 이다', () => {
  assert.equal(gate2_verifyOutput(['연 12% 수익', '2030년 전망'], '지출을 점검하라.'), null);
});

test('gate2 — 빈 값과 근거 없는 호출은 null 이다', () => {
  assert.equal(gate2_verifyOutput('', '원문'), null);
  assert.equal(gate2_verifyOutput(null, '원문'), null);
  assert.equal(gate2_verifyOutput('무언가', ''), null);
});

function fakeAladin(catalog) {
  return {
    calls: 0,
    async searchBooks(query) {
      this.calls += 1;
      return catalog.filter((book) => query.split(' ').some((word) => word && book.title.includes(word)));
    },
  };
}

test('gate3 — 실존하지 않는 추천 도서는 제외한다', async () => {
  const client = fakeAladin([{ isbn13: '1', title: '연금의 정석', author: '박연금 (지은이)', publisher: 'ㄱ' }]);
  const passed = await gate3_verifyExists(
    [
      { title: '연금의 정석', author: '박연금' },
      { title: '존재하지않는책', author: '허구저자' },
    ],
    client,
  );
  assert.equal(passed.length, 1);
  assert.equal(passed[0].isbn13, '1');
});

test('gate3 — 제목은 맞아도 저자가 다르면 제외한다', async () => {
  const client = fakeAladin([{ isbn13: '2', title: '연금의 정석', author: '박연금 (지은이)' }]);
  const passed = await gate3_verifyExists([{ title: '연금의 정석', author: '김다른' }], client);
  assert.deepEqual(passed, []);
});

test('gate3 — 부제가 붙어도 제목 유사도 0.8 이상이면 통과한다', async () => {
  const client = fakeAladin([{ isbn13: '3', title: '연금의 정석 (개정판)', author: '박연금 (지은이)' }]);
  const passed = await gate3_verifyExists([{ title: '연금의 정석', author: '박연금' }], client);
  assert.equal(passed.length, 1);
  assert.equal(passed[0].title, '연금의 정석 (개정판)');
});

test('gate3 — 조회가 실패해도 던지지 않고 해당 후보만 버린다', async () => {
  const client = {
    async searchBooks() {
      throw new Error('알라딘 조회에 실패했습니다.');
    },
  };
  assert.deepEqual(await gate3_verifyExists([{ title: '연금의 정석', author: '박연금' }], client), []);
});

test('gate3 — 빈 후보 목록은 빈 배열이다', async () => {
  const client = fakeAladin([]);
  assert.deepEqual(await gate3_verifyExists([], client), []);
  assert.equal(client.calls, 0);
});
