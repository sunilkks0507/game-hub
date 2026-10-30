// Original SVG pieces, drawn for this project. Six distinct silhouettes, so pieces are
// told apart by shape and never by colour alone. Fill and stroke come from CSS
// (.piece-w and .piece-b), so the same symbols serve both sides.

const SYMBOLS = {
  // Raja (king): a crown with three points and a small cross.
  K: `
    <path d="M22.5 3.5v7M19.5 7h6" fill="none"/>
    <path d="M10.5 38.5V18l7.5 6.5 4.5-10.5 4.5 10.5 7.5-6.5v20.5z"/>
    <path d="M9 38.5h27v3H9z"/>
    <path d="M15 33h15" fill="none"/>`,
  // Mantri (counsellor): a robed figure under a pointed hat.
  M: `
    <path d="M22.5 4l4.5 8.5h-9z"/>
    <path d="M16 12.5h13v4H16z"/>
    <path d="M15 38.5c0-9 2-17 7.5-19.5 5.500 2.500 7.500 10.500 7.500 19.500z"/>
    <path d="M10 38.5h25v3H10z"/>
    <path d="M22.5 22v9" fill="none"/>`,
  // Gaja (elephant): big ears, a head and a curled trunk with two tusks.
  G: `
    <circle cx="11.5" cy="20" r="6"/>
    <circle cx="33.5" cy="20" r="6"/>
    <path d="M13.5 18c0-6 4-9.500 9-9.500s9 3.500 9 9.500v9H13.500z"/>
    <path d="M19.500 24.500h6v11c0 2 1 3 3 3.500H16.500c2.500-.5 3-1.500 3-3.500z"/>
    <path d="M16.500 27l-3.500 6M28.500 27l3.500 6" fill="none"/>
    <path d="M18 17.500h0.100M27 17.500h0.100" fill="none" stroke-width="3"/>
    <path d="M10 38.500h25v3H10z"/>`,
  // Ashva (horse): a horse head in profile, facing left.
  A: `
    <path d="M12.500 38.500c0-9 2.500-16 9-21.500l-5.500-2 .5-5.500 6 3 3.500-4 1.500 4.500c6 3 9.500 9 9.500 17v8.500z"/>
    <path d="M17.500 16.500c-3 2-5 4.500-6 8l4 2" fill="none"/>
    <path d="M20.500 17.500h0.100" fill="none" stroke-width="3"/>
    <path d="M10 38.500h25v3H10z"/>`,
  // Ratha (chariot): a battlement tower.
  R: `
    <path d="M11 21V10h5v3.500h4V10h5v3.500h4V10h5v11z"/>
    <path d="M14 36V21h17v15z"/>
    <path d="M19.500 36v-7h6v7" fill="none"/>
    <path d="M10 36h25v4H10z"/>`,
  // Padati (foot soldier): a round head on a bell-shaped body.
  P: `
    <circle cx="22.500" cy="14" r="5.500"/>
    <path d="M13.500 37c0-8 4-13 9-13s9 5 9 13z"/>
    <path d="M11 37h23v3H11z"/>`,
};

// The hidden sprite sheet. Pieces are drawn with <svg><use href="#piece-K"/></svg>.
export function spriteMarkup() {
  const symbols = Object.entries(SYMBOLS)
    .map(
      ([type, body]) =>
        `<symbol id="piece-${type}" viewBox="0 0 45 45"><g stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${body}</g></symbol>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>`;
}

export function installSprite(doc = document) {
  if (doc.getElementById('piece-K')) return;
  const holder = doc.createElement('div');
  holder.innerHTML = spriteMarkup();
  doc.body.prepend(holder.firstElementChild);
}

// An inline piece icon for use in text, e.g. the rules card.
export function pieceIconMarkup(side, type, size = 36) {
  return `<svg class="piece piece-${side}" width="${size}" height="${size}" viewBox="0 0 45 45" aria-hidden="true" focusable="false"><use href="#piece-${type}"/></svg>`;
}
