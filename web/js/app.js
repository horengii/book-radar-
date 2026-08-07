// 진입점 — 화면 전환과 각 화면 초기화만 담당한다.
import { load } from './state.js';
import * as ranking from './ui/ranking.js';
import * as library from './ui/library.js';
import * as search from './ui/search.js';
import * as taste from './ui/taste.js';

const SCREENS = ['ranking', 'search', 'library', 'settings', 'detail'];
const TABS = ['ranking', 'search', 'library', 'settings'];

function parseHash() {
  const [name, param] = window.location.hash.replace('#', '').split('/');
  return { name: SCREENS.includes(name) ? name : 'ranking', param: param ?? null };
}

function showScreen(name) {
  for (const screen of SCREENS) {
    document.getElementById(`screen-${screen}`).hidden = screen !== name;
  }
  // 상세는 탭이 아니므로 진입 직전 탭 표시를 유지한다.
  if (TABS.includes(name)) {
    for (const btn of document.querySelectorAll('[data-nav]')) {
      btn.setAttribute('aria-current', btn.dataset.nav === name ? 'page' : 'false');
    }
  }
  window.scrollTo(0, 0);
}

async function route() {
  const { name, param } = parseHash();
  showScreen(name);

  if (name === 'library') library.render();
  if (name === 'ranking') ranking.refresh();
  if (name === 'detail') {
    const detail = await import('./ui/detail.js');
    await detail.render(param);
  }
  if (name === 'settings') {
    const settings = await import('./ui/settings.js');
    settings.render();
  }
}

function init() {
  load();

  for (const btn of document.querySelectorAll('[data-nav]')) {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.nav;
    });
  }
  document.getElementById('detail-back').addEventListener('click', () => window.history.back());

  window.addEventListener('hashchange', route);
  ranking.init();
  search.init();
  taste.init();
  route();
}

init();
