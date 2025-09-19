const COLOR_INFO = {
  R: { name: "火", label: "火", className: "gem--red" },
  B: { name: "水", label: "水", className: "gem--blue" },
  G: { name: "木", label: "木", className: "gem--green" },
  L: { name: "光", label: "光", className: "gem--light" },
  D: { name: "闇", label: "闇", className: "gem--dark" },
  H: { name: "回復", label: "回", className: "gem--heart" },
};

const COLORS = Object.keys(COLOR_INFO);

const boardElement = document.getElementById("board");
const resolutionLog = document.getElementById("resolution-log");
const resetButton = document.getElementById("reset-button");
const sizeSelect = document.getElementById("board-size");

const statsElements = {
  turns: document.getElementById("stat-turns"),
  combos: document.getElementById("stat-combos"),
  orbs: document.getElementById("stat-orbs"),
  score: document.getElementById("stat-score"),
};

const stats = {
  turns: 0,
  combos: 0,
  orbs: 0,
  score: 0,
};

let ROWS = 5;
let COLS = 6;
let board = [];
let cellElements = [];
let resolving = false;

const dragState = {
  active: false,
  pointerId: null,
  startRow: null,
  startCol: null,
  lastRow: null,
  lastCol: null,
  moved: false,
  activeCell: null,
};

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function generateBoard(rows, cols) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let candidates = [...COLORS];
      if (c >= 2 && grid[r][c - 1] === grid[r][c - 2]) {
        candidates = candidates.filter((color) => color !== grid[r][c - 1]);
      }
      if (r >= 2 && grid[r - 1][c] === grid[r - 2][c]) {
        candidates = candidates.filter((color) => color !== grid[r - 1][c]);
      }
      grid[r][c] = randomChoice(candidates);
    }
  }
  return grid;
}

function buildBoardElements() {
  boardElement.innerHTML = "";
  boardElement.style.setProperty("--cols", COLS);
  boardElement.setAttribute("aria-rowcount", String(ROWS));
  boardElement.setAttribute("aria-colcount", String(COLS));
  cellElements = [];
  for (let r = 0; r < ROWS; r += 1) {
    const rowCells = [];
    for (let c = 0; c < COLS; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `行${r + 1} 列${c + 1}`);
      const gem = document.createElement("div");
      gem.className = "gem";
      cell.appendChild(gem);
      boardElement.appendChild(cell);
      rowCells.push(cell);
    }
    cellElements.push(rowCells);
  }
}

function setCellColor(row, col, color) {
  const cell = cellElements[row][col];
  const gem = cell.firstElementChild;
  cell.dataset.color = color ?? "";
  cell.classList.toggle("empty", !color);
  gem.className = "gem";
  gem.textContent = "";
  if (color) {
    const info = COLOR_INFO[color];
    gem.classList.add(info.className);
    gem.textContent = info.label;
  }
}

function refreshBoard() {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      cellElements[r][c].classList.remove("matched");
      setCellColor(r, c, board[r][c]);
    }
  }
}

function resetStats() {
  stats.turns = 0;
  stats.combos = 0;
  stats.orbs = 0;
  stats.score = 0;
  updateStatsDisplay();
}

function updateStatsDisplay() {
  statsElements.turns.textContent = String(stats.turns);
  statsElements.combos.textContent = String(stats.combos);
  statsElements.orbs.textContent = String(stats.orbs);
  statsElements.score.textContent = String(stats.score);
}

function showIntroMessage() {
  resolutionLog.textContent = "ドラッグで好きなドロップを動かして3つ以上揃えてください。";
}

function updateResolutionMessage(result) {
  if (!result || result.orbsCleared === 0) {
    resolutionLog.textContent = "コンボは発生しませんでした……次の手に期待！";
    return;
  }
  const lines = [];
  const comboWord = result.combos.length === 1 ? "コンボ" : "コンボ";
  lines.push(`${result.combos.length}${comboWord}！ 連鎖数: ${result.cascades}`);
  result.combos.forEach((combo, index) => {
    const info = COLOR_INFO[combo.color];
    lines.push(`${index + 1}. ${info.name} ${combo.size}個`);
  });
  lines.push(`消したドロップ: ${result.orbsCleared}`);
  lines.push(`獲得スコア: ${result.score}`);
  resolutionLog.textContent = lines.join("\n");
}

