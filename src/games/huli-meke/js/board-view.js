// Board SVG renderer and touch/click handler for Huli Meke
// Renders stone-engraving boards strictly adhering to DESIGN_SYSTEM.md and MASTER_SPEC.md

export function getNearestPoint(board, svgX, svgY, maxRadius = 28) {
  let closestId = null;
  let minDistanceSq = maxRadius * maxRadius;

  for (const [id, [x, y]] of Object.entries(board.nodes)) {
    const dx = svgX - x;
    const dy = svgY - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= minDistanceSq) {
      minDistanceSq = distSq;
      closestId = id;
    }
  }

  return closestId;
}

export function clientToSvgCoords(svgElement, clientX, clientY) {
  const pt = svgElement.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgElement.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const svgP = pt.matrixTransform(ctm.inverse());
  return { x: svgP.x, y: svgP.y };
}

export function renderBoardSVG(board, options = {}) {
  const {
    pieces = {},
    legalTargets = [],
    selectedNode = null,
    hintNodes = [],
    size = 280,
    ariaLabel = board.name
  } = options;

  const [w, h] = board.viewBox;
  const legalSet = new Set(legalTargets);
  const hintSet = new Set(hintNodes);

  // Height proportional to viewBox
  const renderHeight = Math.round(size * (h / w));

  let svg = `<svg class="board-svg" width="${size}" height="${renderHeight}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${ariaLabel}" xmlns="http://www.w3.org/2000/svg">`;

  // 1. Draw Lines (stroke #5A4630, width 3, round caps)
  for (const line of board.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const u = line[i];
      const v = line[i + 1];
      const [x1, y1] = board.nodes[u];
      const [x2, y2] = board.nodes[v];
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5A4630" stroke-width="3" stroke-linecap="round"/>`;
    }
  }

  // 2. Draw Points & Pieces
  for (const [id, [x, y]] of Object.entries(board.nodes)) {
    const piece = pieces[id];
    const isSelected = selectedNode === id;
    const isLegal = legalSet.has(id);
    const isHint = hintSet.has(id);

    const radius = piece ? 12 : 8;
    const fill = piece === 'T' ? '#C2410C' : (piece === 'G' ? '#F5F0E6' : '#B9A98A');
    const stroke = isSelected ? '#16A34A' : '#5A4630';
    const strokeWidth = isSelected ? 5 : 2.5;

    const pieceLabel = piece === 'T' ? 'Tiger' : (piece === 'G' ? 'Goat' : 'empty');
    const statusLabel = isSelected ? ', selected' : (isLegal ? ', legal target' : '');
    const nodeAria = `Point ${id}, ${pieceLabel}${statusLabel}`;

    svg += `<g class="board-node" data-node-id="${id}" tabindex="0" role="button" aria-label="${nodeAria}" style="cursor: pointer;">`;

    // Large invisible hit area (radius 22) for effortless touch/click registration
    svg += `<circle cx="${x}" cy="${y}" r="22" fill="transparent" stroke="none" style="pointer-events:all;"/>`;

    // Base point or piece
    svg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" pointer-events="none"/>`;

    // Piece Text Label
    if (piece === 'T') {
      svg += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#FFFFFF" pointer-events="none">T</text>`;
    } else if (piece === 'G') {
      svg += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#5A4630" pointer-events="none">G</text>`;
    }

    // Legal move ring: dashed #16A34A, radius 13, width 3
    if (isLegal) {
      svg += `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#16A34A" stroke-width="3" stroke-dasharray="4 3" pointer-events="none"/>`;
    }

    // Hint ring: warning amber highlight
    if (isHint) {
      svg += `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#D97706" stroke-width="3" stroke-dasharray="2 2" pointer-events="none"/>`;
    }

    svg += `</g>`;
  }

  svg += `</svg>`;
  return svg;
}

export function attachBoardInteraction(container, board, onPointSelected) {
  const handleTap = (clientX, clientY, targetEl) => {
    // 1. Direct hit on data-node-id element
    if (targetEl) {
      const nodeEl = targetEl.closest('[data-node-id]');
      if (nodeEl && nodeEl.dataset.nodeId) {
        onPointSelected(nodeEl.dataset.nodeId);
        return;
      }
    }

    // 2. Proportional bounding-rect hit
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const [w, h] = board.viewBox;
      const svgX = ((clientX - rect.left) / rect.width) * w;
      const svgY = ((clientY - rect.top) / rect.height) * h;
      const nearestId = getNearestPoint(board, svgX, svgY, 28);
      if (nearestId) {
        onPointSelected(nearestId);
        return;
      }
    }

    // 3. SVG CTM fallback
    const { x, y } = clientToSvgCoords(svgEl, clientX, clientY);
    const nearestId = getNearestPoint(board, x, y, 28);
    if (nearestId) {
      onPointSelected(nearestId);
    }
  };

  const onClick = (e) => {
    handleTap(e.clientX, e.clientY, e.target);
  };

  const onTouchEnd = (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      handleTap(touch.clientX, touch.clientY, document.elementFromPoint(touch.clientX, touch.clientY));
      e.preventDefault();
    }
  };

  const onKeyDown = (e) => {
    const activeEl = document.activeElement;
    const nodeEl = activeEl && activeEl.closest ? activeEl.closest('[data-node-id]') : null;
    if (!nodeEl || !nodeEl.dataset.nodeId) return;

    const currentId = nodeEl.dataset.nodeId;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPointSelected(currentId);
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const currentPos = board.nodes[currentId];
      if (!currentPos) return;
      const [cx, cy] = currentPos;

      let bestNeighbour = null;
      let minDistance = Infinity;

      for (const [nid, [nx, ny]] of Object.entries(board.nodes)) {
        if (nid === currentId) continue;
        const dx = nx - cx;
        const dy = ny - cy;

        let inDirection = false;
        if (e.key === 'ArrowRight' && dx > 8 && Math.abs(dx) >= Math.abs(dy) * 0.4) inDirection = true;
        if (e.key === 'ArrowLeft' && dx < -8 && Math.abs(dx) >= Math.abs(dy) * 0.4) inDirection = true;
        if (e.key === 'ArrowDown' && dy > 8 && Math.abs(dy) >= Math.abs(dx) * 0.4) inDirection = true;
        if (e.key === 'ArrowUp' && dy < -8 && Math.abs(dy) >= Math.abs(dx) * 0.4) inDirection = true;

        if (inDirection) {
          const dist = dx * dx + dy * dy;
          if (dist < minDistance) {
            minDistance = dist;
            bestNeighbour = nid;
          }
        }
      }

      if (bestNeighbour) {
        const nextEl = container.querySelector(`[data-node-id="${bestNeighbour}"]`);
        if (nextEl) nextEl.focus();
      }
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('touchend', onTouchEnd, { passive: false });
  container.addEventListener('keydown', onKeyDown);

  return () => {
    container.removeEventListener('click', onClick);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('keydown', onKeyDown);
  };
}
