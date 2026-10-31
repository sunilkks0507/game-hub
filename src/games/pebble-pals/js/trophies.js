/**
 * Pebble Pals: Trophy Room & Achievement Tracker
 * Persists kid stats and unlockable badges in localStorage
 */

const BADGES_CONFIG = [
  {
    id: 'first_pal',
    title: 'First Pebble Pal!',
    desc: 'Placed your very first pebble in the garden.',
    icon: '🌱',
    color: '#10B981'
  },
  {
    id: 'handshake',
    title: 'Friendly Handshake',
    desc: 'Connected 2 or more pebbles to hold hands.',
    icon: '🤝',
    color: '#0284C7'
  },
  {
    id: 'danger_spotter',
    title: 'Danger Spotter!',
    desc: 'Put an opponent group into Atari (1 breath left).',
    icon: '⚡',
    color: '#EAB308'
  },
  {
    id: 'pop_star',
    title: 'Pop Superstar!',
    desc: 'Popped your first enemy pebble off the board.',
    icon: '💥',
    color: '#E11D48'
  },
  {
    id: 'territory_splasher',
    title: 'Territory Splasher',
    desc: 'Claimed new land with a capture splash.',
    icon: '🎨',
    color: '#9333EA'
  },
  {
    id: 'fence_builder',
    title: 'Garden Fence Builder',
    desc: 'Enclosed empty spaces to score bonus territory.',
    icon: '🏡',
    color: '#059669'
  },
  {
    id: 'bao_scholar',
    title: "Master Bao's Scholar",
    desc: 'Completed all 4 interactive lessons with Bao.',
    icon: '🎓',
    color: '#D97706'
  },
  {
    id: 'bot_buster',
    title: 'Bot Buster',
    desc: 'Defeated a Smart AI Bot in a 1v1 match.',
    icon: '🤖',
    color: '#4F46E5'
  },
  {
    id: 'team_titans',
    title: 'Team Titans',
    desc: 'Won a 2v2 Team Battle with your buddy.',
    icon: '🏆',
    color: '#DB2777'
  },
  {
    id: 'grand_realm',
    title: 'Grand Architect',
    desc: 'Controlled over 60% of the entire board in a game!',
    icon: '👑',
    color: '#F59E0B'
  }
];

class TrophyTracker {
  constructor() {
    this.storageKey = 'hub:pebble-pals:save:v1';
    this.legacyKey = 'pebble_pals_save_v1'; // the old standalone key, read once
    this.data = {
      stats: {
        totalSpacesClaimed: 0,
        totalPebblesPopped: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        lessonsCompleted: []
      },
      unlockedBadges: {} // badgeId -> timestamp
    };
    this.newlyUnlocked = [];
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(this.storageKey) || localStorage.getItem(this.legacyKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = {
          stats: { ...this.data.stats, ...(parsed.stats || {}) },
          unlockedBadges: { ...(parsed.unlockedBadges || {}) }
        };
      }
    } catch (e) {
      console.warn('Could not load trophy data:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      this.saveHubProgress();
    } catch (e) {
      console.warn('Could not save trophy data:', e);
    }
  }

  // The shared shape the hub reads: { gameId, played, won, badges, lastPlayed }.
  saveHubProgress() {
    try {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      localStorage.setItem('hub:pebble-pals:progress:v1', JSON.stringify({
        gameId: 'pebble-pals',
        played: this.data.stats.gamesPlayed,
        won: this.data.stats.gamesWon,
        badges: Object.keys(this.data.unlockedBadges),
        lastPlayed: this.data.stats.gamesPlayed > 0 ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null
      }));
    } catch (e) { /* storage blocked */ }
  }

  unlock(badgeId) {
    if (!this.data.unlockedBadges[badgeId]) {
      this.data.unlockedBadges[badgeId] = Date.now();
      const badge = BADGES_CONFIG.find(b => b.id === badgeId);
      if (badge) {
        this.newlyUnlocked.push(badge);
        if (window.soundFx) window.soundFx.playBadge();
      }
      this.save();
      return true;
    }
    return false;
  }