function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function swapCells(r1, c1, r2, c2) {
  const tmp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = tmp;
  setCellColor(r1, c1, board[r1][c1]);
  setCellColor(r2, c2, board[r2][c2]);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findMatches() {
  const matches = new Set();
  for (let r = 0; r < ROWS; r += 1) {
    let streakColor = null;
    let streakStart = 0;
    let streakLength = 0;
    for (let c = 0; c < COLS; c += 1) {
      const color = board[r][c];
      if (color && color === streakColor) {
        streakLength += 1;
      } else {
        if (streakColor && streakLength >= 3) {
          for (let cc = streakStart; cc < streakStart + streakLength; cc += 1) {
            matches.add(`${r},${cc}`);
          }
        }
        streakColor = color;
        streakStart = c;
        streakLength = color ? 1 : 0;
      }
    }
    if (streakColor && streakLength >= 3) {
      for (let cc = streakStart; cc < streakStart + streakLength; cc += 1) {
        matches.add(`${r},${cc}`);
      }
    }
  }

  for (let c = 0; c < COLS; c += 1) {
    let streakColor = null;
    let streakStart = 0;
    let streakLength = 0;
    for (let r = 0; r < ROWS; r += 1) {
      const color = board[r][c];
      if (color && color === streakColor) {
        streakLength += 1;
      } else {
        if (streakColor && streakLength >= 3) {
          for (let rr = streakStart; rr < streakStart + streakLength; rr += 1) {
            matches.add(`${rr},${c}`);
          }
        }
        streakColor = color;
        streakStart = r;
        streakLength = color ? 1 : 0;
      }
    }
    if (streakColor && streakLength >= 3) {
      for (let rr = streakStart; rr < streakStart + streakLength; rr += 1) {
        matches.add(`${rr},${c}`);
      }
    }
  }

  return Array.from(matches).map((item) => item.split(",").map((value) => Number(value)));
}

function groupMatches(positions) {
  const visited = new Set();
  const matchSet = new Set(positions.map(([r, c]) => `${r},${c}`));
  const combos = [];

  positions.forEach(([r, c]) => {
    const key = `${r},${c}`;
    if (visited.has(key)) {
      return;
    }
    const color = board[r][c];
    if (!color) {
      return;
    }
    const stack = [[r, c]];
    let size = 0;
    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      const currentKey = `${cr},${cc}`;
      if (!matchSet.has(currentKey) || visited.has(currentKey)) {
        continue;
      }
      visited.add(currentKey);
      size += 1;
      const neighbors = [
        [cr - 1, cc],
        [cr + 1, cc],
        [cr, cc - 1],
        [cr, cc + 1],
      ];
      neighbors.forEach(([nr, nc]) => {
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const neighborKey = `${nr},${nc}`;
          if (matchSet.has(neighborKey) && board[nr][nc] === color && !visited.has(neighborKey)) {
            stack.push([nr, nc]);
          }
        }
      });
    }
    combos.push({ color, size });
  });

  return combos;
}

function highlightMatches(positions) {
  positions.forEach(([r, c]) => {
    cellElements[r][c].classList.add("matched");
  });
}

function clearMatches(positions) {
  positions.forEach(([r, c]) => {
    const cell = cellElements[r][c];
    board[r][c] = null;
    cell.classList.remove("matched");
    setCellColor(r, c, null);
  });
}

function collapseColumns() {
  for (let c = 0; c < COLS; c += 1) {
    const column = [];
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      const color = board[r][c];
      if (color) {
        column.push(color);
      }
    }
    while (column.length < ROWS) {
      column.push(randomChoice(COLORS));
    }
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      const idx = ROWS - 1 - r;
      board[r][c] = column[idx];
    }
  }
}

function calculateScore(result) {
  const comboBonus = result.combos.reduce((sum, combo) => sum + combo.size, 0);
  const cascadeBonus = Math.max(0, result.cascades - 1) * 5;
  const comboCountBonus = Math.max(0, result.combos.length - 1) * 3;
  return comboBonus + cascadeBonus + comboCountBonus;
}

