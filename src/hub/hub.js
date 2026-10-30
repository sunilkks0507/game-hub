import { readProgress, createStore } from '../shared/storage.js';
import { registerServiceWorker } from '../shared/pwa.js';

const CATEGORY_LABELS = {
  'little-ones': 'Little Ones (4-6)',
  explorers: 'Explorers (7-10)',
  challengers: 'Challengers (11-16)',
  adults: 'Adults (17+)',
  family: 'Family',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const tabsEl = document.getElementById('tabs');
const gamesEl = document.getElementById('games');
const hubStore = createStore('hub');

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function categoriesOf(game) {
  return [game.category, ...(game.alsoIn || [])];
}

function card(game) {
  const progress = readProgress(game.id);
  const played = progress.played ? `Played ${progress.played} · Won ${progress.won}` : 'Not played yet';
  const badges = progress.badges.length ? ` · ${progress.badges.length} badge${progress.badges.length === 1 ? '' : 's'}` : '';
  const ages = game.ageMax >= 99 ? `Ages ${game.ageMin}+` : `Ages ${game.ageMin}-${game.ageMax}`;

  const icon = el('img', { class: 'card-icon', src: `${game.path}${game.icon}`, alt: '', width: '64', height: '64' });
  const body = el(
    'div',
    {},
    el('h2', { text: game.name }),
    el('p', { class: 'card-tagline', text: game.tagline }),
    el('p', { class: 'card-meta', text: `${ages} · ${game.players} player${game.players === '1' ? '' : 's'} · about ${game.minutesPerSession} min` }),
    el('p', { class: 'card-progress', text: played + badges }),
  );
  const play = el('a', { class: 'btn btn-primary', href: `${game.path}${game.entry}`, 'aria-label': `Play ${game.name}` }, 'Play');
  const article = el('article', { class: 'card' }, icon, body, play);
  return article;
}

function showCategory(games, category) {
  hubStore.set('tab', category);
  for (const tab of tabsEl.children) tab.setAttribute('aria-selected', String(tab.dataset.category === category));
  gamesEl.replaceChildren(...games.filter((g) => categoriesOf(g).includes(category)).map(card));
}

async function start() {
  let games = [];
  try {
    const response = await fetch('games/games.json');
    games = await response.json();
  } catch {
    gamesEl.replaceChildren(el('p', { class: 'hub-note', text: 'Could not load the game list. Check your connection and try again.' }));
    return;
  }

  const present = CATEGORY_ORDER.filter((c) => games.some((g) => categoriesOf(g).includes(c)));
  if (present.length === 0) {
    gamesEl.replaceChildren(el('p', { class: 'hub-note', text: 'No games yet.' }));
    return;
  }

  for (const category of present) {
    const tab = el('button', { class: 'chip', type: 'button', role: 'tab', 'data-category': category, 'aria-selected': 'false' }, CATEGORY_LABELS[category]);
    tab.addEventListener('click', () => showCategory(games, category));
    tabsEl.append(tab);
  }
  const remembered = hubStore.get('tab');
  showCategory(games, present.includes(remembered) ? remembered : present[0]);
}

registerServiceWorker();
start();