  recordMove(engine, moveRes) {
    if (!moveRes || !moveRes.success) return;

    // First Pal
    this.unlock('first_pal');

    // Friendly Handshake: check if newly placed stone joined friendly group of size >= 2
    const placedGroup = engine.getGroupAt(moveRes.placed[0], moveRes.placed[1]);
    if (placedGroup && placedGroup.stones.length >= 2) {
      this.unlock('handshake');
    }

    // Danger Spotter: put an opponent group into Atari
    if (moveRes.atariGroups && moveRes.atariGroups.length > 0) {
      const hasOpponentAtari = moveRes.atariGroups.some(g => g.colorId !== moveRes.player.colorId);
      if (hasOpponentAtari) {
        this.unlock('danger_spotter');
      }
    }

    // Pop Star & Territory Splasher
    if (moveRes.capturedStones && moveRes.capturedStones.length > 0) {
      this.unlock('pop_star');
      this.unlock('territory_splasher');
      this.data.stats.totalPebblesPopped += moveRes.capturedStones.length;
      this.save();
    }

    // Garden Fence Builder: if player has enclosed cells
    if (moveRes.territory) {
      let hasEnclosed = false;
      const size = engine.boardSize;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = moveRes.territory.cellOwnership[r][c];
          if (cell.type === 'enclosed' && cell.ownerColor === moveRes.player.colorId) {
            hasEnclosed = true;
            break;
          }
        }
        if (hasEnclosed) break;
      }
      if (hasEnclosed) {
        this.unlock('fence_builder');
      }
    }
  }

  recordGameEnd(engine) {
    this.data.stats.gamesPlayed++;
    const territory = engine.computeTerritory();

    // Add controlled spaces
    engine.players.forEach(p => {
      const spaces = territory.spaces ? (territory.spaces[p.colorId] || 0) : (territory.scores[p.colorId] || 0);
      if (!p.isBot) {
        this.data.stats.totalSpacesClaimed += spaces;
      }
    });

    // Check winner
    if (engine.winner) {
      if (engine.mode === '2v2-team') {
        const team1HasHuman = engine.players.some(p => p.teamId === 1 && !p.isBot);
        const team2HasHuman = engine.players.some(p => p.teamId === 2 && !p.isBot);
        if (
          (engine.winner.teamId === 1 && team1HasHuman) ||
          (engine.winner.teamId === 2 && team2HasHuman)
        ) {
          this.data.stats.gamesWon++;
          this.unlock('team_titans');
        }
      } else {
        // Individual
        if (engine.winner.player && !engine.winner.player.isBot) {
          this.data.stats.gamesWon++;
          // Check if bot was in game
          const hadBot = engine.players.some(p => p.isBot);
          if (hadBot) {
            this.unlock('bot_buster');
          }
        }
      }

      // Check Grand Architect (controlled >= 60% of board)
      const totalSpaces = engine.boardSize * engine.boardSize;
      const winningScore = engine.winner.score || 0;
      if (winningScore / totalSpaces >= 0.60) {
        this.unlock('grand_realm');
      }
    }

    this.save();
  }

  completeLesson(lessonId) {
    if (!this.data.stats.lessonsCompleted.includes(lessonId)) {
      this.data.stats.lessonsCompleted.push(lessonId);
      this.save();
    }

    // Check all 4 lessons completed
    const allCompleted = ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'].every(id =>
      this.data.stats.lessonsCompleted.includes(id)
    );
    if (allCompleted) {
      this.unlock('bao_scholar');
    }
  }

  popNewBadges() {
    const list = [...this.newlyUnlocked];
    this.newlyUnlocked = [];
    return list;
  }

  getBadges() {
    return BADGES_CONFIG.map(cfg => {
      const unlockedAt = this.data.unlockedBadges[cfg.id];
      return {
        ...cfg,
        isUnlocked: Boolean(unlockedAt),
        unlockedAt
      };
    });
  }

  resetProgress() {
    this.data = {
      stats: {
        totalSpacesClaimed: 0,
        totalPebblesPopped: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        lessonsCompleted: []
      },
      unlockedBadges: {}
    };
    this.save();
  }
}

window.trophyTracker = new TrophyTracker();