async function resolveBoardAfterMove() {
  const combos = [];
  let cascades = 0;
  let cleared = 0;

  while (true) {
    const matches = findMatches();
    if (matches.length === 0) {
      break;
    }
    cascades += 1;
    cleared += matches.length;
    highlightMatches(matches);
    await wait(220);
    combos.push(...groupMatches(matches));
    clearMatches(matches);
    await wait(120);
    collapseColumns();
    refreshBoard();
    await wait(200);
  }

  const result = {
    combos,
    cascades,
    orbsCleared: cleared,
  };
  result.score = calculateScore(result);

  stats.turns += 1;
  if (cleared > 0) {
    stats.combos += combos.length;
    stats.orbs += cleared;
    stats.score += result.score;
  }
  updateStatsDisplay();
  updateResolutionMessage(result);
  return result;
}

function setActiveCell(row, col) {
  if (dragState.activeCell && dragState.activeCell !== cellElements[row][col]) {
    dragState.activeCell.classList.remove("active");
  }
  const cell = cellElements[row][col];
  dragState.activeCell = cell;
  cell.classList.add("active");
}

function clearActiveCell() {
  if (dragState.activeCell) {
    dragState.activeCell.classList.remove("active");
    dragState.activeCell = null;
  }
}

function clearDragState() {
  clearActiveCell();
  dragState.active = false;
  dragState.pointerId = null;
  dragState.startRow = null;
  dragState.startCol = null;
  dragState.lastRow = null;
  dragState.lastCol = null;
  dragState.moved = false;
}

function pointerMoveHandler(event) {
  if (!dragState.active || event.pointerId !== dragState.pointerId) {
    return;
  }
  event.preventDefault();
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) {
    return;
  }
  const cell = element.closest(".cell");
  if (!cell || !boardElement.contains(cell)) {
    return;
  }
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (row === dragState.lastRow && col === dragState.lastCol) {
    return;
  }
  if (!isAdjacent(row, col, dragState.lastRow, dragState.lastCol)) {
    return;
  }
  swapCells(dragState.lastRow, dragState.lastCol, row, col);
  dragState.lastRow = row;
  dragState.lastCol = col;
  dragState.moved = true;
  setActiveCell(row, col);
}

async function pointerUpHandler(event) {
  if (!dragState.active || event.pointerId !== dragState.pointerId) {
    return;
  }
  event.preventDefault();
  window.removeEventListener("pointermove", pointerMoveHandler);
  window.removeEventListener("pointerup", pointerUpHandler);
  window.removeEventListener("pointercancel", pointerUpHandler);

  const moved = dragState.moved;
  clearDragState();
  if (!moved || resolving) {
    return;
  }
  try {
    resolving = true;
    boardElement.classList.add("is-resolving");
    await resolveBoardAfterMove();
  } finally {
    resolving = false;
    boardElement.classList.remove("is-resolving");
  }
}

function pointerDownHandler(event) {
  if (resolving || (typeof event.button === "number" && event.button !== 0)) {
    return;
  }
  const cell = event.target.closest(".cell");
  if (!cell || !boardElement.contains(cell)) {
    return;
  }
  event.preventDefault();
  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.startRow = Number(cell.dataset.row);
  dragState.startCol = Number(cell.dataset.col);
  dragState.lastRow = dragState.startRow;
  dragState.lastCol = dragState.startCol;
  dragState.moved = false;
  setActiveCell(dragState.startRow, dragState.startCol);
  window.addEventListener("pointermove", pointerMoveHandler, { passive: false });
  window.addEventListener("pointerup", pointerUpHandler, { passive: false });
  window.addEventListener("pointercancel", pointerUpHandler, { passive: false });
}

function parseSize(value) {
  const [rowStr, colStr] = value.split("x");
  return [Number(rowStr), Number(colStr)];
}

function startNewGame(rows, cols) {
  clearDragState();
  ROWS = rows;
  COLS = cols;
  sizeSelect.value = `${rows}x${cols}`;
  board = generateBoard(rows, cols);
  buildBoardElements();
  refreshBoard();
  resetStats();
  showIntroMessage();
}

function init() {
  boardElement.addEventListener("pointerdown", pointerDownHandler);
  boardElement.addEventListener("contextmenu", (event) => event.preventDefault());
  boardElement.addEventListener("dragstart", (event) => event.preventDefault());
  resetButton.addEventListener("click", () => startNewGame(ROWS, COLS));
  sizeSelect.addEventListener("change", () => {
    const [rows, cols] = parseSize(sizeSelect.value);
    startNewGame(rows, cols);
  });

  startNewGame(ROWS, COLS);
}

init();
