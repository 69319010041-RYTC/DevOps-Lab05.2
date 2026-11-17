(() => {
  "use strict";

  const COLUMNS = 4;
  const ROWS = 5;
  const TOTAL_PIECES = COLUMNS * ROWS;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const playfield = document.querySelector("#playfield");
  const board = document.querySelector("#board");
  const trayGrid = document.querySelector("#tray-grid");
  const pieceLayer = document.querySelector("#piece-layer");
  const restartButton = document.querySelector("#restart-button");
  const musicButton = document.querySelector("#music-button");
  const musicStatus = document.querySelector("#music-status");
  const backgroundMusic = document.querySelector("#background-music");
  const message = document.querySelector("#game-message");
  const pieceCount = document.querySelector("#piece-count");
  const sourceImage = new Image();

  let audioContext;
  let musicEnabled = true;
  let pieces = [];
  let boardWidth = 0;
  let boardHeight = 0;
  let cellWidth = 0;
  let cellHeight = 0;
  let tabSize = 0;
  let areaWidth = 0;
  let areaHeight = 0;
  let placedCount = 0;

  sourceImage.addEventListener("load", startGame, { once: true });
  sourceImage.addEventListener("error", () => {
    message.textContent = "โหลดภาพ car.jpg ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เดียวกับเกม";
    restartButton.disabled = true;
  }, { once: true });
  restartButton.addEventListener("click", startGame);
  musicButton.addEventListener("click", toggleMusic);
  backgroundMusic.addEventListener("ended", () => {
    if (!musicEnabled) return;
    backgroundMusic.currentTime = 0;
    playBackgroundMusic();
  });
  backgroundMusic.addEventListener("error", () => {
    musicButton.title = "โหลดไฟล์ game-music.mp3 ไม่สำเร็จ";
    musicStatus.textContent = "โหลดเพลงไม่สำเร็จ";
  });
  window.addEventListener("resize", resizeGame);
  sourceImage.src = "car.jpg";
  updateMusicButton();
  playBackgroundMusic();

  function startGame() {
    if (!sourceImage.naturalWidth || !sourceImage.naturalHeight) return;

    areaWidth = 0;
    areaHeight = 0;
    placedCount = 0;
    pieceCount.textContent = "0";
    message.textContent = "ลากชิ้นส่วนไปวางบนกระดาน";
    restartButton.disabled = false;
    pieceLayer.replaceChildren();
    playBackgroundMusic();

    const horizontalEdges = Array.from({ length: ROWS + 1 }, () =>
      Array.from({ length: COLUMNS }, () => randomEdge()));
    const verticalEdges = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLUMNS + 1 }, () => randomEdge()));

    pieces = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const piece = {
          row,
          column,
          placed: false,
          trayIndex: row * COLUMNS + column,
          x: 0,
          y: 0,
          element: createPieceElement(
            row,
            column,
            row === 0 ? 0 : -horizontalEdges[row][column],
            column === COLUMNS - 1 ? 0 : verticalEdges[row][column + 1],
            row === ROWS - 1 ? 0 : horizontalEdges[row + 1][column],
            column === 0 ? 0 : -verticalEdges[row][column],
          ),
        };
        pieces.push(piece);
        pieceLayer.append(piece.element);
        attachDragging(piece);
      }
    }

    shuffle(pieces);
    pieces.forEach((piece, index) => {
      piece.trayIndex = index;
    });
    resizeGame();
  }

  function randomEdge() {
    return Math.random() < 0.5 ? -1 : 1;
  }

  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }

  function createPieceElement(row, column, top, right, bottom, left) {
    const svg = document.createElementNS(SVG_NS, "svg");
    const clipId = `piece-clip-${row}-${column}`;
    svg.classList.add("puzzle-piece");
    svg.setAttribute("viewBox", "0 0 1 1");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `ชิ้นส่วนแถวที่ ${row + 1} คอลัมน์ที่ ${column + 1}`);
    svg.setAttribute("draggable", "false");

    const defs = document.createElementNS(SVG_NS, "defs");
    const clip = document.createElementNS(SVG_NS, "clipPath");
    clip.id = clipId;
    const clipPath = document.createElementNS(SVG_NS, "path");
    clip.append(clipPath);
    defs.append(clip);
    svg.append(defs);

    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("href", "car.jpg");
    const clippedImage = document.createElementNS(SVG_NS, "g");
    clippedImage.setAttribute("clip-path", `url(#${clipId})`);
    clippedImage.append(image);
    svg.append(clippedImage);

    const outline = document.createElementNS(SVG_NS, "path");
    outline.classList.add("piece-outline");
    svg.append(outline);

    svg._puzzleData = { row, column, top, right, bottom, left, clipPath, outline, image };
    return svg;
  }

  function edgeCommands(x1, y1, x2, y2, normalX, normalY, tab, direction) {
    const edge = direction;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const tangentX = dx / length;
    const tangentY = dy / length;
    const depth = tab * edge;

    const point = (position, offset = 0) => {
      const x = x1 + tangentX * length * position + normalX * offset;
      const y = y1 + tangentY * length * position + normalY * offset;
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    };

    if (edge === 0) return `L ${point(1)}`;

    return [
      `L ${point(0.34)}`,
      `C ${point(0.35, depth * 0.18)} ${point(0.36, depth)} ${point(0.41, depth)}`,
      `C ${point(0.45, depth * 1.28)} ${point(0.55, depth * 1.28)} ${point(0.59, depth)}`,
      `C ${point(0.64, depth)} ${point(0.65, depth * 0.18)} ${point(0.66)}`,
      `L ${point(1)}`,
    ].join(" ");
  }

  function attachDragging(piece) {
    const element = piece.element;
    let pointerOffsetX = 0;
    let pointerOffsetY = 0;

    element.addEventListener("pointerdown", (event) => {
      if (piece.placed || event.button !== 0) return;
      event.preventDefault();
      playSoundEffect("press");
      playBackgroundMusic();
      const bounds = element.getBoundingClientRect();
      pointerOffsetX = event.clientX - bounds.left;
      pointerOffsetY = event.clientY - bounds.top;
      element.classList.add("is-dragging");
      element.style.zIndex = "10";
      element.setPointerCapture(event.pointerId);
    });

    element.addEventListener("pointermove", (event) => {
      if (!element.hasPointerCapture(event.pointerId) || piece.placed) return;
      const area = playfield.getBoundingClientRect();
      piece.x = event.clientX - area.left - pointerOffsetX;
      piece.y = event.clientY - area.top - pointerOffsetY;
      renderPiece(piece);
    });

    const finishDrag = (event) => {
      if (!element.hasPointerCapture(event.pointerId)) return;
      element.classList.remove("is-dragging");
      element.releasePointerCapture(event.pointerId);
      element.style.zIndex = "";
      snapIfClose(piece);
    };

    element.addEventListener("pointerup", finishDrag);
    element.addEventListener("pointercancel", finishDrag);
  }

  function snapIfClose(piece) {
    const boardBounds = board.getBoundingClientRect();
    const area = playfield.getBoundingClientRect();
    const scale = Number(piece.element.dataset.scale || 1);
    const pieceCenterX = piece.x + (cellWidth + tabSize * 2) * scale / 2;
    const pieceCenterY = piece.y + (cellHeight + tabSize * 2) * scale / 2;
    const targetCenterX = boardBounds.left - area.left + (piece.column + 0.5) * cellWidth;
    const targetCenterY = boardBounds.top - area.top + (piece.row + 0.5) * cellHeight;
    const tolerance = Math.min(cellWidth, cellHeight) * 0.42;
    if (Math.abs(pieceCenterX - targetCenterX) > tolerance || Math.abs(pieceCenterY - targetCenterY) > tolerance) {
      return;
    }

    piece.placed = true;
    playSoundEffect("place");
    piece.element.dataset.scale = "1";
    Object.assign(piece, targetPosition(piece));
    piece.element.classList.add("is-placed");
    piece.element.setAttribute("aria-label", `ชิ้นส่วนแถวที่ ${piece.row + 1} คอลัมน์ที่ ${piece.column + 1} จัดเข้าที่แล้ว`);
    placedCount += 1;
    pieceCount.textContent = String(placedCount);
    message.textContent = placedCount === TOTAL_PIECES
      ? "ยอดเยี่ยม! ต่อภาพครบแล้ว"
      : "เยี่ยมเลย! ลากชิ้นส่วนถัดไป";
    renderPiece(piece);
  }

  function targetPosition(piece) {
    const area = playfield.getBoundingClientRect();
    const boardBounds = board.getBoundingClientRect();
    return {
      x: boardBounds.left - area.left + piece.column * cellWidth - tabSize,
      y: boardBounds.top - area.top + piece.row * cellHeight - tabSize,
    };
  }

  function resizeGame() {
    if (!pieces.length) return;

    const previousWidth = areaWidth;
    const previousHeight = areaHeight;
    const area = playfield.getBoundingClientRect();
    const boardBounds = board.getBoundingClientRect();
    const trayBounds = trayGrid.getBoundingClientRect();
    areaWidth = area.width;
    areaHeight = area.height;
    boardWidth = boardBounds.width;
    boardHeight = boardBounds.height;
    cellWidth = boardWidth / COLUMNS;
    cellHeight = boardHeight / ROWS;
    tabSize = Math.min(cellWidth, cellHeight) * 0.2;

    const slotWidth = trayBounds.width / COLUMNS;
    const slotHeight = trayBounds.height / ROWS;
    const pieceWidth = cellWidth + tabSize * 2;
    const pieceHeight = cellHeight + tabSize * 2;
    const trayScale = Math.min((slotWidth - 8) / pieceWidth, (slotHeight - 8) / pieceHeight);

    pieces.forEach((piece) => {
      if (previousWidth && previousHeight && !piece.placed) {
        piece.x *= areaWidth / previousWidth;
        piece.y *= areaHeight / previousHeight;
      }
      updatePieceShape(piece);
      if (piece.placed) {
        Object.assign(piece, targetPosition(piece));
      } else if (!previousWidth || !previousHeight) {
        const slotX = (piece.trayIndex % COLUMNS) * slotWidth;
        const slotY = Math.floor(piece.trayIndex / COLUMNS) * slotHeight;
        piece.x = trayBounds.left - area.left + slotX + (slotWidth - pieceWidth * trayScale) / 2;
        piece.y = trayBounds.top - area.top + slotY + (slotHeight - pieceHeight * trayScale) / 2;
      }
      piece.element.dataset.scale = piece.placed ? "1" : String(trayScale);
      renderPiece(piece);
    });
  }

  function updatePieceShape(piece) {
    const { row, column, top, right, bottom, left, clipPath, outline, image } = piece.element._puzzleData;
    image.setAttribute("x", String(-column * cellWidth));
    image.setAttribute("y", String(-row * cellHeight));
    image.setAttribute("width", String(boardWidth));
    image.setAttribute("height", String(boardHeight));
    piece.element.setAttribute("viewBox", `0 0 ${cellWidth + tabSize * 2} ${cellHeight + tabSize * 2}`);
    piece.element._puzzleData.clipPath.setAttribute("transform", `translate(${tabSize} ${tabSize})`);
    outline.setAttribute("transform", `translate(${tabSize} ${tabSize})`);
    image.setAttribute("transform", `translate(${tabSize} ${tabSize})`);

    const shape = buildPieceShape(cellWidth, cellHeight, tabSize, top, right, bottom, left);
    clipPath.setAttribute("d", shape);
    outline.setAttribute("d", shape);
  }

  function buildPieceShape(width, height, tab, top, right, bottom, left) {
    return [
      "M 0 0",
      edgeCommands(0, 0, width, 0, 0, -1, tab, top),
      edgeCommands(width, 0, width, height, 1, 0, tab, right),
      edgeCommands(width, height, 0, height, 0, 1, tab, bottom),
      edgeCommands(0, height, 0, 0, -1, 0, tab, left),
      "Z",
    ].join(" ");
  }

  function renderPiece(piece) {
    const scale = Number(piece.element.dataset.scale || 1);
    const width = (cellWidth + tabSize * 2) * scale;
    const height = (cellHeight + tabSize * 2) * scale;
    piece.element.style.left = `${piece.x}px`;
    piece.element.style.top = `${piece.y}px`;
    piece.element.style.width = `${width}px`;
    piece.element.style.height = `${height}px`;
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    updateMusicButton();
    if (musicEnabled) {
      playBackgroundMusic();
    } else {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      musicStatus.textContent = "ปิดเพลงแล้ว";
    }
  }

  function updateMusicButton() {
    musicButton.textContent = musicEnabled ? "♫ ปิดเพลง" : "♫ เปิดเพลง";
    musicButton.setAttribute("aria-pressed", String(musicEnabled));
    musicButton.setAttribute("aria-label", musicEnabled ? "ปิดเพลงประกอบ" : "เปิดเพลงประกอบ");
  }

  function playBackgroundMusic() {
    if (!musicEnabled || !backgroundMusic.paused) return;

    backgroundMusic.play().then(() => {
      musicStatus.textContent = "กำลังเล่นเพลง";
    }).catch((error) => {
      if (error.name === "NotAllowedError") {
        musicStatus.textContent = "กดชิ้นส่วนหรือปุ่มเพื่อเริ่มเพลง";
      } else if (error.name !== "AbortError") {
        musicButton.title = "เล่นเพลงไม่ได้ กรุณาตรวจสอบไฟล์ game-music.mp3";
        musicStatus.textContent = "เล่นเพลงไม่ได้ กรุณาตรวจสอบไฟล์เสียง";
        console.error("Background music playback failed.", error);
      }
    });
  }

  function playSoundEffect(type) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const startTime = audioContext.currentTime;
    const frequencies = type === "place" ? [523.25, 783.99] : [660];
    frequencies.forEach((frequency, index) => {
      const start = startTime + index * 0.075;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(type === "place" ? 0.12 : 0.06, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.12);
    });
  }
})();
