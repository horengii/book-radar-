// ISBN13 추출은 2026-11-02 공급원 교체에서 새로 생긴 유일한 판정 로직이다.
// 카카오 응답에 굿즈·비도서가 섞여 들어오는 것을 실측으로 확인해 테스트로 고정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toIsbn13 } from '../web/js/books.js';

test('ISBN10 과 ISBN13 이 같이 오면 ISBN13 만 고른다', () => {
  assert.equal(toIsbn13('1141602458 9791141602451'), '9791141602451');
  assert.equal(toIsbn13('8974833263 9788974833268'), '9788974833268');
});

test('ISBN13 만 오고 앞에 공백이 붙어도 읽는다', () => {
  assert.equal(toIsbn13(' 9791191751079'), '9791191751079');
});

test('굿즈·비도서의 13자리 바코드는 ISBN 이 아니다', () => {
  // 교보 팬사인회 전용 상품 등. 978/979 로 시작하지 않는다.
  assert.equal(toIsbn13(' 2090000162042'), '');
  assert.equal(toIsbn13(' 4808974833268'), '');
  assert.equal(toIsbn13(' 2006145000040'), '');
});

test('위치가 아니라 패턴으로 고른다 — ISBN10 만 있으면 버린다', () => {
  assert.equal(toIsbn13('1141602458'), '');
});

test('빈 값과 잘못된 자릿수는 빈 문자열이다', () => {
  assert.equal(toIsbn13(''), '');
  assert.equal(toIsbn13(null), '');
  assert.equal(toIsbn13(undefined), '');
  assert.equal(toIsbn13('979114160245'), ''); // 12자리
  assert.equal(toIsbn13('97911416024510'), ''); // 14자리
});
