// ISBN13 추출은 2026-11-02 공급원 교체에서 새로 생긴 유일한 판정 로직이다.
// 카카오 응답에 굿즈·비도서가 섞여 들어오는 것을 실측으로 확인해 테스트로 고정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanToc, plainAuthors, toIsbn13 } from '../web/js/normalize.js';

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

// 예스24 저자 표기는 2026-11-09 실제 응답에서 가져왔다.
test('예스24 저자 표기에서 역할을 떼고 쉼표로 잇는다', () => {
  assert.equal(plainAuthors('무라카미 하루키 저/홍은주 역'), '무라카미 하루키, 홍은주');
  assert.equal(plainAuthors('앤 카슨 저/민승남 역'), '앤 카슨, 민승남');
  assert.equal(plainAuthors('양귀자 저'), '양귀자');
});

test('예스24 저자 첫 이름이 다른 공급원과 같은 모양이 된다', () => {
  // primaryAuthor 는 쉼표 앞 첫 저자만 쓴다. 카카오는 "구병모" 처럼 이름만 준다.
  assert.equal(plainAuthors('헤르만 헤세 저/박병덕 역').split(',')[0], '헤르만 헤세');
});

test('예스24 저자가 비어 있으면 빈 문자열이다', () => {
  assert.equal(plainAuthors(''), '');
  assert.equal(plainAuthors(null), '');
});

// 정보나루 저자 표기는 2026-11-09 인기대출 실제 응답에서 가져왔다.
test('정보나루 저자 표기에서 역할 접두·접미를 뗀다', () => {
  assert.equal(plainAuthors('지은이: 한강'), '한강');
  assert.equal(plainAuthors('강용수 지음'), '강용수');
  assert.equal(plainAuthors('요한 하리 지음 ;김하현 옮김'), '요한 하리, 김하현');
  assert.equal(plainAuthors('글: 정문정 ;그림: 피도크'), '정문정, 피도크');
  assert.equal(plainAuthors('지은이: 마이클 샌델 ;옮긴이: 김명철'), '마이클 샌델, 김명철');
  assert.equal(plainAuthors('글·그림: 한날'), '한날');
});

test('공동 저자는 첫 저자가 맨 앞에 남는다', () => {
  assert.equal(plainAuthors('신영준,고영성 지음').split(',')[0], '신영준');
});

// 예스24 목차는 2026-11-10 itemDetail 실제 응답(가호)에서 가져왔다.
test('목차 줄 끝의 쪽 번호를 뗀다 — gate2 에 근거 없는 숫자를 주지 않는다', () => {
  const raw = '1장 가호와 모터사이클 남자 007\r\n2장 무사시사카이의 개미핥기 035\r\n3장 가호와 흰개미 여왕 119';
  assert.equal(cleanToc(raw), '1장 가호와 모터사이클 남자\n2장 무사시사카이의 개미핥기\n3장 가호와 흰개미 여왕');
});

test('목차의 HTML 줄바꿈과 점선 쪽 번호도 정리한다', () => {
  assert.equal(cleanToc('제1부 깨달음<br/>제2부 강물 ……… 85'), '제1부 깨달음\n제2부 강물');
});

test('장 번호는 줄 앞에 있으므로 남는다', () => {
  assert.equal(cleanToc('1장 시작'), '1장 시작');
});
