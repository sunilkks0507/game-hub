// Plays the events from engine.applyMove(..., { record: true }) one step at a time, so the
// child can watch each seed drop and count along. Used by the game and by the tutorial.
//
// render(view, info)   view = { pits, stores, hand }, info = { active, kind }
// isSkipped()          true when the player tapped to fast-forward, or reduced motion is on
// isCancelled()        true when the screen was left, so animating should stop quietly
// Resolves true when finished, false when cancelled.

export const DELAYS = { pick: 260, sow: 190, relay: 340, capture: 600, stop: 250 };
const MIN_SOW_DELAY = 60;

export async function animate({ start, events, mover, render, sound, isSkipped, isCancelled }) {
  const pits = start.pits.slice();
  const stores = start.stores.slice();
  let hand = 0;
  let sowCount = 0; // seeds sown from the current hand (raises the pitch)
  let moveSows = 0; // seeds sown in the whole move (long chains speed up)

  const frame = (active, kind) => {
    if (!isSkipped()) render({ pits: pits.slice(), stores: stores.slice(), hand }, { active, kind });
  };
  const pause = (ms) =>
    isSkipped() ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

  for (const e of events) {
    if (isCancelled()) return false;
    if (e.t === 'pick' || e.t === 'relay') {
      pits[e.pit] = 0;
      hand = e.n;
      sowCount = 0;
      if (!isSkipped()) sound.play('pick');
      frame(e.pit, e.t);
      await pause(e.t === 'pick' ? DELAYS.pick : DELAYS.relay);
    } else if (e.t === 'sow') {
      pits[e.pit] += 1;
      hand = e.hand;
      if (!isSkipped()) sound.play('seed', sowCount);
      sowCount += 1;
      moveSows += 1;
      frame(e.pit, 'sow');
      await pause(Math.max(MIN_SOW_DELAY, DELAYS.sow - moveSows * 3));
    } else if (e.t === 'capture') {
      pits[e.pit] = 0;
      stores[mover] += e.n;
      hand = 0;
      if (!isSkipped()) sound.play('capture');
      frame(e.pit, 'capture');
      await pause(DELAYS.capture);
    } else if (e.t === 'stop') {
      frame(-1, 'stop');
      await pause(DELAYS.stop);
    }
  }
  return !isCancelled();
}
