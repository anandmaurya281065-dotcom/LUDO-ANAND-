/**
     * =========================================================================
     * ROYAL LUDO — COMPLETE OFFLINE BOARD GAME ENGINE
     * =========================================================================
     */

    // --- 1. WEB AUDIO SYNTHESIZER (100% Offline Sound Effects) ---
    class SoundFX {
      constructor() {
        this.ctx = null;
        this.muted = false;
      }

      init() {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      }

      toggleMute() {
        this.muted = !this.muted;
        return this.muted;
      }

      playTone(freq, type, duration, startTime = 0, vol = 0.15) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime + startTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      }

      diceRoll() {
        if (this.muted) return;
        for (let i = 0; i < 6; i++) {
          this.playTone(180 + Math.random() * 240, 'triangle', 0.05, i * 0.055, 0.12);
        }
      }

      hop() {
        this.playTone(440, 'sine', 0.09, 0, 0.14);
        this.playTone(620, 'sine', 0.07, 0.03, 0.1);
      }

      unlock() {
        this.playTone(523.25, 'triangle', 0.12, 0, 0.18);
        this.playTone(659.25, 'triangle', 0.12, 0.08, 0.18);
        this.playTone(783.99, 'triangle', 0.2, 0.16, 0.2);
      }

      capture() {
        this.playTone(300, 'sawtooth', 0.12, 0, 0.18);
        this.playTone(210, 'sawtooth', 0.15, 0.09, 0.18);
        this.playTone(130, 'sawtooth', 0.25, 0.18, 0.2);
      }

      homeReach() {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, idx) => this.playTone(n, 'triangle', 0.18, idx * 0.08, 0.18));
      }

      winFanfare() {
        const melody = [
          { f: 523.25, t: 0, d: 0.15 },
          { f: 659.25, t: 0.15, d: 0.15 },
          { f: 783.99, t: 0.3, d: 0.15 },
          { f: 1046.5, t: 0.45, d: 0.35 },
          { f: 783.99, t: 0.82, d: 0.15 },
          { f: 1046.5, t: 1.0, d: 0.5 }
        ];
        melody.forEach(m => this.playTone(m.f, 'triangle', m.d, m.t, 0.22));
      }
    }

    const sfx = new SoundFX();

    // --- 2. BOARD GEOMETRY & PATH COORDINATES (15x15 Grid, 0-indexed row, col) ---
    // 52-square clockwise outer perimeter starting at Red's start square (row 6, col 1)
    const MAIN_TRACK = [
      // Red arm going right (0..4)
      [6,1], [6,2], [6,3], [6,4], [6,5],
      // Green arm going up (5..10)
      [5,6], [4,6], [3,6], [2,6], [1,6], [0,6],
      // Top turn (11..12)
      [0,7], [0,8],
      // Green arm going down (13..17) -> index 13 is Green start [1,8]
      [1,8], [2,8], [3,8], [4,8], [5,8],
      // Yellow arm going right (18..23)
      [6,9], [6,10], [6,11], [6,12], [6,13], [6,14],
      // Right turn (24..25)
      [7,14], [8,14],
      // Yellow arm going left (26..30) -> index 26 is Yellow start [8,13]
      [8,13], [8,12], [8,11], [8,10], [8,9],
      // Blue arm going down (31..36)
      [9,8], [10,8], [11,8], [12,8], [13,8], [14,8],
      // Bottom turn (37..38)
      [14,7], [14,6],
      // Blue arm going up (39..43) -> index 39 is Blue start [13,6]
      [13,6], [12,6], [11,6], [10,6], [9,6],
      // Red arm going left (44..49)
      [8,5], [8,4], [8,3], [8,2], [8,1], [8,0],
      // Left turn (50..51)
      [7,0], [6,0]
    ];

    // Home stretch 5 squares + final center goal (step 51..56)
    const HOME_STRETCHES = {
      red:    [[7,1], [7,2], [7,3], [7,4], [7,5], [7, 6.35]],
      green:  [[1,7], [2,7], [3,7], [4,7], [5,7], [6.35, 7]],
      yellow: [[7,13], [7,12], [7,11], [7,10], [7,9], [7, 7.65]],
      blue:   [[13,7], [12,7], [11,7], [10,7], [9,7], [7.65, 7]]
    };

    // Yard spot centers (in 0..14 grid coordinate units)
    const YARD_SPOTS = {
      red:    [[1.85, 1.85], [1.85, 3.15], [3.15, 1.85], [3.15, 3.15]],
      green:  [[1.85, 10.85], [1.85, 12.15], [3.15, 10.85], [3.15, 12.15]],
      yellow: [[10.85, 10.85], [10.85, 12.15], [12.15, 10.85], [12.15, 12.15]],
      blue:   [[10.85, 1.85], [10.85, 3.15], [12.15, 1.85], [12.15, 3.15]]
    };

    const START_OFFSETS = {
      red: 0,
      green: 13,
      yellow: 26,
      blue: 39
    };

    // Safe global track indices: 4 colored start squares + 4 star squares
    const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

    const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
    const COLOR_META = {
      red:    { label: 'Red',    bgClass: 'bg-rose-600',   borderClass: 'border-rose-500',   ringClass: 'ring-rose-500/40' },
      green:  { label: 'Green',  bgClass: 'bg-green-600',  borderClass: 'border-green-500',  ringClass: 'ring-green-500/40' },
      yellow: { label: 'Yellow', bgClass: 'bg-yellow-500', borderClass: 'border-yellow-400', ringClass: 'ring-yellow-400/40' },
      blue:   { label: 'Blue',   bgClass: 'bg-blue-600',   borderClass: 'border-blue-500',   ringClass: 'ring-blue-500/40' }
    };

    // --- 3. GAME STATE ---
    const state = {
      players: {},
      activeColors: ['red', 'green', 'yellow', 'blue'],
      turnIndex: 0,
      diceValue: null,
      hasSelectedDice: false,
      isAnimating: false,
      consecutiveSixes: 0,
      validMoves: [],
      rankings: [],
      autoMoveSingle: false,
      gameOver: false
    };

    // Setup Modal State (4 Human Players by default)
    const setupConfig = {
      count: 4
    };

    // --- 4. BUILD THE 15x15 LUDO BOARD DOM ---
    function buildBoardDOM() {
      const board = document.getElementById('ludoBoard');
      const tokensLayer = document.getElementById('tokensLayer');
      board.innerHTML = '';

      // Lookup maps for special cells
      const safeCoords = new Set();
      SAFE_TRACK_INDICES.forEach(idx => {
        const [r, c] = MAIN_TRACK[idx];
        safeCoords.add(`${r},${c}`);
      });

      const homeCellColors = {};
      Object.entries(HOME_STRETCHES).forEach(([color, coords]) => {
        for (let i = 0; i < 5; i++) {
          const [r, c] = coords[i];
          homeCellColors[`${r},${c}`] = color;
        }
      });

      const startCellColors = {
        '6,1': 'red',
        '1,8': 'green',
        '8,13': 'yellow',
        '13,6': 'blue'
      };

      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          // Skip cells occupied by the 4 corner 6x6 yards and 3x3 center home
          if (r < 6 && c < 6) {
            if (r === 0 && c === 0) board.appendChild(createYard('red', 1, 1));
            continue;
          }
          if (r < 6 && c > 8) {
            if (r === 0 && c === 9) board.appendChild(createYard('green', 1, 10));
            continue;
          }
          if (r > 8 && c > 8) {
            if (r === 9 && c === 9) board.appendChild(createYard('yellow', 10, 10));
            continue;
          }
          if (r > 8 && c < 6) {
            if (r === 9 && c === 0) board.appendChild(createYard('blue', 10, 1));
            continue;
          }
          if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
            if (r === 6 && c === 6) board.appendChild(createCenterHome());
            continue;
          }

          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.style.gridRow = r + 1;
          cell.style.gridColumn = c + 1;

          const key = `${r},${c}`;
          const stretchColor = homeCellColors[key];
          const startColor = startCellColors[key];

          if (stretchColor) {
            cell.classList.add(`bg-${stretchColor}-main`);
          } else if (startColor) {
            cell.classList.add(`bg-${startColor}-main`, 'colored-safe');
          }

          if (safeCoords.has(key)) {
            cell.innerHTML = `
              <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>`;
          }

          board.appendChild(cell);
        }
      }

      board.appendChild(tokensLayer);
    }

    function createYard(color, gridRowStart, gridColStart) {
      const yard = document.createElement('div');
      yard.className = `yard bg-${color}-main`;
      yard.style.gridRow = `${gridRowStart} / span 6`;
      yard.style.gridColumn = `${gridColStart} / span 6`;

      const inner = document.createElement('div');
      inner.className = 'yard-inner';
      for (let i = 0; i < 4; i++) {
        const spot = document.createElement('div');
        spot.className = `yard-spot spot-${color}`;
        inner.appendChild(spot);
      }
      yard.appendChild(inner);
      return yard;
    }

    function createCenterHome() {
      const center = document.createElement('div');
      center.className = 'center-home';
      center.innerHTML = `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="0,0 50,50 0,100" fill="var(--red)" stroke="#1e293b" stroke-width="1"/>
          <polygon points="0,0 100,0 50,50" fill="var(--green)" stroke="#1e293b" stroke-width="1"/>
          <polygon points="100,0 100,100 50,50" fill="var(--yellow)" stroke="#1e293b" stroke-width="1"/>
          <polygon points="0,100 100,100 50,50" fill="var(--blue)" stroke="#1e293b" stroke-width="1"/>
          <circle cx="50" cy="50" r="14" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
          <text x="50" y="54" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">★</text>
        </svg>
      `;
      return center;
    }

    // --- 5. COORDINATE & TOKEN POSITIONING ---
    // Token progress: -1 = in yard, 0..50 = outer track steps, 51..55 = home stretch, 56 = finished
    function getTokenGridCoords(color, tokenIdx, progress) {
      if (progress === -1) {
        return YARD_SPOTS[color][tokenIdx];
      }
      if (progress <= 50) {
        const globalIdx = (START_OFFSETS[color] + progress) % 52;
        return MAIN_TRACK[globalIdx];
      }
      const homeIdx = Math.min(progress - 51, 5);
      return HOME_STRETCHES[color][homeIdx];
    }

    function getGlobalTrackIndex(color, progress) {
      if (progress < 0 || progress > 50) return -1;
      return (START_OFFSETS[color] + progress) % 52;
    }

    function createTokenElements() {
      const layer = document.getElementById('tokensLayer');
      layer.innerHTML = '';

      state.activeColors.forEach(color => {
        const player = state.players[color];
        player.tokens.forEach((token, idx) => {
          const el = document.createElement('div');
          el.id = `token-${color}-${idx}`;
          el.className = `token ${color}`;
          el.dataset.color = color;
          el.dataset.index = idx;
          el.addEventListener('click', () => handleTokenClick(color, idx));
          layer.appendChild(el);
        });
      });

      renderAllTokens();
    }

    function renderAllTokens(hoppingToken = null) {
      // Group tokens occupying identical coordinates to apply smart visual stacking offsets
      const cellGroups = {};

      state.activeColors.forEach(color => {
        state.players[color].tokens.forEach((progress, idx) => {
          const [r, c] = getTokenGridCoords(color, idx, progress);
          const key = `${r.toFixed(2)},${c.toFixed(2)}`;
          if (!cellGroups[key]) cellGroups[key] = [];
          cellGroups[key].push({ color, idx, r, c, progress });
        });
      });

      Object.values(cellGroups).forEach(group => {
        const count = group.length;
        group.forEach((item, groupIdx) => {
          const el = document.getElementById(`token-${item.color}-${item.idx}`);
          if (!el) return;

          let offsetX = 0;
          let offsetY = 0;
          let scale = 1;

          // Stack offset when multiple tokens share a square (except yard spots)
          if (count > 1 && item.progress !== -1) {
            scale = count >= 4 ? 0.72 : 0.8;
            const angle = (groupIdx / count) * Math.PI * 2 - Math.PI / 4;
            const radius = 0.2;
            offsetX = Math.cos(angle) * radius;
            offsetY = Math.sin(angle) * radius;
          }

          const leftPct = ((item.c + 0.5 + offsetX) / 15) * 100;
          const topPct = ((item.r + 0.5 + offsetY) / 15) * 100;

          el.style.left = `${leftPct}%`;
          el.style.top = `${topPct}%`;
          el.style.width = `${5.2 * scale}%`;
          el.style.height = `${5.2 * scale}%`;
          el.style.zIndex = 20 + groupIdx;

          if (hoppingToken && hoppingToken.color === item.color && hoppingToken.idx === item.idx) {
            el.classList.add('hopping');
          } else {
            el.classList.remove('hopping');
          }
        });
      });

      updatePlayerProgressPips();
    }

    // --- 6. GAME RULES & MOVE VALIDATION ---
    function getValidMoves(color, diceVal) {
      const tokens = state.players[color].tokens;
      const moves = [];

      tokens.forEach((progress, idx) => {
        if (progress === 56) return; // Already finished

        if (progress === -1) {
          // Need a 6 to exit home yard
          if (diceVal === 6) {
            moves.push({ tokenIdx: idx, from: -1, to: 0, type: 'unlock' });
          }
        } else if (progress + diceVal <= 56) {
          const target = progress + diceVal;
          moves.push({
            tokenIdx: idx,
            from: progress,
            to: target,
            type: target === 56 ? 'finish' : 'advance'
          });
        }
      });

      return moves;
    }

    function highlightMovableTokens(moves) {
      document.querySelectorAll('.token').forEach(el => el.classList.remove('movable'));
      const currentColor = state.activeColors[state.turnIndex];

      moves.forEach(m => {
        const el = document.getElementById(`token-${currentColor}-${m.tokenIdx}`);
        if (el) el.classList.add('movable');
      });
    }

    // --- 7. 6-DICE SELECTION & TURN FLOW ---
    function updateDicePadVisual(selectedVal = null) {
      const indicator = document.getElementById('selectedDiceIndicator');
      indicator.textContent = selectedVal ? `Dice: ${selectedVal}` : 'Dice: —';

      document.querySelectorAll('.dice-pad-btn').forEach(btn => {
        const val = Number(btn.dataset.dice);
        if (selectedVal === val) {
          btn.classList.add('selected-dice');
        } else {
          btn.classList.remove('selected-dice');
        }
      });
    }

    function selectDiceValue(chosenVal) {
      if (state.gameOver || state.isAnimating || state.hasSelectedDice) return;
      if (chosenVal < 1 || chosenVal > 6) return;

      const currentColor = state.activeColors[state.turnIndex];
      const player = state.players[currentColor];

      state.diceValue = chosenVal;
      state.hasSelectedDice = true;

      sfx.diceRoll();
      updateDicePadVisual(chosenVal);
      updateControlsUI();

      if (chosenVal === 6) {
        state.consecutiveSixes++;
      } else {
        state.consecutiveSixes = 0;
      }

      updateSixStreakBadge();
      logEvent(`${player.name} selected dice ${chosenVal}${chosenVal === 6 ? ' 🎲' : ''}`);

      // Triple-6 penalty
      if (state.consecutiveSixes === 3) {
        setStatus(`Oh no! Three 6s in a row — ${player.name}'s turn is forfeited!`);
        logEvent(`⚠️ Triple 6s! ${player.name} loses turn.`);
        state.consecutiveSixes = 0;
        updateSixStreakBadge();
        setTimeout(() => advanceToNextPlayer(), 1100);
        return;
      }

      const moves = getValidMoves(currentColor, chosenVal);
      state.validMoves = moves;

      if (moves.length === 0) {
        setStatus(`No valid moves for ${player.name} with ${chosenVal}. Passing turn...`);
        setTimeout(() => advanceToNextPlayer(), 950);
        return;
      }

      // Check if all valid moves are identical (e.g., multiple tokens in yard with a 6)
      const uniqueTargets = new Set(moves.map(m => `${m.from}->${m.to}`));

      if (state.autoMoveSingle && (moves.length === 1 || uniqueTargets.size === 1)) {
        setStatus(`Auto-moving ${player.name}'s token...`);
        setTimeout(() => {
          executeMove(currentColor, moves[0]);
        }, 350);
      } else {
        highlightMovableTokens(moves);
        setStatus(`Click a glowing token to move ${chosenVal} step${chosenVal > 1 ? 's' : ''}!`);
      }
    }

    function findOpponentTokensAt(myColor, globalIdx) {
      const victims = [];
      state.activeColors.forEach(otherColor => {
        if (otherColor === myColor) return;
        state.players[otherColor].tokens.forEach((prog, idx) => {
          if (prog >= 0 && prog <= 50 && getGlobalTrackIndex(otherColor, prog) === globalIdx) {
            victims.push({ color: otherColor, tokenIdx: idx });
          }
        });
      });
      return victims;
    }

    // --- 8. STEP-BY-STEP MOVEMENT ANIMATION & CAPTURE LOGIC ---
    function handleTokenClick(color, tokenIdx) {
      const currentColor = state.activeColors[state.turnIndex];
      if (color !== currentColor) return;
      if (!state.hasSelectedDice || state.isAnimating) return;

      const move = state.validMoves.find(m => m.tokenIdx === tokenIdx);
      if (!move) return;

      executeMove(color, move);
    }

    async function executeMove(color, move) {
      state.isAnimating = true;
      state.validMoves = [];
      highlightMovableTokens([]);
      updateControlsUI();

      const player = state.players[color];

      if (move.type === 'unlock') {
        player.tokens[move.tokenIdx] = 0;
        sfx.unlock();
        renderAllTokens({ color, idx: move.tokenIdx });
        await sleep(260);
        renderAllTokens();
      } else {
        // Animate step-by-step hop
        for (let step = move.from + 1; step <= move.to; step++) {
          player.tokens[move.tokenIdx] = step;
          sfx.hop();
          renderAllTokens({ color, idx: move.tokenIdx });
          await sleep(175);
        }
        renderAllTokens();
      }

      let earnedBonusRoll = (state.diceValue === 6);

      // Check for capture on destination square
      const destGlobal = getGlobalTrackIndex(color, move.to);
      if (destGlobal !== -1 && !SAFE_TRACK_INDICES.has(destGlobal)) {
        const victims = findOpponentTokensAt(color, destGlobal);
        if (victims.length > 0) {
          sfx.capture();
          victims.forEach(v => {
            state.players[v.color].tokens[v.tokenIdx] = -1;
          });
          renderAllTokens();
          const victimNames = [...new Set(victims.map(v => state.players[v.color].name))].join(' & ');
          setStatus(`💥 ${player.name} captured ${victimNames}! Bonus turn!`);
          logEvent(`💥 ${player.name} sent ${victimNames} back to yard!`);
          earnedBonusRoll = true;
          await sleep(450);
        }
      }

      // Check if token reached home center
      if (move.to === 56) {
        sfx.homeReach();
        earnedBonusRoll = true;
        setStatus(`🏠 ${player.name} brought a token home! Bonus turn!`);
        logEvent(`🏠 ${player.name} scored a token home!`);
      }

      // Check if player has finished all 4 tokens
      const finishedCount = player.tokens.filter(p => p === 56).length;
      if (finishedCount === 4 && !state.rankings.includes(color)) {
        state.rankings.push(color);
        const place = ordinal(state.rankings.length);
        sfx.winFanfare();
        launchConfetti();
        setStatus(`🏆 ${player.name} finished in ${place} place!`);
        logEvent(`🏆 ${player.name} finished ${place}!`);
        updatePlayerCardsUI();

        // Check if match is over (all but 1 player finished)
        if (state.rankings.length >= state.activeColors.length - 1) {
          const remaining = state.activeColors.find(c => !state.rankings.includes(c));
          if (remaining) state.rankings.push(remaining);
          state.isAnimating = false;
          state.gameOver = true;
          setTimeout(showVictoryModal, 900);
          return;
        }
        // Finished player passes turn to remaining players
        earnedBonusRoll = false;
      }

      state.isAnimating = false;

      if (earnedBonusRoll && !state.rankings.includes(color)) {
        state.hasSelectedDice = false;
        state.diceValue = null;
        updateDicePadVisual(null);
        setStatus(`🎲 Bonus turn for ${player.name}! Pick a dice (1–6).`);
        updateControlsUI();
      } else {
        state.consecutiveSixes = 0;
        updateSixStreakBadge();
        advanceToNextPlayer();
      }
    }

    function advanceToNextPlayer() {
      if (state.gameOver) return;

      state.hasSelectedDice = false;
      state.diceValue = null;
      state.validMoves = [];
      state.consecutiveSixes = 0;
      updateDicePadVisual(null);
      updateSixStreakBadge();

      // Find next active player who hasn't finished all 4 tokens
      let attempts = 0;
      do {
        state.turnIndex = (state.turnIndex + 1) % state.activeColors.length;
        attempts++;
      } while (
        state.rankings.includes(state.activeColors[state.turnIndex]) &&
        attempts <= state.activeColors.length
      );

      const nextColor = state.activeColors[state.turnIndex];
      const nextPlayer = state.players[nextColor];

      updateTurnUI();
      updateControlsUI();
      setStatus(`${nextPlayer.name}'s turn — click a dice number (1–6)!`);
    }

    // --- 9. UI & HUD UPDATES ---
    function updateTurnUI() {
      const currentColor = state.activeColors[state.turnIndex];
      const player = state.players[currentColor];
      const meta = COLOR_META[currentColor];

      const banner = document.getElementById('turnBanner');
      banner.className = `inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow ${meta.bgClass}`;
      document.getElementById('turnPlayerText').textContent = `${player.name}'s Turn`;

      updatePlayerCardsUI();
    }

    function updatePlayerCardsUI() {
      const currentColor = state.activeColors[state.turnIndex];

      COLOR_ORDER.forEach(color => {
        const card = document.getElementById(`card-${color}`);
        const isActiveInMatch = state.activeColors.includes(color);

        if (!isActiveInMatch) {
          card.classList.add('opacity-35');
          card.classList.remove('ring-4', 'scale-[1.02]');
          document.getElementById(`badge-${color}`).textContent = 'Inactive';
          document.getElementById(`pips-${color}`).innerHTML = '';
          document.getElementById(`rank-${color}`).textContent = '';
          return;
        }

        card.classList.remove('opacity-35');
        const player = state.players[color];
        document.getElementById(`name-${color}`).textContent = player.name;
        document.getElementById(`badge-${color}`).textContent = '👤 Human';

        const rankIdx = state.rankings.indexOf(color);
        document.getElementById(`rank-${color}`).textContent =
          rankIdx !== -1 ? `🏅 ${ordinal(rankIdx + 1)}` : '';

        if (color === currentColor && !state.gameOver) {
          card.classList.add('ring-4', COLOR_META[color].ringClass, COLOR_META[color].borderClass, 'scale-[1.02]');
        } else {
          card.classList.remove('ring-4', 'scale-[1.02]', 'border-rose-500', 'border-green-500', 'border-yellow-400', 'border-blue-500');
          card.classList.add('border-white/10');
        }
      });

      updatePlayerProgressPips();
    }

    function updatePlayerProgressPips() {
      state.activeColors.forEach(color => {
        const container = document.getElementById(`pips-${color}`);
        if (!container) return;
        const tokens = state.players[color].tokens;
        container.innerHTML = tokens.map(prog => {
          if (prog === 56) {
            return `<span class="w-3 h-3 rounded-full bg-amber-400 ring-1 ring-white inline-block" title="Finished"></span>`;
          } else if (prog >= 0) {
            return `<span class="w-3 h-3 rounded-full ${COLOR_META[color].bgClass} ring-1 ring-white/80 inline-block" title="On Track"></span>`;
          } else {
            return `<span class="w-3 h-3 rounded-full bg-white/15 border border-white/25 inline-block" title="In Yard"></span>`;
          }
        }).join('');
      });
    }

    function updateControlsUI() {
      const canPickDice = !state.gameOver && !state.hasSelectedDice && !state.isAnimating;

      document.querySelectorAll('.dice-pad-btn').forEach(btn => {
        btn.disabled = !canPickDice;
      });
    }

    function updateSixStreakBadge() {
      const badge = document.getElementById('sixStreakBadge');
      if (state.consecutiveSixes > 0) {
        badge.textContent = `🔥 6s: ${state.consecutiveSixes}/3`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    function setStatus(text) {
      document.getElementById('statusMessage').textContent = text;
    }

    function logEvent(text) {
      const log = document.getElementById('moveLog');
      const entry = document.createElement('div');
      entry.textContent = `• ${text}`;
      log.prepend(entry);
      if (log.children.length > 35) {
        log.removeChild(log.lastChild);
      }
    }

    function showVictoryModal() {
      const modal = document.getElementById('victoryModal');
      const list = document.getElementById('podiumList');
      const medals = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place', '4th Place'];

      list.innerHTML = state.rankings.map((color, idx) => {
        const player = state.players[color];
        return `
          <div class="flex items-center justify-between p-3 rounded-xl bg-white/10 border border-white/15">
            <div class="flex items-center gap-2.5">
              <span class="w-4 h-4 rounded-full ${COLOR_META[color].bgClass} ring-2 ring-white"></span>
              <span class="font-display font-bold text-white">${player.name}</span>
            </div>
            <span class="font-display font-bold text-amber-300 text-sm">${medals[idx] || ''}</span>
          </div>
        `;
      }).join('');

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      sfx.winFanfare();
      launchConfetti();
    }

    function launchConfetti() {
      const colors = ['#f43f5e', '#22c55e', '#eab308', '#3b82f6', '#f97316', '#a855f7'];
      for (let i = 0; i < 48; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = `${1.8 + Math.random() * 1.8}s`;
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 3800);
      }
    }

    function ordinal(n) {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- 11. SETUP & MATCH INITIALIZATION ---
    function updateSetupModalUI() {
      document.querySelectorAll('.count-btn').forEach(btn => {
        const c = Number(btn.dataset.count);
        if (c === setupConfig.count) {
          btn.className = 'count-btn py-2.5 rounded-xl font-display font-bold text-sm border-2 border-amber-400 bg-amber-500/20 text-amber-200 transition';
        } else {
          btn.className = 'count-btn py-2.5 rounded-xl font-display font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 transition';
        }
      });

      // For 2 players, use diagonal corners (Red vs Yellow) for classic balanced gameplay
      const activeForCount =
        setupConfig.count === 2 ? ['red', 'yellow'] :
        setupConfig.count === 3 ? ['red', 'green', 'yellow'] :
        ['red', 'green', 'yellow', 'blue'];

      COLOR_ORDER.forEach(color => {
        const row = document.getElementById(`slot-row-${color}`);
        if (activeForCount.includes(color)) {
          row.classList.remove('opacity-35', 'pointer-events-none');
        } else {
          row.classList.add('opacity-35', 'pointer-events-none');
        }
      });
    }

    function startNewMatch() {
      sfx.init();

      const activeColors =
        setupConfig.count === 2 ? ['red', 'yellow'] :
        setupConfig.count === 3 ? ['red', 'green', 'yellow'] :
        ['red', 'green', 'yellow', 'blue'];

      state.activeColors = activeColors;
      state.players = {};
      state.turnIndex = 0;
      state.diceValue = null;
      state.hasSelectedDice = false;
      state.isAnimating = false;
      state.consecutiveSixes = 0;
      state.validMoves = [];
      state.rankings = [];
      state.gameOver = false;
      state.autoMoveSingle = document.getElementById('autoMoveCheckbox').checked;

      activeColors.forEach(color => {
        const rawName = document.getElementById(`input-name-${color}`).value.trim();
        state.players[color] = {
          name: rawName || COLOR_META[color].label,
          tokens: [-1, -1, -1, -1]
        };
      });

      document.getElementById('setupModal').classList.add('hidden');
      document.getElementById('victoryModal').classList.add('hidden');
      document.getElementById('victoryModal').classList.remove('flex');
      document.getElementById('moveLog').innerHTML = '';

      updateDicePadVisual(null);
      createTokenElements();
      updateTurnUI();
      updateControlsUI();
      updateSixStreakBadge();

      const firstPlayer = state.players[state.activeColors[0]];
      logEvent(`Match started! ${activeColors.length} Human players.`);
      setStatus(`${firstPlayer.name}'s turn — click a dice number (1–6)!`);
    }

    // --- 11. EVENT LISTENERS ---
    window.addEventListener('DOMContentLoaded', () => {
      buildBoardDOM();
      updateSetupModalUI();

      // Player count buttons
      document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setupConfig.count = Number(btn.dataset.count);
          updateSetupModalUI();
        });
      });

      // Start & New Game Buttons
      document.getElementById('startGameBtn').addEventListener('click', startNewMatch);
      document.getElementById('newGameBtn').addEventListener('click', () => {
        document.getElementById('setupModal').classList.remove('hidden');
      });
      document.getElementById('playAgainBtn').addEventListener('click', () => {
        document.getElementById('victoryModal').classList.add('hidden');
        document.getElementById('victoryModal').classList.remove('flex');
        document.getElementById('setupModal').classList.remove('hidden');
      });

      // 6 Clickable Dice Buttons (1 to 6)
      document.querySelectorAll('.dice-pad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = Number(btn.dataset.dice);
          selectDiceValue(val);
        });
      });

      // Sound Toggle
      document.getElementById('soundToggleBtn').addEventListener('click', () => {
        const muted = sfx.toggleMute();
        document.getElementById('soundIcon').textContent = muted ? '🔇' : '🔊';
        document.getElementById('soundLabel').textContent = muted ? 'Muted' : 'Sound On';
      });

      // Rules Modal
      document.getElementById('rulesBtn').addEventListener('click', () => {
        const m = document.getElementById('rulesModal');
        m.classList.remove('hidden');
        m.classList.add('flex');
      });
      const closeRules = () => {
        const m = document.getElementById('rulesModal');
        m.classList.add('hidden');
        m.classList.remove('flex');
      };
      document.getElementById('closeRulesBtn').addEventListener('click', closeRules);
      document.getElementById('gotItRulesBtn').addEventListener('click', closeRules);
    });
