/**
 * Pebble Pals: Territory Quest! - Main Application Controller
 */

class PebblePalsApp {
  constructor() {
    this.currentScreen = 'arena'; // 'arena', 'learn', 'trophies'
    this.inActiveGame = false;
    this.engine = null;
    this.bot = new window.HeuristicBot('smart');
    this.tutorial = null;
    this.showBreaths = true;
    this.lastGuardedCell = null;
    this.lastGuardedTime = 0;
    this.botThinking = false;
    this.currentRulePage = 0;

    // Arena setup state
    this.setupConfig = {
      playerCount: 2,
      mode: '2-player', // '2-player', '3-player', '4-ffa', '2v2-team'
      boardSize: 5,
      boardStyle: 'boxes', // 'boxes' or 'lines'
      players: [
        { id: 0, name: 'Player 1', isBot: false, colorId: 'ocean-blue', teamId: 1 },
        { id: 1, name: 'Bot Bao', isBot: true, colorId: 'coral-red', teamId: 2 }
      ]
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.renderSetupScreen();
    this.updateSoundIcon();

    // Check for tutorial instance
    this.tutorial = new window.TutorialManager(this);
  }

  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const screen = e.currentTarget.dataset.screen;
        this.showScreen(screen);
        if (window.soundFx) window.soundFx.playClick();
      });
    });

    // Rule Book toggle button in header
    const rulesBtn = document.getElementById('btn-rules-toggle');
    if (rulesBtn) {
      rulesBtn.addEventListener('click', () => {
        this.openRuleBook();
      });
    }

    // Rule Book modal close & pagination buttons
    const closeRulesBtn = document.getElementById('btn-close-rules');
    if (closeRulesBtn) {
      closeRulesBtn.addEventListener('click', () => {
        this.closeRuleBook();
      });
    }

    const prevRulesBtn = document.getElementById('btn-rules-prev');
    if (prevRulesBtn) {
      prevRulesBtn.addEventListener('click', () => {
        this.changeRulePage(-1);
      });
    }

    const nextRulesBtn = document.getElementById('btn-rules-next');
    if (nextRulesBtn) {
      nextRulesBtn.addEventListener('click', () => {
        this.changeRulePage(1);
      });
    }

    const rulesModal = document.getElementById('rules-modal');
    if (rulesModal) {
      rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
          this.closeRuleBook();
        }
      });
    }

    // Keyboard support for Rule Book and shortcuts
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('rules-modal');
      if (modal && modal.classList.contains('active')) {
        if (e.key === 'Escape') {
          this.closeRuleBook();
        } else if (e.key === 'ArrowLeft') {
          this.changeRulePage(-1);
        } else if (e.key === 'ArrowRight') {
          this.changeRulePage(1);
        }
      }
    });

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        if (window.soundFx) {
          window.soundFx.toggleMute();
          this.updateSoundIcon();
        }
      });
    }

    // Grid Style Toggle
    const styleToggle = document.getElementById('btn-toggle-grid-style');
    if (styleToggle) {
      styleToggle.addEventListener('click', () => {
        const nextStyle = this.setupConfig.boardStyle === 'boxes' ? 'lines' : 'boxes';
        this.setupConfig.boardStyle = nextStyle;
        if (this.engine) this.engine.boardStyle = nextStyle;
        this.renderBoard();
        this.updateStyleToggleButton();
        if (window.soundFx) window.soundFx.playClick();
      });
    }

    // Show Breaths Toggle
    const breathToggle = document.getElementById('btn-toggle-breaths');
    if (breathToggle) {
      breathToggle.addEventListener('click', () => {
        this.showBreaths = !this.showBreaths;
        breathToggle.classList.toggle('active', this.showBreaths);
        this.renderBoard();
        if (window.soundFx) {
          if (this.showBreaths) window.soundFx.playHeart();
          else window.soundFx.playClick();
        }
      });
    }

    // Undo Move
    const undoBtn = document.getElementById('btn-undo-move');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.handleUndo();
      });
    }

    // Pass Turn
    const passBtn = document.getElementById('btn-pass-turn');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        this.handlePass();
      });
    }

    // Quit to setup
    const quitBtn = document.getElementById('btn-quit-game');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        if (confirm('Leave this game and return to Setup?')) {
          this.inActiveGame = false;
          this.showScreen('arena');
          if (window.soundFx) window.soundFx.playClick();
        }
      });
    }

    // Reset progress in Trophy Room
    const resetBtn = document.getElementById('btn-reset-trophies');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all your badges and stats?')) {
          if (window.trophyTracker) {
            window.trophyTracker.resetProgress();
            this.renderTrophyRoom();
            this.showToast('Stats and Badges have been reset!');
          }
        }
      });
    }

    // Modal close buttons
    const restartBtn = document.getElementById('btn-modal-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        document.getElementById('victory-modal').classList.remove('active');
        this.startArenaGame();
      });
    }

    const modalSetupBtn = document.getElementById('btn-modal-setup');
    if (modalSetupBtn) {
      modalSetupBtn.addEventListener('click', () => {
        document.getElementById('victory-modal').classList.remove('active');
        this.inActiveGame = false;
        this.showScreen('arena');
      });
    }
  }

  showScreen(screen) {
    this.currentScreen = screen;
    document.querySelectorAll('.screen-view').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const tab = document.querySelector(`.nav-tab[data-screen="${screen}"]`);
    if (tab) tab.classList.add('active');

    if (screen === 'arena') {
      const arenaScreen = document.getElementById('screen-arena');
      arenaScreen.classList.add('active');
      const setupPanel = document.getElementById('arena-setup-panel');
      const gamePanel = document.getElementById('arena-game-panel');
      if (this.inActiveGame) {
        setupPanel.style.display = 'none';
        gamePanel.style.display = 'flex';
        this.renderBoard();
        this.updateHUD();
      } else {
        setupPanel.style.display = 'flex';
        gamePanel.style.display = 'none';
        this.renderSetupScreen();
      }
    } else if (screen === 'learn') {
      document.getElementById('screen-learn').classList.add('active');
      this.tutorial.startLesson(0);
    } else if (screen === 'trophies') {
      document.getElementById('screen-trophies').classList.add('active');
      this.renderTrophyRoom();
    }
  }

  updateSoundIcon() {
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (!soundBtn) return;
    const isMuted = window.soundFx ? window.soundFx.isMuted() : false;
    soundBtn.innerHTML = isMuted ? '🔇' : '🔊';
    soundBtn.title = isMuted ? 'Unmute Sound' : 'Mute Sound';
  }

  updateStyleToggleButton() {
    const btn = document.getElementById('btn-toggle-grid-style');
    if (!btn) return;
    const isBoxes = this.setupConfig.boardStyle === 'boxes';
    btn.innerHTML = isBoxes ? '🌿 Garden Boxes' : '🪵 Classic Lines';
  }

  showToast(message) {
    const toast = document.getElementById('friendly-toast');
    if (!toast) return;
    toast.innerHTML = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // =========================================================================
  // SETUP SCREEN CONTROLLER
  // =========================================================================
  renderSetupScreen() {
    const container = document.getElementById('arena-setup-panel');
    if (!container) return;

    // Palette themes
    const availableThemes = Object.values(window.THEMES);

    container.innerHTML = `
      <div class="setup-container">
        <div class="setup-header">
          <h2>🌿 Choose Your Quest!</h2>
          <p>Pick your players, pebble pals, and garden size to begin.</p>
          <div style="margin-top:10px; display:flex; justify-content:center;">
            <button class="action-btn" id="btn-setup-rules" style="font-size:0.86rem; padding:6px 14px;">
              <span>📖 How to Play (Rule Book)</span>
            </button>
          </div>
        </div>

        <!-- Mode & Player Count -->
        <div class="setup-section">
          <div class="setup-section-title">👥 Player Mode</div>
          <div class="mode-toggle-group">
            <button class="mode-btn ${this.setupConfig.mode === '2-player' ? 'active' : ''}" data-mode="2-player">
              <span class="mode-icon">⚔️</span>
              <span>1v1 Duel</span>
              <small>2 Players</small>
            </button>
            <button class="mode-btn ${this.setupConfig.mode === '3-player' ? 'active' : ''}" data-mode="3-player">
              <span class="mode-icon">🌀</span>
              <span>3-Way Free</span>
              <small>3 Players</small>
            </button>
            <button class="mode-btn ${this.setupConfig.mode === '4-ffa' ? 'active' : ''}" data-mode="4-ffa">
              <span class="mode-icon">💥</span>
              <span>4-Way Free</span>
              <small>4 Players</small>
            </button>
            <button class="mode-btn ${this.setupConfig.mode === '2v2-team' ? 'active' : ''}" data-mode="2v2-team">
              <span class="mode-icon">🤝</span>
              <span>2v2 Team</span>
              <small>Teams Battle</small>
            </button>
          </div>
        </div>

        <!-- Player Setup Cards -->
        <div class="setup-section">
          <div class="setup-section-title">🎨 Pebble Pals & Characters</div>
          <div class="players-setup-list" id="players-setup-list">
            ${this.renderPlayerSetupCards(availableThemes)}
          </div>
        </div>

        <!-- Board Size & Style -->
        <div class="setup-section">
          <div class="setup-section-title">📐 Garden Board Size</div>
          <div class="mode-toggle-group">
            <button class="mode-btn ${this.setupConfig.boardSize === 5 ? 'active' : ''}" data-size="5">
              <span class="mode-icon">🌱</span>
              <span>5x5 Quick</span>
              <small>25 Spaces</small>
            </button>
            <button class="mode-btn ${this.setupConfig.boardSize === 7 ? 'active' : ''}" data-size="7">
              <span class="mode-icon">🌸</span>
              <span>7x7 Standard</span>
              <small>49 Spaces</small>
            </button>
            <button class="mode-btn ${this.setupConfig.boardSize === 9 ? 'active' : ''}" data-size="9">
              <span class="mode-icon">🌳</span>
              <span>9x9 Big Quest</span>
              <small>81 Spaces</small>
            </button>
          </div>
        </div>

        <!-- Start Button -->
        <button class="btn-primary-large" id="btn-start-quest">
          <span>🚀 Start Pebble Quest!</span>
        </button>
      </div>
    `;

    // Bind mode buttons
    container.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.handleModeChange(mode);
        if (window.soundFx) window.soundFx.playClick();
      });
    });

    // Bind size buttons
    container.querySelectorAll('.mode-btn[data-size]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setupConfig.boardSize = parseInt(e.currentTarget.dataset.size, 10);
        this.renderSetupScreen();
        if (window.soundFx) window.soundFx.playClick();
      });
    });

    // Bind player type toggles (Human vs Bot)
    container.querySelectorAll('.type-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pIdx = parseInt(e.currentTarget.dataset.playerIdx, 10);
        this.setupConfig.players[pIdx].isBot = !this.setupConfig.players[pIdx].isBot;
        if (this.setupConfig.players[pIdx].isBot) {
          this.setupConfig.players[pIdx].name = `Bot ${pIdx + 1}`;
        } else {
          this.setupConfig.players[pIdx].name = `Player ${pIdx + 1}`;
        }
        this.renderSetupScreen();
        if (window.soundFx) window.soundFx.playClick();
      });
    });

    // Bind theme color selectors
    container.querySelectorAll('.theme-pill:not(.disabled)').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const pIdx = parseInt(e.currentTarget.dataset.playerIdx, 10);
        const colorId = e.currentTarget.dataset.colorId;
        this.handleColorChange(pIdx, colorId);
        if (window.soundFx) window.soundFx.playClick();
      });
    });

    // Bind Rule Book Button
    const setupRulesBtn = container.querySelector('#btn-setup-rules');
    if (setupRulesBtn) {
      setupRulesBtn.addEventListener('click', () => {
        this.openRuleBook();
      });
    }

    // Bind Start Button
    const startBtn = container.querySelector('#btn-start-quest');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.startArenaGame();
      });
    }
  }

  handleModeChange(mode) {
    this.setupConfig.mode = mode;
    const defaultThemes = ['ocean-blue', 'coral-red', 'sunny-gold', 'emerald-green'];

    if (mode === '2-player') {
      this.setupConfig.playerCount = 2;
      this.setupConfig.players = [
        { id: 0, name: 'Player 1', isBot: false, colorId: 'ocean-blue', teamId: 1 },
        { id: 1, name: 'Bot Bao', isBot: true, colorId: 'coral-red', teamId: 2 }
      ];
    } else if (mode === '3-player') {
      this.setupConfig.playerCount = 3;
      this.setupConfig.players = [
        { id: 0, name: 'Player 1', isBot: false, colorId: 'ocean-blue', teamId: 1 },
        { id: 1, name: 'Player 2', isBot: false, colorId: 'coral-red', teamId: 2 },
        { id: 2, name: 'Bot Sunny', isBot: true, colorId: 'sunny-gold', teamId: 3 }
      ];
    } else if (mode === '4-ffa') {
      this.setupConfig.playerCount = 4;
      this.setupConfig.players = [
        { id: 0, name: 'Player 1', isBot: false, colorId: 'ocean-blue', teamId: 1 },
        { id: 1, name: 'Player 2', isBot: false, colorId: 'coral-red', teamId: 2 },
        { id: 2, name: 'Bot Sunny', isBot: true, colorId: 'sunny-gold', teamId: 3 },
        { id: 3, name: 'Bot Sprout', isBot: true, colorId: 'emerald-green', teamId: 4 }
      ];
    } else if (mode === '2v2-team') {
      this.setupConfig.playerCount = 4;
      // In 2v2: Team 1 shares color 1, Team 2 shares color 2!
      this.setupConfig.players = [
        { id: 0, name: 'Player 1', isBot: false, colorId: 'ocean-blue', teamId: 1, teamName: 'Team 1 (Blue)' },
        { id: 1, name: 'Player 2', isBot: false, colorId: 'coral-red', teamId: 2, teamName: 'Team 2 (Red)' },
        { id: 2, name: 'Player 3 (Teammate)', isBot: true, colorId: 'ocean-blue', teamId: 1, teamName: 'Team 1 (Blue)' },
        { id: 3, name: 'Player 4 (Teammate)', isBot: true, colorId: 'coral-red', teamId: 2, teamName: 'Team 2 (Red)' }
      ];
    }

    this.renderSetupScreen();
  }

  handleColorChange(playerIdx, newColorId) {
    if (this.setupConfig.mode === '2v2-team') {
      const teamId = this.setupConfig.players[playerIdx].teamId;
      // Both teammates get the new color
      this.setupConfig.players.forEach(p => {
        if (p.teamId === teamId) {
          p.colorId = newColorId;
        }
      });
    } else {
      this.setupConfig.players[playerIdx].colorId = newColorId;
    }
    this.renderSetupScreen();
  }

  renderPlayerSetupCards(themes) {
    return this.setupConfig.players.map((p, idx) => {
      const theme = window.THEMES[p.colorId] || themes[0];
      const teamLabel = this.setupConfig.mode === '2v2-team' ? ` [Team ${p.teamId}]` : '';

      return `
        <div class="player-card-setup">
          <div class="player-info">
            <div class="player-avatar-badge" style="background:${theme.color};">
              ${this.createPebbleSvg(p.colorId)}
            </div>
            <div class="player-labels">
              <h4>${p.name}${teamLabel}</h4>
              <span>${theme.name} (${theme.mascot})</span>
            </div>
          </div>

          <div class="player-controls">
            <button class="type-toggle-btn" data-player-idx="${idx}">
              <span>${p.isBot ? '🤖 Smart Bot' : '🧒 Human Player'}</span>
            </button>

            <!-- Theme Picker -->
            <div class="theme-picker-row">
              ${themes.map(t => {
                const isSelected = p.colorId === t.id;
                // If individual mode, disable if chosen by another player
                let isDisabled = false;
                if (this.setupConfig.mode !== '2v2-team') {
                  isDisabled = this.setupConfig.players.some((otherP, otherIdx) => otherIdx !== idx && otherP.colorId === t.id);
                } else {
                  // In 2v2: disable if chosen by the other team
                  isDisabled = this.setupConfig.players.some(otherP => otherP.teamId !== p.teamId && otherP.colorId === t.id);
                }

                return `
                  <div 
                    class="theme-pill ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                    style="background:${t.color};"
                    data-player-idx="${idx}"
                    data-color-id="${t.id}"
                    title="${t.name}">
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // GAMEPLAY ORCHESTRATION
  // =========================================================================
  startArenaGame() {
    this.inActiveGame = true;
    this.engine = new window.GameEngine({
      boardSize: this.setupConfig.boardSize,
      mode: this.setupConfig.mode,
      boardStyle: this.setupConfig.boardStyle,
      players: JSON.parse(JSON.stringify(this.setupConfig.players))
    });

    document.getElementById('arena-setup-panel').style.display = 'none';
    const gamePanel = document.getElementById('arena-game-panel');
    gamePanel.style.display = 'flex';

    this.renderBoard();
    this.updateHUD();
    this.updateStyleToggleButton();

    if (window.soundFx) window.soundFx.playPop();

    // If first player is Bot, trigger turn
    if (this.engine.getCurrentPlayer().isBot) {
      this.triggerBotTurn();
    }
  }

  updateHUD() {
    if (!this.engine) return;

    const territory = this.engine.computeTerritory();
    const curPlayer = this.engine.getCurrentPlayer();
    const curTheme = window.THEMES[curPlayer.colorId];

    // 1. Turn Banner
    const turnAvatar = document.getElementById('hud-turn-avatar');
    const turnHeadline = document.getElementById('hud-turn-headline');
    const turnSub = document.getElementById('hud-turn-sub');
    const turnBanner = document.getElementById('hud-turn-banner');

    if (turnAvatar) {
      turnAvatar.style.background = curTheme.color;
      turnAvatar.innerHTML = this.createPebbleSvg(curPlayer.colorId);
      if (curPlayer.isBot && this.botThinking) {
        turnAvatar.innerHTML += `<div class="bot-thinking-bubble">💭</div>`;
      }
    }

    if (turnHeadline) {
      if (this.engine.mode === '2v2-team') {
        turnHeadline.textContent = `Team ${curPlayer.teamId}'s Turn (${curPlayer.name})`;
      } else {
        turnHeadline.textContent = `${curPlayer.name}'s Turn`;
      }
    }

    if (turnSub) {
      turnSub.textContent = curPlayer.isBot ? 'Bot is thinking of the best space...' : 'Tap an open garden box to place your Pebble Pal!';
    }

    // 2. Tug-of-War Multi-Segment Live Score Meter
    const meter = document.getElementById('hud-tug-of-war-meter');
    const chipsContainer = document.getElementById('hud-score-chips');

    // Dynamic pool combining controlled spaces, capture bonuses (2 pts each), and open neutral spaces
    let totalScorePool = territory.neutralCount;
    if (this.engine.mode === '2v2-team') {
      totalScorePool += (territory.teamScores[1] || 0) + (territory.teamScores[2] || 0);
    } else {
      this.engine.players.forEach(p => {
        totalScorePool += (territory.scores[p.colorId] || 0);
      });
    }
    totalScorePool = Math.max(totalScorePool, this.engine.boardSize * this.engine.boardSize);

    if (meter) {
      meter.innerHTML = '';

      if (this.engine.mode === '2v2-team') {
        const t1Score = territory.teamScores[1] || 0;
        const t2Score = territory.teamScores[2] || 0;
        const neutralScore = territory.neutralCount;

        const t1Color = this.engine.players.find(p => p.teamId === 1).colorId;
        const t2Color = this.engine.players.find(p => p.teamId === 2).colorId;

        meter.innerHTML = `
          <div class="tug-segment" style="width:${(t1Score / totalScorePool) * 100}%; background:${window.THEMES[t1Color].color};">
            ${t1Score > 0 ? `Team 1: ${t1Score} Pts` : ''}
          </div>
          <div class="tug-segment neutral" style="width:${(neutralScore / totalScorePool) * 100}%;">
            ${neutralScore > 0 ? `Open: ${neutralScore}` : ''}
          </div>
          <div class="tug-segment" style="width:${(t2Score / totalScorePool) * 100}%; background:${window.THEMES[t2Color].color};">
            ${t2Score > 0 ? `Team 2: ${t2Score} Pts` : ''}
          </div>
        `;
      } else {
        // Individual players
        let segmentsHtml = '';
        this.engine.players.forEach(p => {
          const score = territory.scores[p.colorId] || 0;
          const pTheme = window.THEMES[p.colorId];
          const pct = (score / totalScorePool) * 100;
          if (pct > 0) {
            segmentsHtml += `
              <div class="tug-segment" style="width:${pct}%; background:${pTheme.color};">
                ${score} Pts
              </div>
            `;
          }
        });

        // Neutral segment
        const neutralPct = (territory.neutralCount / totalScorePool) * 100;
        segmentsHtml += `
          <div class="tug-segment neutral" style="width:${neutralPct}%;">
            ${territory.neutralCount > 0 ? `Open: ${territory.neutralCount}` : ''}
          </div>
        `;

        meter.innerHTML = segmentsHtml;
      }
    }

    // 3. Player Score Chips
    if (chipsContainer) {
      let highestScore = -1;
      this.engine.players.forEach(p => {
        const sc = territory.scores[p.colorId] || 0;
        if (sc > highestScore) highestScore = sc;
      });

      chipsContainer.innerHTML = this.engine.players.map(p => {
        const pTheme = window.THEMES[p.colorId];
        const score = territory.scores[p.colorId] || 0;
        const spaces = territory.spaces ? (territory.spaces[p.colorId] || 0) : score;
        const pops = this.engine.poppedCounters[p.colorId] || 0;
        const popBonus = pops * 2;
        const isLeading = score === highestScore && score > 0;

        return `
          <div class="score-chip ${isLeading ? 'leading' : ''}">
            <div class="chip-avatar" style="background:${pTheme.color};">
              ${this.createPebbleSvg(p.colorId)}
            </div>
            <span><strong>${p.name}:</strong> ${score} Pts ${isLeading ? '★' : ''}</span>
            <span class="popped-badge" title="${spaces} Spaces (1pt) + ${pops} Captures (2pts each)">
              🌱 ${spaces} | 💥 ${pops} (+${popBonus} pts)
            </span>
          </div>
        `;
      }).join('');
    }
  }

  renderBoard() {
    const boardContainer = document.getElementById('game-board-container');
    if (!boardContainer || !this.engine) return;

    const size = this.engine.boardSize;
    const isBoxes = this.engine.boardStyle === 'boxes';

    boardContainer.className = `board-container ${isBoxes ? 'garden-boxes' : 'classic-lines'}`;
    boardContainer.innerHTML = '';

    const groups = this.engine.getGroups();
    const territory = this.engine.computeTerritory();

    // Collect all breathing spaces (liberties) if showBreaths is active
    const breathingHeartsMap = new Map(); // "r,c" -> { isAtari: boolean, color: string }
    if (this.showBreaths) {
      groups.forEach(g => {
        const theme = window.THEMES[g.colorId];
        g.liberties.forEach(coord => {
          const existing = breathingHeartsMap.get(coord);
          if (!existing || g.isAtari) {
            breathingHeartsMap.set(coord, { isAtari: g.isAtari, color: theme.color });
          }
        });
      });
    }

    if (isBoxes) {
      // -------------------------------------------------------------
      // MODE A: GARDEN BOXES (SQUARE TILES)
      // -------------------------------------------------------------
      const grid = document.createElement('div');
      grid.className = 'board-grid-boxes';
      grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const tile = document.createElement('div');
          tile.className = 'garden-tile';
          tile.dataset.r = r;
          tile.dataset.c = c;

          const stone = this.engine.stones[r][c];
          const cellState = territory.cellOwnership[r][c];

          // 1. Check if occupied by pebble
          if (stone) {
            const theme = window.THEMES[stone.colorId];
            const grp = this.engine.getGroupAt(r, c);
            const isAtari = grp ? grp.isAtari : false;

            tile.innerHTML = `
              <div class="pebble-pal ${isAtari ? 'is-atari' : ''}" style="background:${theme.color};">
                ${this.createPebbleSvg(stone.colorId, isAtari)}
                ${isAtari ? '<div class="sweat-drop"></div><div class="atari-badge">!</div>' : ''}
              </div>
            `;
          } else {
            // 2. Empty Tile: Enclosed, Splashed, or Neutral
            if (cellState.type === 'enclosed') {
              const encTheme = window.THEMES[cellState.ownerColor];
              tile.classList.add('is-enclosed');
              tile.style.backgroundColor = encTheme.light;
              tile.style.borderColor = encTheme.border;
              tile.innerHTML = `
                <div class="territory-flower-badge">
                  ${this.createTerritoryDecorationSvg(cellState.ownerColor)}
                </div>
              `;
            } else if (cellState.type === 'splash') {
              const splashTheme = window.THEMES[cellState.ownerColor];
              tile.classList.add('is-splashed');
              tile.style.backgroundColor = splashTheme.light;
              tile.style.borderColor = splashTheme.border;
              tile.innerHTML = `
                <div class="territory-flower-badge" style="opacity:0.7;">
                  ${this.createTerritoryDecorationSvg(cellState.ownerColor)}
                </div>
              `;
            }

            // 3. Render Breathing Hearts if applicable
            const heartInfo = breathingHeartsMap.get(`${r},${c}`);
            if (heartInfo) {
              const heartDiv = document.createElement('div');
              heartDiv.className = `breathing-heart ${heartInfo.isAtari ? 'urgent-atari' : ''}`;
              heartDiv.innerHTML = heartInfo.isAtari ? '🧡' : '💚';
              tile.appendChild(heartDiv);
            }
          }

          // Ghost pebble preview on hover
          tile.addEventListener('mouseenter', () => {
            if (!this.engine.stones[r][c] && !this.engine.getCurrentPlayer().isBot && !this.engine.isGameOver) {
              const curColor = this.engine.getCurrentPlayer().colorId;
              const ghost = document.createElement('div');
              ghost.className = 'ghost-pebble';
              ghost.style.backgroundColor = window.THEMES[curColor].color;
              ghost.innerHTML = this.createPebbleSvg(curColor);
              tile.appendChild(ghost);
            }
          });
          tile.addEventListener('mouseleave', () => {
            const ghost = tile.querySelector('.ghost-pebble');
            if (ghost) ghost.remove();
          });

          // Tile interaction
          tile.addEventListener('click', () => {
            this.handleCellClick(r, c);
          });

          grid.appendChild(tile);
        }
      }

      boardContainer.appendChild(grid);
    } else {
      // -------------------------------------------------------------
      // MODE B: CLASSIC GO LINES (INTERSECTIONS)
      // -------------------------------------------------------------
      const linesGrid = document.createElement('div');
      linesGrid.className = 'board-grid-lines';

      // SVG lines background
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'classic-lines-svg');
      svg.setAttribute('viewBox', '0 0 100 100');

      const step = 100 / (size - 1);

      // Draw grid lines
      for (let i = 0; i < size; i++) {
        const pos = i * step;
        // Horizontal line
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', '0');
        hLine.setAttribute('y1', String(pos));
        hLine.setAttribute('x2', '100');
        hLine.setAttribute('y2', String(pos));
        hLine.setAttribute('stroke', '#451A03');
        hLine.setAttribute('stroke-width', '1.2');
        svg.appendChild(hLine);

        // Vertical line
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', String(pos));
        vLine.setAttribute('y1', '0');
        vLine.setAttribute('x2', String(pos));
        vLine.setAttribute('y2', '100');
        vLine.setAttribute('stroke', '#451A03');
        vLine.setAttribute('stroke-width', '1.2');
        svg.appendChild(vLine);
      }

      // Draw Star Points (Hoshi)
      const starPoints = this.getStarPoints(size);
      starPoints.forEach(([sr, sc]) => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(sc * step));
        dot.setAttribute('cy', String(sr * step));
        dot.setAttribute('r', '2.2');
        dot.setAttribute('fill', '#451A03');
        svg.appendChild(dot);
      });

      linesGrid.appendChild(svg);

      // Intersections Clickable Hitboxes
      const hitBoxSize = Math.max(34, 100 / size);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const hit = document.createElement('div');
          hit.className = 'classic-intersection-hitbox';
          hit.style.left = `${(c / (size - 1)) * 100}%`;
          hit.style.top = `${(r / (size - 1)) * 100}%`;
          hit.style.width = `${hitBoxSize}%`;
          hit.style.height = `${hitBoxSize}%`;

          const stone = this.engine.stones[r][c];
          const cellState = territory.cellOwnership[r][c];

          if (stone) {
            const theme = window.THEMES[stone.colorId];
            const grp = this.engine.getGroupAt(r, c);
            const isAtari = grp ? grp.isAtari : false;

            hit.innerHTML = `
              <div class="pebble-pal ${isAtari ? 'is-atari' : ''}" style="background:${theme.color};">
                ${this.createPebbleSvg(stone.colorId, isAtari)}
                ${isAtari ? '<div class="sweat-drop"></div><div class="atari-badge">!</div>' : ''}
              </div>
            `;
          } else {
            // Enclosed halo or splash
            if (cellState.type === 'enclosed') {
              const encTheme = window.THEMES[cellState.ownerColor];
              hit.innerHTML = `
                <div class="classic-halo" style="background:${encTheme.secondary};"></div>
                <div class="territory-flower-badge" style="z-index:4;">
                  ${this.createTerritoryDecorationSvg(cellState.ownerColor)}
                </div>
              `;
            } else if (cellState.type === 'splash') {
              const splashTheme = window.THEMES[cellState.ownerColor];
              hit.innerHTML = `
                <div class="classic-halo" style="background:${splashTheme.secondary}; opacity:0.4;"></div>
              `;
            }

            // Hearts
            const heartInfo = breathingHeartsMap.get(`${r},${c}`);
            if (heartInfo) {
              const heartDiv = document.createElement('div');
              heartDiv.className = `breathing-heart ${heartInfo.isAtari ? 'urgent-atari' : ''}`;
              heartDiv.innerHTML = heartInfo.isAtari ? '🧡' : '💚';
              hit.appendChild(heartDiv);
            }
          }

          // Ghost preview on hover
          hit.addEventListener('mouseenter', () => {
            if (!this.engine.stones[r][c] && !this.engine.getCurrentPlayer().isBot && !this.engine.isGameOver) {
              const curColor = this.engine.getCurrentPlayer().colorId;
              const ghost = document.createElement('div');
              ghost.className = 'ghost-pebble';
              ghost.style.backgroundColor = window.THEMES[curColor].color;
              ghost.innerHTML = this.createPebbleSvg(curColor);
              hit.appendChild(ghost);
            }
          });
          hit.addEventListener('mouseleave', () => {
            const ghost = hit.querySelector('.ghost-pebble');
            if (ghost) ghost.remove();
          });

          hit.addEventListener('click', () => {
            this.handleCellClick(r, c);
          });

          linesGrid.appendChild(hit);
        }
      }

      boardContainer.appendChild(linesGrid);
    }
  }

  getStarPoints(size) {
    if (size === 5) {
      return [[2, 2]];
    } else if (size === 7) {
      return [[3, 3], [1, 1], [1, 5], [5, 1], [5, 5]];
    } else if (size === 9) {
      return [[4, 4], [2, 2], [2, 6], [6, 2], [6, 6]];
    }
    return [];
  }

  // =========================================================================
  // MOVE EXECUTION & TERRITORY GUARD
  // =========================================================================
  handleCellClick(r, c) {
    if (!this.engine || this.engine.isGameOver || this.botThinking) return;

    const curPlayer = this.engine.getCurrentPlayer();
    if (curPlayer.isBot) return; // Don't allow click during bot turn

    // Kid-Friendly Territory Guard:
    // If player taps a space that is already safely enclosed by their own color
    const territory = this.engine.computeTerritory();
    const cellState = territory.cellOwnership[r][c];

    if (
      cellState.type === 'enclosed' &&
      cellState.ownerColor === curPlayer.colorId
    ) {
      const now = Date.now();
      const cellKey = `${r},${c}`;

      if (this.lastGuardedCell === cellKey && now - this.lastGuardedTime < 2800) {
        // Double-tapped! User really wants to place pebble here anyway.
        this.lastGuardedCell = null;
      } else {
        // First tap: warn and protect!
        this.lastGuardedCell = cellKey;
        this.lastGuardedTime = now;
        this.showToast("🛡️ You already own this safe space! Tap an open spot (or tap again to place anyway).");
        if (window.soundFx) window.soundFx.playClick();
        return;
      }
    }

    this.executePlayerMove(r, c);
  }

  executePlayerMove(r, c) {
    const check = this.engine.checkMoveLegality(r, c);

    if (!check.legal) {
      if (check.wouldBeSuicide) {
        if (window.soundFx) window.soundFx.playBoing();
        this.showToast("Oops! Your Pebble Pal needs at least 1 empty breathing space next to it! 🫧");
      } else {
        if (window.soundFx) window.soundFx.playBoing();
        this.showToast(check.reason || "Can't place a pebble here!");
      }
      return;
    }

    const prevTerritory = this.engine.computeTerritory();
    const prevScore = prevTerritory.scores[this.engine.getCurrentPlayer().colorId] || 0;

    // Apply move
    const res = this.engine.playMove(r, c);

    if (res.success) {
      // Audio effects
      if (window.soundFx) {
        if (res.capturedStones && res.capturedStones.length > 0) {
          window.soundFx.playCapture();
        } else if (res.atariGroups && res.atariGroups.length > 0) {
          window.soundFx.playAtari();
        } else {
          window.soundFx.playPop();
        }

        // Check if enclosed new territory
        const newScore = res.territory.scores[res.player.colorId] || 0;
        if (newScore - prevScore > 1) {
          window.soundFx.playEnclosed();
        }
      }

      // Record move for trophies
      if (window.trophyTracker) {
        window.trophyTracker.recordMove(this.engine, res);
      }

      this.renderBoard();
      this.updateHUD();

      // Check game over
      if (res.isGameOver) {
        this.triggerVictoryCelebration();
      } else {
        // If next player is bot, trigger bot turn
        if (this.engine.getCurrentPlayer().isBot) {
          this.triggerBotTurn();
        }
      }
    }
  }

  triggerBotTurn() {
    this.botThinking = true;
    this.updateHUD();

    setTimeout(() => {
      if (!this.engine || this.engine.isGameOver) {
        this.botThinking = false;
        return;
      }

      const botPlayer = this.engine.getCurrentPlayer();
      const bestMove = this.bot.findBestMove(this.engine, botPlayer);

      this.botThinking = false;

      if (bestMove) {
        this.executePlayerMove(bestMove.r, bestMove.c);
      } else {
        // Bot passes if no good moves exist
        this.handlePass(true);
      }
    }, 550);
  }

  handlePass(isBot = false) {
    if (!this.engine || this.engine.isGameOver || this.botThinking) return;

    const player = this.engine.getCurrentPlayer();
    const res = this.engine.passTurn();

    if (window.soundFx) window.soundFx.playClick();
    this.showToast(`${player.name} passed their turn! 🍃`);

    this.renderBoard();
    this.updateHUD();

    if (res.isGameOver) {
      this.triggerVictoryCelebration();
    } else {
      if (this.engine.getCurrentPlayer().isBot) {
        this.triggerBotTurn();
      }
    }
  }

  handleUndo() {
    if (!this.engine || this.botThinking) return;

    // In PvBot: undo 2 turns to go back to the human player's turn
    const hadBot = this.engine.players.some(p => p.isBot);
    let undone = this.engine.undo();

    if (undone && hadBot && this.engine.getCurrentPlayer().isBot) {
      this.engine.undo();
    }

    if (undone) {
      if (window.soundFx) window.soundFx.playBoing();
      this.showToast("Move undone! ⏪");
      this.renderBoard();
      this.updateHUD();
    }
  }

  // =========================================================================
  // VICTORY CELEBRATION MODAL
  // =========================================================================
  triggerVictoryCelebration() {
    if (!this.engine) return;

    // Record stats and game end trophies
    if (window.trophyTracker) {
      window.trophyTracker.recordGameEnd(this.engine);
    }

    if (window.soundFx) {
      window.soundFx.playVictory();
    }

    const modal = document.getElementById('victory-modal');
    const titleEl = document.getElementById('victory-modal-title');
    const winnerBanner = document.getElementById('victory-winner-banner');
    const scoreBreakdown = document.getElementById('victory-score-breakdown');

    const winner = this.engine.winner;
    const territory = this.engine.computeTerritory();

    if (titleEl) titleEl.textContent = '🎉 Quest Complete!';

    if (winnerBanner) {
      let winColor = '#0284C7';
      let winAvatar = '';

      if (this.engine.mode === '2v2-team' && winner.teamId) {
        const teamPlayer = this.engine.players.find(p => p.teamId === winner.teamId);
        winColor = window.THEMES[teamPlayer.colorId].color;
        winAvatar = this.createPebbleSvg(teamPlayer.colorId);
      } else if (winner.player) {
        winColor = window.THEMES[winner.player.colorId].color;
        winAvatar = this.createPebbleSvg(winner.player.colorId);
      }

      winnerBanner.innerHTML = `
        <div class="player-avatar-badge" style="background:${winColor}; width:68px; height:68px; margin:0 auto;">
          ${winAvatar}
        </div>
        <h2 style="font-size:1.6rem; color:${winColor}; margin-top:8px;">${winner ? winner.title : 'Great Game!'}</h2>
        ${winner && winner.tieBreaker ? '<p style="color:#E11D48; font-weight:800;">Won by Popped Pebbles Tie-Breaker!</p>' : ''}
      `;
    }

    if (scoreBreakdown) {
      scoreBreakdown.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
          ${this.engine.players.map(p => {
            const sc = territory.scores[p.colorId] || 0;
            const spaces = territory.spaces ? (territory.spaces[p.colorId] || 0) : sc;
            const pops = this.engine.poppedCounters[p.colorId] || 0;
            const popPts = pops * 2;
            const th = window.THEMES[p.colorId];
            return `
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px 14px; border-radius:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:900; font-size:1.05rem; color:${th.color};">${p.name}</span>
                  <span style="font-weight:900; font-size:1.15rem; color:#0F172A;">${sc} Points</span>
                </div>
                <div style="font-size:0.8rem; font-weight:700; color:#64748B; margin-top:4px; text-align:left;">
                  🌱 ${spaces} Spaces (1pt each) + 💥 ${pops} Captures (2pts each = +${popPts} pts)
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    modal.classList.add('active');
    this.launchConfetti();
  }

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles = [];
    const colors = ['#0284C7', '#E11D48', '#EAB308', '#16A34A', '#9333EA', '#F59E0B'];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let frame = 0;
    function animate() {
      if (frame > 90) return;
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.rotation += p.vr;
        p.opacity = Math.max(0, 1 - frame / 90);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      requestAnimationFrame(animate);
    }
    animate();
  }

  // =========================================================================
  // TUTORIAL & LEARN SCREEN RENDERING
  // =========================================================================
  renderTutorialView(tutorialMgr) {
    const container = document.getElementById('screen-learn');
    if (!container) return;

    const lesson = tutorialMgr.getCurrentLesson();
    const step = tutorialMgr.getCurrentStep();
    const engine = tutorialMgr.engine;

    container.innerHTML = `
      <div class="tutorial-container">
        <!-- Lesson Navigation Chips -->
        <div class="tutorial-nav-bar">
          ${window.TUTORIAL_LESSONS.map((l, idx) => {
            const isCompleted = window.trophyTracker?.data.stats.lessonsCompleted.includes(l.id);
            const isActive = idx === tutorialMgr.currentLessonIdx;
            return `
              <button class="lesson-chip ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" data-lesson-idx="${idx}">
                ${isCompleted ? '⭐ ' : ''}${l.title}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Master Bao Dialogue -->
        <div class="bao-dialogue-card">
          <div class="bao-avatar-box">
            ${this.createMasterBaoSvg(step.baoMood || 'happy')}
          </div>
          <div class="bao-speech">
            <h3>Master Bao the Red Panda</h3>
            <p>${step.text}</p>
            ${step.actionButton ? `
              <button class="btn-tutorial-action" id="btn-tutorial-next-step">
                ${step.actionButton}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Tutorial Interactive Board -->
        <div class="board-wrapper">
          <div class="board-container garden-boxes" id="tutorial-board" style="max-width:440px; height:440px;">
          </div>
        </div>
      </div>
    `;

    // Bind lesson switch chips
    container.querySelectorAll('.lesson-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lIdx = parseInt(e.currentTarget.dataset.lessonIdx, 10);
        tutorialMgr.startLesson(lIdx);
        if (window.soundFx) window.soundFx.playClick();
      });
    });

    // Action button
    const actionBtn = container.querySelector('#btn-tutorial-next-step');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        tutorialMgr.advanceStep();
        if (window.soundFx) window.soundFx.playClick();
      });
    }

    // Render tutorial board
    const tutBoard = container.querySelector('#tutorial-board');
    if (tutBoard) {
      tutBoard.innerHTML = '';
      const size = lesson.boardSize;
      const grid = document.createElement('div');
      grid.className = 'board-grid-boxes';
      grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;

      const groups = engine.getGroups();
      const territory = engine.computeTerritory();

      // Collect breathing spaces
      const breathingHeartsMap = new Map();
      groups.forEach(g => {
        g.liberties.forEach(coord => {
          breathingHeartsMap.set(coord, { isAtari: g.isAtari });
        });
      });

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const tile = document.createElement('div');
          tile.className = 'garden-tile';

          const stone = engine.stones[r][c];
          const cellState = territory.cellOwnership[r][c];

          // Is this the step highlight target?
          if (step.highlight && step.highlight[0] === r && step.highlight[1] === c && !stone) {
            tile.classList.add('tutorial-target');
          }

          if (stone) {
            const grp = engine.getGroupAt(r, c);
            const isAtari = grp ? grp.isAtari : false;
            tile.innerHTML = `
              <div class="pebble-pal ${isAtari ? 'is-atari' : ''}" style="background:${window.THEMES[stone.colorId].color};">
                ${this.createPebbleSvg(stone.colorId, isAtari)}
                ${isAtari ? '<div class="sweat-drop"></div><div class="atari-badge">!</div>' : ''}
              </div>
            `;
          } else {
            if (cellState.type === 'enclosed') {
              tile.classList.add('is-enclosed');
              tile.style.backgroundColor = window.THEMES[cellState.ownerColor].light;
              tile.innerHTML = `
                <div class="territory-flower-badge">
                  ${this.createTerritoryDecorationSvg(cellState.ownerColor)}
                </div>
              `;
            } else if (cellState.type === 'splash') {
              tile.classList.add('is-splashed');
              tile.style.backgroundColor = window.THEMES[cellState.ownerColor].light;
              tile.innerHTML = `
                <div class="territory-flower-badge">
                  ${this.createTerritoryDecorationSvg(cellState.ownerColor)}
                </div>
              `;
            }

            const heart = breathingHeartsMap.get(`${r},${c}`);
            if (heart) {
              const hDiv = document.createElement('div');
              hDiv.className = `breathing-heart ${heart.isAtari ? 'urgent-atari' : ''}`;
              hDiv.innerHTML = heart.isAtari ? '🧡' : '💚';
              tile.appendChild(hDiv);
            }
          }

          tile.addEventListener('click', () => {
            tutorialMgr.handleCellClick(r, c);
          });

          grid.appendChild(tile);
        }
      }
      tutBoard.appendChild(grid);
    }
  }

  renderTutorialVictory(lesson) {
    const container = document.getElementById('screen-learn');
    if (!container) return;

    container.innerHTML = `
      <div class="setup-container" style="text-align:center; padding:32px;">
        <div class="player-avatar-badge" style="background:#FEF3C7; width:80px; height:80px; margin:0 auto; border:4px solid #F59E0B;">
          ${this.createMasterBaoSvg('celebrating')}
        </div>
        <h2 style="font-size:1.8rem; color:#0284C7; margin-top:12px;">🌟 ${lesson.title} Cleared!</h2>
        <p style="font-size:1.1rem; color:#334155; font-weight:700;">Master Bao says: <em>"Incredible work! You are becoming a true Pebble Pal Master!"</em></p>
        
        <div style="display:flex; justify-content:center; gap:12px; margin-top:16px;">
          <button class="btn-primary-large" id="btn-next-lesson" style="margin:0;">
            <span>Next Lesson ➡️</span>
          </button>
          <button class="action-btn" id="btn-enter-arena" style="padding:14px 22px; font-size:1.1rem;">
            <span>Play Arena ⚔️</span>
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btn-next-lesson').addEventListener('click', () => {
      this.tutorial.nextLesson();
    });

    container.querySelector('#btn-enter-arena').addEventListener('click', () => {
      this.showScreen('arena');
    });
  }

  // =========================================================================
  // TROPHY ROOM RENDERING
  // =========================================================================
  renderTrophyRoom() {
    const container = document.getElementById('screen-trophies');
    if (!container || !window.trophyTracker) return;

    const data = window.trophyTracker.data;
    const badges = window.trophyTracker.getBadges();

    container.innerHTML = `
      <div class="trophy-container">
        <!-- Lifetime Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-num">${data.stats.totalSpacesClaimed}</div>
            <div class="stat-label">Spaces Claimed</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">${data.stats.totalPebblesPopped}</div>
            <div class="stat-label">Pebbles Popped</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">${data.stats.gamesWon}</div>
            <div class="stat-label">Quests Won</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">${data.stats.lessonsCompleted.length}/4</div>
            <div class="stat-label">Lessons Mastered</div>
          </div>
        </div>

        <!-- Badges Cabinet -->
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <h3 style="font-size:1.3rem; color:#1E293B; font-weight:900;">🏆 Kid Badges & Achievements</h3>
          <button class="action-btn danger" id="btn-reset-trophies" style="font-size:0.75rem;">
            <span>Reset Stats</span>
          </button>
        </div>

        <div class="badges-grid">
          ${badges.map(b => `
            <div class="badge-card ${b.isUnlocked ? 'unlocked' : 'locked'}">
              <div class="badge-icon-box" style="${b.isUnlocked ? `background:${b.color}22; border-color:${b.color};` : ''}">
                ${b.icon}
              </div>
              <div class="badge-info">
                <h4>${b.title}</h4>
                <p>${b.desc}</p>
                <span style="font-size:0.7rem; font-weight:800; color:${b.isUnlocked ? '#10B981' : '#94A3B8'};">
                  ${b.isUnlocked ? '✅ UNLOCKED' : '🔒 LOCKED'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const resetBtn = container.querySelector('#btn-reset-trophies');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all stats and badges?')) {
          window.trophyTracker.resetProgress();
          this.renderTrophyRoom();
          this.showToast('Stats and Badges reset!');
        }
      });
    }
  }

  // =========================================================================
  // SVG CHARACTER VECTORS (Colorblind Accessible Expressions)
  // =========================================================================
  createPebbleSvg(colorId, isAtari = false) {
    switch (colorId) {
      case 'ocean-blue':
        // Big round happy eyes with white sparkle catchlights, wide smile
        return `
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <ellipse cx="34" cy="40" rx="9" ry="11" fill="#0F172A"/>
            <circle cx="31" cy="37" r="4" fill="#FFFFFF"/>
            <circle cx="37" cy="44" r="1.8" fill="#FFFFFF"/>
            <ellipse cx="66" cy="40" rx="9" ry="11" fill="#0F172A"/>
            <circle cx="63" cy="37" r="4" fill="#FFFFFF"/>
            <circle cx="69" cy="44" r="1.8" fill="#FFFFFF"/>
            <path d="${isAtari ? 'M 38 64 Q 50 56 62 64' : 'M 36 58 Q 50 74 64 58'}" stroke="#0F172A" stroke-width="4.5" stroke-linecap="round" fill="${isAtari ? 'none' : '#F43F5E'}"/>
            <circle cx="23" cy="52" r="6" fill="#F43F5E" opacity="0.35"/>
            <circle cx="77" cy="52" r="6" fill="#F43F5E" opacity="0.35"/>
            <path d="M 50 14 C 44 4 48 0 54 2 C 55 7 53 11 50 14 Z" fill="#4ADE80" stroke="#15803D" stroke-width="2"/>
          </svg>
        `;
      case 'coral-red':
        // Star pupils, bold smile, determined eyebrows
        return `
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- Eyebrows -->
            <path d="M 24 30 L 42 34" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M 76 30 L 58 34" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>
            <!-- Star Pupils -->
            <polygon points="34,36 36,41 41,41 37,44 38,49 34,46 30,49 31,44 27,41 32,41" fill="#0F172A"/>
            <polygon points="66,36 68,41 73,41 69,44 70,49 66,46 62,49 63,44 59,41 64,41" fill="#0F172A"/>
            <!-- Confident mouth -->
            <path d="${isAtari ? 'M 38 64 Q 50 56 62 64' : 'M 38 58 Q 50 68 62 58'}" stroke="#0F172A" stroke-width="4" stroke-linecap="round" fill="none"/>
            <polygon points="22,54 24,57 27,57 25,59 26,62 23,60 21,62 22,59 19,57 22,57" fill="#FDE047"/>
            <polygon points="78,54 80,57 83,57 81,59 82,62 79,60 77,62 78,59 75,57 78,57" fill="#FDE047"/>
          </svg>
        `;
      case 'sunny-gold':
        // Wink eye + wide eye + tongue out
        return `
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- Wink Left Eye -->
            <path d="M 24 42 Q 34 32 44 42" stroke="#0F172A" stroke-width="4.5" stroke-linecap="round" fill="none"/>
            <!-- Right Open Eye -->
            <ellipse cx="66" cy="40" rx="9" ry="11" fill="#0F172A"/>
            <circle cx="63" cy="37" r="4" fill="#FFFFFF"/>
            <!-- Tongue mouth -->
            <path d="M 38 58 Q 50 72 62 58" stroke="#0F172A" stroke-width="4" stroke-linecap="round" fill="#0F172A"/>
            <ellipse cx="50" cy="65" rx="6" ry="6" fill="#F43F5E"/>
            <!-- Sun rays -->
            <line x1="50" y1="8" x2="50" y2="15" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>
            <line x1="30" y1="12" x2="34" y2="18" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>
            <line x1="70" y1="12" x2="66" y2="18" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>
          </svg>
        `;
      case 'emerald-green':
        // Cool round nerd/swag glasses, sprout
        return `
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- Cool Glasses Bridge -->
            <line x1="42" y1="40" x2="58" y2="40" stroke="#0F172A" stroke-width="3.5"/>
            <!-- Glasses Lenses -->
            <circle cx="32" cy="40" r="14" fill="#FFFFFF" opacity="0.3" stroke="#0F172A" stroke-width="3.5"/>
            <circle cx="68" cy="40" r="14" fill="#FFFFFF" opacity="0.3" stroke="#0F172A" stroke-width="3.5"/>
            <!-- Eyes inside -->
            <circle cx="34" cy="40" r="5" fill="#0F172A"/>
            <circle cx="70" cy="40" r="5" fill="#0F172A"/>
            <!-- Relaxed grin -->
            <path d="M 40 62 Q 50 68 60 60" stroke="#0F172A" stroke-width="4" stroke-linecap="round" fill="none"/>
            <!-- Head Sprout -->
            <path d="M 50 16 C 42 6 46 2 52 4 C 53 9 51 13 50 16 Z" fill="#22C55E" stroke="#15803D" stroke-width="2"/>
            <path d="M 50 16 C 58 8 62 10 61 14 C 57 16 53 15 50 16 Z" fill="#4ADE80" stroke="#15803D" stroke-width="1.8"/>
          </svg>
        `;
      case 'royal-purple':
        // Anime sparkle diamond eyes, cat mouth :3
        return `
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- Diamond Eyes -->
            <polygon points="34,28 42,40 34,52 26,40" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
            <polygon points="34,34 38,40 34,46 30,40" fill="#7E22CE"/>
            <polygon points="66,28 74,40 66,52 58,40" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
            <polygon points="66,34 70,40 66,46 62,40" fill="#7E22CE"/>
            <!-- Cat mouth :3 -->
            <path d="M 38 60 Q 44 65 50 60 Q 56 65 62 60" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" fill="none"/>
            <!-- Sparkle Crown -->
            <polygon points="50,6 52,14 60,14 54,18 56,26 50,21 44,26 46,18 40,14 48,14" fill="#FDE047"/>
          </svg>
        `;
      case 'midnight-slate':
        // Classic Panda eye patches, calm zen smile, bamboo leaf
        return `
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- Panda Eye Patches -->
            <ellipse cx="32" cy="40" rx="14" ry="11" fill="#0F172A" transform="rotate(-15 32 40)"/>
            <ellipse cx="68" cy="40" rx="14" ry="11" fill="#0F172A" transform="rotate(15 68 40)"/>
            <!-- Happy Curved Eyes -->
            <path d="M 26 40 Q 32 35 38 40" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>
            <path d="M 62 40 Q 68 35 74 40" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>
            <!-- Zen Smile -->
            <path d="M 42 60 Q 50 66 58 60" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" fill="none"/>
            <!-- Bamboo Leaf -->
            <path d="M 72 16 C 82 12 86 16 84 22 C 78 24 74 20 72 16 Z" fill="#22C55E" stroke="#15803D" stroke-width="1.8"/>
          </svg>
        `;
      default:
        return `<circle cx="50" cy="50" r="30" fill="#FFFFFF"/>`;
    }
  }

  createTerritoryDecorationSvg(colorId) {
    switch (colorId) {
      case 'ocean-blue':
        // Starfish
        return `
          <svg viewBox="0 0 50 50" width="100%" height="100%">
            <polygon points="25,4 30,18 45,18 33,28 38,42 25,33 12,42 17,28 5,18 20,18" fill="#38BDF8" stroke="#0284C7" stroke-width="2"/>
          </svg>
        `;
      case 'coral-red':
        // Blossom / Star Flag
        return `
          <svg viewBox="0 0 50 50" width="100%" height="100%">
            <circle cx="25" cy="25" r="10" fill="#FB7185" stroke="#BE123C" stroke-width="2"/>
            <circle cx="25" cy="25" r="4" fill="#FEF08A"/>
          </svg>
        `;
      case 'sunny-gold':
        // Sunflower
        return `
          <svg viewBox="0 0 50 50" width="100%" height="100%">
            <circle cx="25" cy="25" r="14" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
            <circle cx="25" cy="25" r="6" fill="#854D0E"/>
          </svg>
        `;
      case 'emerald-green':
        // Clover
        return `
          <svg viewBox="0 0 50 50" width="100%" height="100%">
            <circle cx="20" cy="20" r="7" fill="#4ADE80" stroke="#15803D" stroke-width="1.5"/>
            <circle cx="30" cy="20" r="7" fill="#4ADE80" stroke="#15803D" stroke-width="1.5"/>
            <circle cx="20" cy="30" r="7" fill="#4ADE80" stroke="#15803D" stroke-width="1.5"/>
            <circle cx="30" cy="30" r="7" fill="#4ADE80" stroke="#15803D" stroke-width="1.5"/>
          </svg>
        `;
      case 'royal-purple':
        // Crystal Sparkle
        return `
          <svg viewBox="0 0 50 50" width="100%" height="100%">
            <polygon points="25,5 31,19 45,25 31,31 25,45 19,31 5,25 19,19" fill="#C084FC" stroke="#7E22CE" stroke-width="2"/>
          </svg>
        `;
      case 'midnight-slate':
        // Bamboo shoot / Zen stone
        return `
          <svg viewBox="0 0 50 50" width="100%" height="100%">
            <ellipse cx="25" cy="25" rx="14" ry="9" fill="#94A3B8" stroke="#334155" stroke-width="2"/>
          </svg>
        `;
      default:
        return `<circle cx="25" cy="25" r="8" fill="#10B981"/>`;
    }
  }

  createMasterBaoSvg(mood = 'happy') {
    // Master Bao the Red Panda
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <!-- Red Panda Ears -->
        <polygon points="18,12 36,32 12,38" fill="#C2410C" stroke="#7C2D12" stroke-width="3"/>
        <polygon points="20,18 32,32 16,36" fill="#FFFFFF"/>
        <polygon points="82,12 64,32 88,38" fill="#C2410C" stroke="#7C2D12" stroke-width="3"/>
        <polygon points="80,18 68,32 84,36" fill="#FFFFFF"/>

        <!-- Face Base -->
        <ellipse cx="50" cy="55" rx="42" ry="36" fill="#EA580C" stroke="#7C2D12" stroke-width="3"/>

        <!-- White Cheek/Muzzle Patches -->
        <ellipse cx="26" cy="62" rx="14" ry="18" fill="#FFFFFF" transform="rotate(-15 26 62)"/>
        <ellipse cx="74" cy="62" rx="14" ry="18" fill="#FFFFFF" transform="rotate(15 74 62)"/>
        <ellipse cx="50" cy="68" rx="16" ry="12" fill="#FFFFFF"/>

        <!-- Cute Eyes -->
        ${mood === 'surprised' ? `
          <circle cx="36" cy="48" r="7" fill="#0F172A"/>
          <circle cx="34" cy="46" r="3" fill="#FFFFFF"/>
          <circle cx="64" cy="48" r="7" fill="#0F172A"/>
          <circle cx="62" cy="46" r="3" fill="#FFFFFF"/>
        ` : mood === 'celebrating' ? `
          <path d="M 28 50 Q 36 42 44 50" stroke="#0F172A" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <path d="M 56 50 Q 64 42 72 50" stroke="#0F172A" stroke-width="4.5" stroke-linecap="round" fill="none"/>
        ` : `
          <ellipse cx="36" cy="48" rx="6" ry="7" fill="#0F172A"/>
          <circle cx="34" cy="46" r="2.5" fill="#FFFFFF"/>
          <ellipse cx="64" cy="48" rx="6" ry="7" fill="#0F172A"/>
          <circle cx="62" cy="46" r="2.5" fill="#FFFFFF"/>
        `}

        <!-- Eyebrows -->
        <ellipse cx="34" cy="38" rx="4" ry="2" fill="#FFFFFF"/>
        <ellipse cx="66" cy="38" rx="4" ry="2" fill="#FFFFFF"/>

        <!-- Nose -->
        <polygon points="46,62 54,62 50,67" fill="#0F172A"/>

        <!-- Mouth -->
        <path d="${mood === 'celebrating' ? 'M 42 69 Q 50 78 58 69' : 'M 44 68 Q 50 73 56 68'}" stroke="#0F172A" stroke-width="3" stroke-linecap="round" fill="${mood === 'celebrating' ? '#F43F5E' : 'none'}"/>

        <!-- Scholar Headband Ribbon -->
        <rect x="22" y="24" width="56" height="8" rx="4" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
        <circle cx="50" cy="28" r="6" fill="#10B981" stroke="#065F46" stroke-width="2"/>
      </svg>
    `;
  }

  // =========================================================================
  // RULE BOOK CONTROLLER
  // =========================================================================
  getRuleBookChapters() {
    return [
      {
        id: 'scoring',
        tabTitle: '👑 Scoring Rules',
        badge: 'Rule 1 of 6',
        heroIcon: '👑',
        title: 'Scoring Rules: Spaces & Captures',
        subtitle: '1 Point for occupied/captured spaces, and 2 Points for surrounding captures!',
        diagramType: 'scoring',
        bullets: [
          { icon: '📍', text: '<strong>Occupied Pebble Spots (1 Point):</strong> Every pebble currently sitting on the board claims that garden box for <strong>1 Point</strong>.' },
          { icon: '🏡', text: '<strong>Enclosed & Splash Spaces (1 Point):</strong> Every walled-off empty space and captured splash space scores <strong>1 Point</strong>.' },
          { icon: '💥', text: '<strong>Surrounding Captures (2 Points!):</strong> When you surround an opponent\'s pebble on all corners/sides to capture it, you score <strong>2 Points per captured pebble</strong> (PLUS the space it was on splashes into your territory for +1 Point = <strong>3 Points total net gain</strong>!).' },
          { icon: '📊', text: '<strong>Dynamic Score Meter:</strong> The top meter live-tracks everyone\'s score (Spaces + Capture Points). The leader wears the golden star (★)!' }
        ],
        baoTip: "Capturing an enemy pebble gives you 2 Points for the capture PLUS 1 Point for their splashed ground = 3 Points total swing!"
      },
      {
        id: 'breathing',
        tabTitle: '💨 Breathing',
        badge: 'Rule 2 of 6',
        heroIcon: '💨',
        title: 'Breathing Spaces & Atari Danger',
        subtitle: 'Every Pebble Pal needs room to breathe!',
        diagramType: 'breathing',
        bullets: [
          { icon: '💚', text: '<strong>4 Breathing Spaces:</strong> Pebbles breathe Up, Down, Left, and Right into orthogonally adjacent empty boxes (Liberties).' },
          { icon: '🧱', text: '<strong>Garden Walls Don\'t Breathe:</strong> Edges of the board do NOT give breath! Wall pebbles get 3 breaths, and corner pebbles get only 2 breaths.' },
          { icon: '⚡', text: '<strong>Danger Shake (Atari Alert!):</strong> When a pebble or group has only <strong>1 breathing space left</strong>, it visibly trembles, sweats droplets, and flashes a pulsing red <strong>!</strong> badge!' },
          { icon: '🚨', text: '<strong>Rescue or Attack:</strong> If your pal is trembling in Atari, connect a buddy to save it! If an enemy is trembling, take its last breath to capture it!' }
        ],
        baoTip: 'Keep your eyes peeled for trembling pebbles! They are either crying for help or ready to be popped!'
      },
      {
        id: 'groups',
        tabTitle: '🤝 Handshakes',
        badge: 'Rule 3 of 6',
        heroIcon: '🤝',
        title: 'Holding Hands: Stronger Together',
        subtitle: 'Connected pals become ONE team and share all their breaths!',
        diagramType: 'groups',
        bullets: [
          { icon: '👫', text: '<strong>Orthogonal Handshakes:</strong> Pebbles of the same color touching Up, Down, Left, or Right hold hands to form a unified <strong>Group</strong>.' },
          { icon: '🛡️', text: '<strong>Shared Breathing:</strong> All buddies in a group share their breathing spaces together! If any one buddy has an open breath, the whole group stays safe.' },
          { icon: '❌', text: '<strong>Diagonals Never Connect:</strong> Diagonal neighbors cannot hold hands or share breathing spaces!' },
          { icon: '📜', text: '<strong>Master Bao\'s Rhyme:</strong> <em>"Cross is boss, diagonal is lost!"</em> Always connect orthogonally.' }
        ],
        baoTip: 'A lonely pebble is easy for opponents to surround. Connect your pals together to build strong, unbreakable chains!'
      },
      {
        id: 'capturing',
        tabTitle: '💥 Pop & Splash',
        badge: 'Rule 4 of 6',
        heroIcon: '💥',
        title: 'Pop & Splash: Captures (2 Points!)',
        subtitle: 'Surround all sides to capture opponent pebbles for 2 Points each!',
        diagramType: 'capturing',
        bullets: [
          { icon: '💥', text: '<strong>Capture Bonus (2 Points!):</strong> When you place a pebble that takes away an enemy group\'s last breathing space, they <strong>POP</strong> and award you <strong>2 Points per captured pebble</strong>!' },
          { icon: '🎨', text: '<strong>The Crucial Splash Rule (1 Point):</strong> Every space where those captured enemy pebbles were standing also <strong>splashes into YOUR team\'s territory (+1 Point each)</strong>!' },
          { icon: '🛑', text: '<strong>The No-Suicide Rule:</strong> You cannot place a pebble into a spot where your group would have 0 breathing spaces (unless that move immediately captures enemy pebbles and opens up room!).' },
          { icon: '🏅', text: '<strong>Scoring Summary:</strong> (Occupied Pebbles × 1) + (Captured Spaces × 1) + (Surrounding Captures × 2)!' }
        ],
        baoTip: 'Capturing enemy pebbles gives a massive swing: 2 Points for the capture, PLUS 1 Point for their splashed ground!'
      },
      {
        id: 'fences',
        tabTitle: '🏡 Garden Fences',
        badge: 'Rule 5 of 6',
        heroIcon: '🏡',
        title: 'Building Fences: Enclosed Territory',
        subtitle: 'Wall off empty space to claim huge bonus points!',
        diagramType: 'fences',
        bullets: [
          { icon: '🏰', text: '<strong>The Power of Walls:</strong> Connect your pebbles between the edges of the board (or in a closed loop) to fence off empty garden boxes.' },
          { icon: '🌸', text: '<strong>Enclosed Territory:</strong> Any empty region that only touches YOUR color (and board edges) becomes your enclosed territory (+1 Point per space), decorated with flowers and flags!' },
          { icon: '🛡️', text: '<strong>Kid-Friendly Territory Guard:</strong> If you tap a space that\'s already 100% securely enclosed by your team, the app gently warns you so you don\'t waste a move.' },
          { icon: '👆', text: '<strong>Double-Tap Override:</strong> If you really want to place a pebble in your safe territory anyway, just tap the spot again within 3 seconds!' }
        ],
        baoTip: 'Corners are the easiest places to build fences because the garden borders do half the work for you!'
      },
      {
        id: 'modes',
        tabTitle: '⚔️ Game Modes',
        badge: 'Rule 6 of 6',
        heroIcon: '⚔️',
        title: 'Game Modes & 2v2 Team Battles',
        subtitle: 'Play 1v1, 3-Way, 4-Way, or 2v2 Team Battles!',
        diagramType: 'modes',
        bullets: [
          { icon: '⚔️', text: '<strong>1v1 Duel:</strong> 2 Players (Human vs Human pass-and-play, or Human vs Smart AI Bot).' },
          { icon: '🌀', text: '<strong>3-Way & 4-Way Free-For-All:</strong> Each player gets their own distinct color. Whoever takes an enemy\'s last breath claims the splash!' },
          { icon: '🤝', text: '<strong>2v2 Team Battles:</strong> Team 1 (P1 & P3) vs Team 2 (P2 & P4). <strong>Teammates share the same color pebbles</strong>, automatically connecting and building shared territory!' },
          { icon: '🌿', text: '<strong>Dual Board Styles:</strong> Toggle between tactile <strong>Garden Boxes</strong> and traditional <strong>Classic Go Lines</strong> at any time during a match!' },
          { icon: '🏆', text: '<strong>Ending the Game:</strong> Pass when you\'re done building. When all players pass, or all spaces are claimed, the Victory Celebration launches!' }
        ],
        baoTip: 'In 2v2 Team Battles, talk with your teammate and coordinate your walls to build massive shared kingdoms together!'
      }
    ];
  }

  openRuleBook(pageIndex = 0) {
    this.currentRulePage = pageIndex;
    const modal = document.getElementById('rules-modal');
    if (!modal) return;

    modal.classList.add('active');
    this.renderRuleBookTabs();
    this.renderRuleBookPage();
    this.renderRuleBookDots();

    if (window.soundFx) window.soundFx.playPageFlip();
  }

  closeRuleBook() {
    const modal = document.getElementById('rules-modal');
    if (!modal) return;
    modal.classList.remove('active');
    if (window.soundFx) window.soundFx.playClick();
  }

  changeRulePage(delta) {
    const chapters = this.getRuleBookChapters();
    const nextIdx = this.currentRulePage + delta;

    if (nextIdx >= 0 && nextIdx < chapters.length) {
      this.currentRulePage = nextIdx;
      this.renderRuleBookTabs();
      this.renderRuleBookPage();
      this.renderRuleBookDots();
      if (window.soundFx) window.soundFx.playPageFlip();
    } else if (nextIdx >= chapters.length) {
      // Completed last page
      this.closeRuleBook();
    }
  }

  renderRuleBookTabs() {
    const tabsContainer = document.getElementById('rules-chapter-tabs');
    if (!tabsContainer) return;

    const chapters = this.getRuleBookChapters();
    tabsContainer.innerHTML = chapters.map((chap, idx) => `
      <button class="rules-chapter-pill ${idx === this.currentRulePage ? 'active' : ''}" data-page="${idx}">
        <span>${chap.tabTitle}</span>
      </button>
    `).join('');

    tabsContainer.querySelectorAll('.rules-chapter-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pageIdx = parseInt(e.currentTarget.dataset.page, 10);
        this.currentRulePage = pageIdx;
        this.renderRuleBookTabs();
        this.renderRuleBookPage();
        this.renderRuleBookDots();
        if (window.soundFx) window.soundFx.playPageFlip();
      });
    });
  }

  renderRuleBookPage() {
    const viewport = document.getElementById('rules-page-viewport');
    if (!viewport) return;

    const chapters = this.getRuleBookChapters();
    const chap = chapters[this.currentRulePage];
    if (!chap) return;

    viewport.innerHTML = `
      <div class="rules-page-card">
        <div class="rules-hero-banner">
          <div class="rules-hero-icon">${chap.heroIcon}</div>
          <div class="rules-hero-text">
            <h3>${chap.title}</h3>
            <p>${chap.subtitle}</p>
          </div>
        </div>

        ${this.renderRuleDiagram(chap.diagramType)}

        <div class="rules-bullet-list">
          ${chap.bullets.map(b => `
            <div class="rules-bullet-item">
              <span class="rules-bullet-icon">${b.icon}</span>
              <div class="rules-bullet-text">${b.text}</div>
            </div>
          `).join('')}
        </div>

        <div class="rules-bao-tip">
          <div class="rules-bao-avatar">
            ${this.createMasterBaoSvg('happy')}
          </div>
          <div class="rules-bao-text">
            <strong>Master Bao's Pro Tip:</strong> "${chap.baoTip}"
          </div>
        </div>
      </div>
    `;

    // Update Next/Prev Button text
    const prevBtn = document.getElementById('btn-rules-prev');
    const nextBtn = document.getElementById('btn-rules-next');

    if (prevBtn) {
      prevBtn.style.visibility = this.currentRulePage === 0 ? 'hidden' : 'visible';
    }

    if (nextBtn) {
      if (this.currentRulePage === chapters.length - 1) {
        nextBtn.innerHTML = 'Play Now! 🚀';
      } else {
        nextBtn.innerHTML = 'Next ➡️';
      }
    }
  }

  renderRuleBookDots() {
    const dotsContainer = document.getElementById('rules-page-dots');
    if (!dotsContainer) return;

    const chapters = this.getRuleBookChapters();
    dotsContainer.innerHTML = chapters.map((_, idx) => `
      <div class="rules-dot ${idx === this.currentRulePage ? 'active' : ''}" data-page="${idx}" title="Page ${idx + 1}"></div>
    `).join('');

    dotsContainer.querySelectorAll('.rules-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const pageIdx = parseInt(e.currentTarget.dataset.page, 10);
        this.currentRulePage = pageIdx;
        this.renderRuleBookTabs();
        this.renderRuleBookPage();
        this.renderRuleBookDots();
        if (window.soundFx) window.soundFx.playPageFlip();
      });
    });
  }

  renderRuleDiagram(type) {
    if (type === 'scoring') {
      return `
        <div class="rules-diagram-box">
          <div class="rules-mini-board">
            <div class="rules-mini-cell splash" title="Splashed Capture Ground">🌊</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell enclosed" title="Enclosed Territory">🌸</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#0284C7; color:#fff;" title="Pebble Pal">
              ${this.createPebbleSvg('ocean-blue')}
            </div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell enclosed" title="Enclosed Territory">🌸</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell splash" title="Splashed Capture Ground">🌊</div>
          </div>
          <div class="rules-diagram-caption">
            <strong>How You Score Points:</strong><br>
            • 📍 <strong>Occupied Spot:</strong> 1 Pt per placed pebble.<br>
            • 🌸 <strong>Captured Space:</strong> 1 Pt per enclosed/splash space.<br>
            • 💥 <strong>Surround Capture:</strong> 2 Pts per popped enemy pebble (+1 Pt splash space = 3 Pts net gain!).
          </div>
        </div>
      `;
    }

    if (type === 'breathing') {
      return `
        <div class="rules-diagram-box">
          <div class="rules-mini-board">
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell" style="background:#0284C7;">
              ${this.createPebbleSvg('ocean-blue')}
            </div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell">🌱</div>
          </div>
          <div class="rules-diagram-caption">
            <strong>Breathing Spaces (Liberties):</strong><br>
            • Orthogonal neighbors (Up, Down, Left, Right) give breath.<br>
            • 💚 <strong>Green Hearts:</strong> Open breathing spaces.<br>
            • ⚡ <strong>Atari:</strong> When only 1 breath remains, your pal shakes and sweats in danger!
          </div>
        </div>
      `;
    }

    if (type === 'groups') {
      return `
        <div class="rules-diagram-box">
          <div class="rules-mini-board">
            <div class="rules-mini-cell" style="background:#FEE2E2; color:#EF4444; font-weight:900;">❌</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell" style="background:#0284C7;">
              ${this.createPebbleSvg('ocean-blue')}
            </div>
            <div class="rules-mini-cell" style="background:#0284C7;">
              ${this.createPebbleSvg('ocean-blue')}
            </div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
            <div class="rules-mini-cell" style="background:#DCFCE7;">💚</div>
          </div>
          <div class="rules-diagram-caption">
            <strong>Holding Hands (Groups):</strong><br>
            • Friends touching Up/Down/Left/Right merge into ONE group.<br>
            • They share all 6 breaths (💚) together!<br>
            • ❌ <strong>Diagonal:</strong> Never connects! Orthogonal only.
          </div>
        </div>
      `;
    }

    if (type === 'capturing') {
      return `
        <div class="rules-diagram-box">
          <div class="rules-mini-board">
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell splash" style="font-size:1.3rem;">💥</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell">🌱</div>
          </div>
          <div class="rules-diagram-caption">
            <strong>Pop & Splash Capture:</strong><br>
            • Surround enemy on all corners/sides to take its last breath.<br>
            • 💥 <strong>POP (2 Pts):</strong> Capture gives +2 Points per pebble!<br>
            • 🎨 <strong>Splash (1 Pt):</strong> Vacated spot becomes your territory!
          </div>
        </div>
      `;
    }

    if (type === 'fences') {
      return `
        <div class="rules-diagram-box">
          <div class="rules-mini-board">
            <div class="rules-mini-cell enclosed" style="font-size:0.8rem; font-weight:900; color:#15803D;">🌸 +1</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell">🌱</div>
          </div>
          <div class="rules-diagram-caption">
            <strong>Garden Fences (Enclosing):</strong><br>
            • Wall off corner or side empty boxes.<br>
            • The inner empty box is 100% yours (🌸) without needing a pebble on it!<br>
            • Save moves and expand your territory faster.
          </div>
        </div>
      `;
    }

    if (type === 'modes') {
      return `
        <div class="rules-diagram-box">
          <div class="rules-mini-board">
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell" style="background:#0284C7;">${this.createPebbleSvg('ocean-blue')}</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#E11D48;">${this.createPebbleSvg('coral-red')}</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell">🌱</div>
            <div class="rules-mini-cell" style="background:#E11D48;">${this.createPebbleSvg('coral-red')}</div>
            <div class="rules-mini-cell" style="background:#E11D48;">${this.createPebbleSvg('coral-red')}</div>
          </div>
          <div class="rules-diagram-caption">
            <strong>2v2 Team Battles:</strong><br>
            • Team 1 (P1 & P3) uses Blue.<br>
            • Team 2 (P2 & P4) uses Red.<br>
            • Teammates place the same color pebbles and connect together!
          </div>
        </div>
      `;
    }

    return '';
  }
}

// Instantiate App on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new PebblePalsApp();
});
