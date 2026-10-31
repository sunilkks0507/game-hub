/**
 * Pebble Pals: Smart Heuristic AI Bot
 * Evaluates tactical captures, Atari defense/attack, and territory expansion.
 */

class HeuristicBot {
  constructor(difficulty = 'smart') {
    this.difficulty = difficulty;
  }

  evaluateMove(engine, r, c, player) {
    const activeColor = player.colorId;
    const size = engine.boardSize;

    // Check legality first
    const check = engine.checkMoveLegality(r, c, activeColor);
    if (!check.legal) return -999999;

    // Territory Guard: strictly avoid playing inside own securely enclosed eyes
    if (check.isEnclosedSelf) {
      return -1000;
    }

    let score = 0;

    // 1. Center / Balanced Position preference
    const center = (size - 1) / 2;
    const distCenter = Math.abs(r - center) + Math.abs(c - center);
    score += (size - distCenter) * 1.5;

    // 2. Capturing Opponent Groups in Atari (+100 per stone captured)
    if (check.capturedCount > 0) {
      score += check.capturedCount * 100;
    }

    // 3. Check Atari Defense (Saving own friendly groups)
    // Find friendly groups before move
    const friendlyNeighborGroupsInAtari = [];
    const neighbors = engine.getOrthogonalNeighbors(r, c);
    neighbors.forEach(([nr, nc]) => {
      const stone = engine.stones[nr][nc];
      if (stone && stone.colorId === activeColor) {
        const grp = engine.getGroupAt(nr, nc);
        if (grp && grp.isAtari) {
          friendlyNeighborGroupsInAtari.push(grp);
        }
      }
    });

    // 4. Simulate the move on a cloned board
    const simStones = engine.stones.map(row => row.map(cell => (cell ? { ...cell } : null)));
    const simSplash = engine.splashOwner.map(row => [...row]);

    simStones[r][c] = { colorId: activeColor, playerId: player.id, teamId: player.teamId };

    // Apply captured stones in simulation
    if (check.capturedGroups && check.capturedGroups.length > 0) {
      check.capturedGroups.forEach(grp => {
        grp.stones.forEach(([cr, cc]) => {
          simStones[cr][cc] = null;
          simSplash[cr][cc] = activeColor;
        });
      });
    }

    // Check new group liberties
    const newGroup = engine.getGroupAt(r, c, simStones);
    const newLiberties = newGroup ? newGroup.liberties.size : 0;

    // A. Saving own group in Atari: if a neighbor group was in Atari and now has >= 2 liberties
    if (friendlyNeighborGroupsInAtari.length > 0 && newLiberties >= 2) {
      score += 85;
    }

    // B. Self-Atari Penalty: If our new group has only 1 liberty and we didn't capture 2+ stones
    if (newLiberties === 1 && check.capturedCount < 2) {
      score -= 500; // Major mistake, avoid!
    }

    // C. Putting Opponent in Atari (+40)
    neighbors.forEach(([nr, nc]) => {
      if (simStones[nr][nc] && simStones[nr][nc].colorId !== activeColor) {
        const oppGrp = engine.getGroupAt(nr, nc, simStones);
        if (oppGrp && oppGrp.liberties.size === 1) {
          score += 40;
        }
      }
    });

    // D. Connecting to friendly stones (+20)
    let friendlyNeighborsCount = 0;
    neighbors.forEach(([nr, nc]) => {
      if (engine.stones[nr][nc] && engine.stones[nr][nc].colorId === activeColor) {
        friendlyNeighborsCount++;
      }
    });
    if (friendlyNeighborsCount > 0) {
      score += friendlyNeighborsCount * 18;
    }

    // E. Territory Expansion Delta (+50 per newly claimed/enclosed space)
    try {
      const currentTerritory = engine.computeTerritory();
      const currentScore = currentTerritory.scores[activeColor] || 0;

      const simTerritory = engine.computeTerritory(simStones, simSplash);
      const simulatedScore = simTerritory.scores[activeColor] || 0;

      const territoryDelta = simulatedScore - currentScore;
      if (territoryDelta > 1) {
        // Enclosed extra empty spaces!
        score += (territoryDelta - 1) * 50;
      }
    } catch (e) {
      // Fallback safe
    }

    // F. Small random jitter (+0 to 4.5) to avoid robotic identical games
    score += Math.random() * 4.5;

    return score;
  }

  findBestMove(engine, player) {
    const size = engine.boardSize;
    let bestScore = -Infinity;
    let bestMove = null;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (engine.stones[r][c] === null) {
          const score = this.evaluateMove(engine, r, c, player);
          if (score > bestScore) {
            bestScore = score;
            bestMove = { r, c, score };
          }
        }
      }
    }

    // If all moves are suicidal or extremely negative (< -300), pass!
    if (bestMove && bestMove.score < -250) {
      return null;
    }

    return bestMove;
  }
}

window.HeuristicBot = HeuristicBot;
