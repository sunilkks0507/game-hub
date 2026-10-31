/**
 * Pebble Pals: Territory Quest - Core Game Engine
 * Implements "Space is King" Go Rules for Kids
 */

const THEMES = {
  'ocean-blue': {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    mascot: 'Bubbles',
    color: '#0284C7',
    secondary: '#38BDF8',
    light: '#E0F2FE',
    border: '#0369A1',
    face: 'happy-round',
    decoration: 'starfish'
  },
  'coral-red': {
    id: 'coral-red',
    name: 'Coral Red',
    mascot: 'Pip',
    color: '#E11D48',
    secondary: '#FB7185',
    light: '#FFE4E6',
    border: '#BE123C',
    face: 'star-eyes',
    decoration: 'coral-flower'
  },
  'sunny-gold': {
    id: 'sunny-gold',
    name: 'Sunny Gold',
    mascot: 'Sunny',
    color: '#EAB308',
    secondary: '#FDE047',
    light: '#FEF9C3',
    border: '#CA8A04',
    face: 'wink',
    decoration: 'sunflower'
  },
  'emerald-green': {
    id: 'emerald-green',
    name: 'Emerald Green',
    mascot: 'Sprout',
    color: '#16A34A',
    secondary: '#4ADE80',
    light: '#DCFCE7',
    border: '#15803D',
    face: 'glasses',
    decoration: 'clover'
  },
  'royal-purple': {
    id: 'royal-purple',
    name: 'Royal Purple',
    mascot: 'Sparkle',
    color: '#9333EA',
    secondary: '#C084FC',
    light: '#F3E8FF',
    border: '#7E22CE',
    face: 'sparkle',
    decoration: 'crystal'
  },
  'midnight-slate': {
    id: 'midnight-slate',
    name: 'Midnight Slate',
    mascot: 'Zen Panda',
    color: '#1E293B',
    secondary: '#64748B',
    light: '#F1F5F9',
    border: '#0F172A',
    face: 'panda',
    decoration: 'bamboo'
  }
};

class GameEngine {
  constructor(config = {}) {
    this.boardSize = config.boardSize || 5; // 5, 7, 9
    this.mode = config.mode || '2-player'; // '2-player', '3-player', '4-ffa', '2v2-team'
    this.boardStyle = config.boardStyle || 'boxes'; // 'boxes' or 'lines'
    this.players = config.players || [];
    this.turnIndex = 0;
    this.consecutivePasses = 0;
    this.isGameOver = false;
    this.winner = null;

    // Board arrays
    this.stones = [];
    this.splashOwner = [];
    this.poppedCounters = {}; // colorId -> count
    this.history = []; // stack of snapshots for undo

    this.initBoard();
  }

  initBoard() {
    this.stones = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
    this.splashOwner = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
    this.poppedCounters = {};
    this.players.forEach(p => {
      this.poppedCounters[p.colorId] = 0;
    });
    this.history = [];
    this.turnIndex = 0;
    this.consecutivePasses = 0;
    this.isGameOver = false;
    this.winner = null;
  }

  getCurrentPlayer() {
    return this.players[this.turnIndex];
  }

  getOrthogonalNeighbors(r, c, size = this.boardSize) {
    const neighbors = [];
    if (r > 0) neighbors.push([r - 1, c]);
    if (r < size - 1) neighbors.push([r + 1, c]);
    if (c > 0) neighbors.push([r, c - 1]);
    if (c < size - 1) neighbors.push([r, c + 1]);
    return neighbors;
  }

  // Find all groups on the board
  // Returns array of group objects: { id, colorId, stones: [[r,c],...], liberties: Set("r,c"), isAtari: boolean }
  getGroups(customStones = null) {
    const stones = customStones || this.stones;
    const size = stones.length;
    const visited = Array(size).fill(null).map(() => Array(size).fill(false));
    const groups = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (stones[r][c] !== null && !visited[r][c]) {
          const colorId = stones[r][c].colorId;
          const groupStones = [];
          const liberties = new Set();
          const queue = [[r, c]];
          visited[r][c] = true;

          while (queue.length > 0) {
            const [cr, cc] = queue.shift();
            groupStones.push([cr, cc]);

            const neighbors = this.getOrthogonalNeighbors(cr, cc, size);
            for (const [nr, nc] of neighbors) {
              if (stones[nr][nc] === null) {
                liberties.add(`${nr},${nc}`);
              } else if (stones[nr][nc].colorId === colorId && !visited[nr][nc]) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
              }
            }
          }

          groups.push({
            id: `grp_${r}_${c}`,
            colorId,
            stones: groupStones,
            liberties,
            isAtari: liberties.size === 1
          });
        }
      }
    }

    return groups;
  }

  // Get a single group containing stone at (r, c)
  getGroupAt(r, c, customStones = null) {
    const stones = customStones || this.stones;
    if (!stones[r] || !stones[r][c]) return null;
    const colorId = stones[r][c].colorId;
    const size = stones.length;
    const visited = Array(size).fill(null).map(() => Array(size).fill(false));
    const groupStones = [];
    const liberties = new Set();
    const queue = [[r, c]];
    visited[r][c] = true;

    while (queue.length > 0) {
      const [cr, cc] = queue.shift();
      groupStones.push([cr, cc]);

      const neighbors = this.getOrthogonalNeighbors(cr, cc, size);
      for (const [nr, nc] of neighbors) {
        if (stones[nr][nc] === null) {
          liberties.add(`${nr},${nc}`);
        } else if (stones[nr][nc].colorId === colorId && !visited[nr][nc]) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    return {
      colorId,
      stones: groupStones,
      liberties,
      isAtari: liberties.size === 1
    };
  }

  // Flood-Fill Unified Territory Calculation ("Space is King")
  computeTerritory(customStones = null, customSplash = null) {
    const stones = customStones || this.stones;
    const splash = customSplash || this.splashOwner;
    const size = stones.length;
    const visited = Array(size).fill(null).map(() => Array(size).fill(false));
    const emptyComponents = [];

    // 1. Group contiguous empty spaces
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (stones[r][c] === null && !visited[r][c]) {
          const comp = [];
          const touchingColors = new Set();
          const queue = [[r, c]];
          visited[r][c] = true;

          while (queue.length > 0) {
            const [cr, cc] = queue.shift();
            comp.push([cr, cc]);

            const neighbors = this.getOrthogonalNeighbors(cr, cc, size);
            for (const [nr, nc] of neighbors) {
              if (stones[nr][nc] === null) {
                if (!visited[nr][nc]) {
                  visited[nr][nc] = true;
                  queue.push([nr, nc]);
                }
              } else {
                touchingColors.add(stones[nr][nc].colorId);
              }
            }
          }

          emptyComponents.push({ cells: comp, touchingColors });
        }
      }
    }

    // 2. Map cell ownership
    const cellOwnership = Array(size).fill(null).map(() => Array(size).fill(null));

    // A. Occupied cells (pebbles)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (stones[r][c] !== null) {
          cellOwnership[r][c] = {
            ownerColor: stones[r][c].colorId,
            type: 'occupied',
            playerId: stones[r][c].playerId,
            teamId: stones[r][c].teamId
          };
        }
      }
    }

    // Count how many distinct colors have stones on the board
    const colorsOnBoard = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (stones[r][c] !== null) {
          colorsOnBoard.add(stones[r][c].colorId);
        }
      }
    }

    // B. Empty regions: Enclosed, Splash, or Neutral
    for (const comp of emptyComponents) {
      if (comp.touchingColors.size === 1) {
        // Touches only one color!
        const enclosedColor = Array.from(comp.touchingColors)[0];
        let isEnclosed = true;

        // If this is the only color on the board (e.g. Move 1, or solo lesson),
        // verify that the empty component is an enclosed pocket, not the vast open board touching all 4 edges!
        if (colorsOnBoard.size <= 1) {
          let touchesTop = false, touchesBottom = false, touchesLeft = false, touchesRight = false;
          for (const [cr, cc] of comp.cells) {
            if (cr === 0) touchesTop = true;
            if (cr === size - 1) touchesBottom = true;
            if (cc === 0) touchesLeft = true;
            if (cc === size - 1) touchesRight = true;
          }
          if (touchesTop && touchesBottom && touchesLeft && touchesRight) {
            // This is the open field, not an enclosed pocket!
            isEnclosed = false;
          }
        }

        if (isEnclosed) {
          for (const [cr, cc] of comp.cells) {
            cellOwnership[cr][cc] = {
              ownerColor: enclosedColor,
              type: 'enclosed'
            };
          }
        } else {
          // Open garden field (Check if previously splashed from capture, otherwise neutral)
          for (const [cr, cc] of comp.cells) {
            const splashColor = splash[cr][cc];
            if (splashColor) {
              cellOwnership[cr][cc] = {
                ownerColor: splashColor,
                type: 'splash'
              };
            } else {
              cellOwnership[cr][cc] = {
                ownerColor: null,
                type: 'neutral'
              };
            }
          }
        }
      } else {
        // Contested / neutral region (touching >= 2 colors, or empty board)
        for (const [cr, cc] of comp.cells) {
          const splashColor = splash[cr][cc];
          if (splashColor) {
            cellOwnership[cr][cc] = {
              ownerColor: splashColor,
              type: 'splash'
            };
          } else {
            cellOwnership[cr][cc] = {
              ownerColor: null,
              type: 'neutral'
            };
          }
        }
      }
    }

    // C. Calculate scores:
    // 1 Point per occupied pebble spot
    // 1 Point per captured/enclosed territory space (enclosed + splash)
    // 2 Points for each captured opponent pebble by surrounding
    const colorSpaces = {};
    const colorPebbles = {};
    const colorEnclosed = {};
    const colorSplash = {};
    const colorCapturePoints = {};
    const colorScores = {};
    const teamScores = {};
    let neutralCount = 0;

    // Initialize all active colors with 0
    this.players.forEach(p => {
      colorSpaces[p.colorId] = 0;
      colorPebbles[p.colorId] = 0;
      colorEnclosed[p.colorId] = 0;
      colorSplash[p.colorId] = 0;
      colorCapturePoints[p.colorId] = (this.poppedCounters[p.colorId] || 0) * 2;
      colorScores[p.colorId] = 0;
      if (p.teamId) teamScores[p.teamId] = 0;
    });

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const owner = cellOwnership[r][c].ownerColor;
        const type = cellOwnership[r][c].type;
        if (owner) {
          colorSpaces[owner] = (colorSpaces[owner] || 0) + 1;
          if (type === 'occupied') {
            colorPebbles[owner] = (colorPebbles[owner] || 0) + 1;
          } else if (type === 'enclosed') {
            colorEnclosed[owner] = (colorEnclosed[owner] || 0) + 1;
          } else if (type === 'splash') {
            colorSplash[owner] = (colorSplash[owner] || 0) + 1;
          }
        } else {
          neutralCount++;
        }
      }
    }

    // Total Score = Controlled Spaces (1 pt each) + Captured Pebbles (2 pts each)
    this.players.forEach(p => {
      colorScores[p.colorId] = (colorSpaces[p.colorId] || 0) + (colorCapturePoints[p.colorId] || 0);
    });

    // In 2v2 team mode, sum scores by team
    if (this.mode === '2v2-team') {
      this.players.forEach(p => {
        teamScores[p.teamId] = colorScores[p.colorId] || 0;
      });
    }

    return {
      cellOwnership,
      scores: colorScores,
      spaces: colorSpaces,
      pebbles: colorPebbles,
      enclosed: colorEnclosed,
      splash: colorSplash,
      capturePoints: colorCapturePoints,
      teamScores,
      neutralCount,
      totalSpaces: size * size
    };
  }

  // Validate a move before playing
  checkMoveLegality(r, c, colorId = null) {
    if (r < 0 || r >= this.boardSize || c < 0 || c >= this.boardSize) {
      return { legal: false, reason: 'Out of bounds' };
    }

    if (this.stones[r][c] !== null) {
      return { legal: false, reason: 'Spot already occupied!' };
    }

    const player = this.getCurrentPlayer();
    const activeColor = colorId || player.colorId;

    // Deep clone stones for simulation
    const simStones = this.stones.map(row => row.map(cell => (cell ? { ...cell } : null)));
    simStones[r][c] = { colorId: activeColor, playerId: player.id, teamId: player.teamId };

    // Find adjacent opponent groups
    const opponentGroupsToCapture = [];
    const neighbors = this.getOrthogonalNeighbors(r, c);

    for (const [nr, nc] of neighbors) {
      if (simStones[nr][nc] !== null && simStones[nr][nc].colorId !== activeColor) {
        const oppGroup = this.getGroupAt(nr, nc, simStones);
        if (oppGroup && oppGroup.liberties.size === 0) {
          // Avoid duplicate groups
          const key = oppGroup.stones.map(s => `${s[0]},${s[1]}`).sort().join(';');
          if (!opponentGroupsToCapture.some(g => g.key === key)) {
            opponentGroupsToCapture.push({ key, group: oppGroup });
          }
        }
      }
    }

    // Remove captured stones in simulation
    let capturedStonesCount = 0;
    opponentGroupsToCapture.forEach(entry => {
      entry.group.stones.forEach(([cr, cc]) => {
        simStones[cr][cc] = null;
        capturedStonesCount++;
      });
    });

    // Check liberties of newly placed stone's group
    const ownGroup = this.getGroupAt(r, c, simStones);
    if (!ownGroup || ownGroup.liberties.size === 0) {
      return {
        legal: false,
        wouldBeSuicide: true,
        reason: 'Oops! Your Pebble Pal needs at least 1 empty breathing space next to it!'
      };
    }

    // Check if cell is already 100% enclosed territory for this player (Territory Guard)
    const currentTerritory = this.computeTerritory();
    const cellState = currentTerritory.cellOwnership[r][c];
    const isEnclosedSelf = (cellState.type === 'enclosed' && cellState.ownerColor === activeColor);

    return {
      legal: true,
      capturedGroups: opponentGroupsToCapture.map(e => e.group),
      capturedCount: capturedStonesCount,
      isEnclosedSelf
    };
  }

  // Play a move
  playMove(r, c) {
    if (this.isGameOver) return { success: false, reason: 'Game is over!' };

    const player = this.getCurrentPlayer();
    const check = this.checkMoveLegality(r, c, player.colorId);

    if (!check.legal) {
      return {
        success: false,
        wouldBeSuicide: check.wouldBeSuicide,
        reason: check.reason
      };
    }

    // Save snapshot to history stack for undo
    this.saveSnapshot();

    // Reset consecutive passes
    this.consecutivePasses = 0;

    // Apply Move
    this.stones[r][c] = {
      colorId: player.colorId,
      playerId: player.id,
      teamId: player.teamId
    };

    // Process Captures & Splash
    const capturedStones = [];
    if (check.capturedGroups && check.capturedGroups.length > 0) {
      check.capturedGroups.forEach(group => {
        group.stones.forEach(([cr, cc]) => {
          capturedStones.push([cr, cc]);
          this.stones[cr][cc] = null;
          // Territory Splash Rule: Splash painted with capturing player's color!
          this.splashOwner[cr][cc] = player.colorId;
        });
      });

      // Update Popped Pebbles Counter
      this.poppedCounters[player.colorId] = (this.poppedCounters[player.colorId] || 0) + capturedStones.length;
    }

    // Recalculate territory
    const territory = this.computeTerritory();

    // Check Atari warning for all groups
    const groups = this.getGroups();
    const atariGroups = groups.filter(g => g.isAtari);

    // Check if neutral spaces are exhausted (auto-end)
    if (territory.neutralCount === 0) {
      this.endGame();
    } else {
      this.advanceTurn();
    }

    return {
      success: true,
      placed: [r, c],
      player,
      capturedStones,
      atariGroups,
      territory,
      isGameOver: this.isGameOver,
      winner: this.winner
    };
  }

  passTurn() {
    if (this.isGameOver) return { isGameOver: true, winner: this.winner };

    this.saveSnapshot();
    this.consecutivePasses++;

    // If all players pass in a row, end game!
    if (this.consecutivePasses >= this.players.length) {
      this.endGame();
      return {
        passed: true,
        isGameOver: true,
        winner: this.winner,
        territory: this.computeTerritory()
      };
    }

    this.advanceTurn();
    return {
      passed: true,
      isGameOver: false,
      nextPlayer: this.getCurrentPlayer()
    };
  }

  advanceTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
  }

  saveSnapshot() {
    const snapshot = {
      stones: this.stones.map(row => row.map(cell => (cell ? { ...cell } : null))),
      splashOwner: this.splashOwner.map(row => [...row]),
      poppedCounters: { ...this.poppedCounters },
      turnIndex: this.turnIndex,
      consecutivePasses: this.consecutivePasses,
      isGameOver: this.isGameOver,
      winner: this.winner
    };
    this.history.push(snapshot);
    // Keep max 50 snapshots
    if (this.history.length > 50) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;

    const previous = this.history.pop();
    this.stones = previous.stones.map(row => row.map(cell => (cell ? { ...cell } : null)));
    this.splashOwner = previous.splashOwner.map(row => [...row]);
    this.poppedCounters = { ...previous.poppedCounters };
    this.turnIndex = previous.turnIndex;
    this.consecutivePasses = previous.consecutivePasses;
    this.isGameOver = previous.isGameOver;
    this.winner = previous.winner;

    return true;
  }

  endGame() {
    this.isGameOver = true;
    const territory = this.computeTerritory();

    if (this.mode === '2v2-team') {
      const team1Score = territory.teamScores[1] || 0;
      const team2Score = territory.teamScores[2] || 0;

      if (team1Score > team2Score) {
        this.winner = { teamId: 1, title: 'Team 1 Wins!', score: team1Score };
      } else if (team2Score > team1Score) {
        this.winner = { teamId: 2, title: 'Team 2 Wins!', score: team2Score };
      } else {
        // Tie-breaker: Popped counters
        const p1Color = this.players.find(p => p.teamId === 1)?.colorId;
        const p2Color = this.players.find(p => p.teamId === 2)?.colorId;
        const pops1 = this.poppedCounters[p1Color] || 0;
        const pops2 = this.poppedCounters[p2Color] || 0;

        if (pops1 > pops2) {
          this.winner = { teamId: 1, title: 'Team 1 Wins by Tie-Breaker!', score: team1Score, tieBreaker: true };
        } else if (pops2 > pops1) {
          this.winner = { teamId: 2, title: 'Team 2 Wins by Tie-Breaker!', score: team2Score, tieBreaker: true };
        } else {
          this.winner = { isTie: true, title: "It's a Friendly Tie!", score: team1Score };
        }
      }
    } else {
      // Individual mode (2, 3, or 4 players)
      let highestScore = -1;
      let topPlayers = [];

      this.players.forEach(p => {
        const score = territory.scores[p.colorId] || 0;
        if (score > highestScore) {
          highestScore = score;
          topPlayers = [p];
        } else if (score === highestScore) {
          topPlayers.push(p);
        }
      });

      if (topPlayers.length === 1) {
        this.winner = { player: topPlayers[0], title: `${topPlayers[0].name} Wins!`, score: highestScore };
      } else {
        // Tie breaker: Popped counters
        let maxPops = -1;
        let tieWinners = [];
        topPlayers.forEach(p => {
          const pops = this.poppedCounters[p.colorId] || 0;
          if (pops > maxPops) {
            maxPops = pops;
            tieWinners = [p];
          } else if (pops === maxPops) {
            tieWinners.push(p);
          }
        });

        if (tieWinners.length === 1) {
          this.winner = { player: tieWinners[0], title: `${tieWinners[0].name} Wins by Tie-Breaker!`, score: highestScore, tieBreaker: true };
        } else {
          this.winner = { isTie: true, title: "It's a Friendly Tie!", score: highestScore };
        }
      }
    }
  }

  // Get all legal moves for a given player/color
  getLegalMoves(colorId = null) {
    const activeColor = colorId || this.getCurrentPlayer().colorId;
    const moves = [];
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        if (this.stones[r][c] === null) {
          const check = this.checkMoveLegality(r, c, activeColor);
          if (check.legal) {
            moves.push({ r, c, ...check });
          }
        }
      }
    }
    return moves;
  }
}

window.THEMES = THEMES;
window.GameEngine = GameEngine;
