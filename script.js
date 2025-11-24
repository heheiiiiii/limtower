// ================================
// 기본 설정
// ================================
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const currentScoreEl = document.getElementById("current-score");
const bestScoreEl = document.getElementById("best-score");

const overlay = document.getElementById("overlay");
const btnRestart = document.getElementById("btn-restart");
const btnHome = document.getElementById("btn-home");
const btnShare = document.getElementById("btn-share");

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// 블록 이미지들 (여기 파일명만 실제 가지고 있는 걸로 맞추면 됨)
const blockImageSources = [
  "images/jihun1.png",
  "images/jihun2.png",
  "images/jihun3.png"
  // 필요하면 계속 추가
];

const blockImages = [];

// 게임 상태
let blocks = [];        // 쌓인 블록들 (아래 판 포함)
let currentBlock = null;
let isRunning = false;
let isGameOver = false;
let lastTime = 0;

let score = 0;
let bestScore = 0;

// 속도/중력
const BASE_SPEED = 120;         // 좌우 이동 기본 속도 (px/s)
const SPEED_INCREASE = 8;       // 층이 올라갈 때마다 속도 증가
const GRAVITY = 1200;           // 중력 가속도 (px/s^2)
const BLOCK_WIDTH = 80;
const BLOCK_HEIGHT = 80;

// ================================
// 로컬 스토리지에서 최고 기록 불러오기
// ================================
function loadBestScore() {
  const saved = localStorage.getItem("imtower_best_score");
  if (saved !== null) {
    bestScore = parseInt(saved, 10) || 0;
  } else {
    bestScore = 0;
  }
  bestScoreEl.textContent = bestScore;
}

// ================================
// 최고 기록 저장
// ================================
function saveBestScore() {
  localStorage.setItem("imtower_best_score", String(bestScore));
}

// ================================
// 이미지 로드
// ================================
function preloadImages(sources, callback) {
  let loaded = 0;
  if (sources.length === 0) {
    callback();
    return;
  }

  sources.forEach((src, index) => {
    const img = new Image();
    img.onload = () => {
      loaded++;
      if (loaded === sources.length) {
        callback();
      }
    };
    img.onerror = () => {
      console.warn("이미지 로드 실패:", src);
      loaded++;
      if (loaded === sources.length) {
        callback();
      }
    };
    img.src = src;
    blockImages[index] = img;
  });
}

// ================================
// 유틸 함수
// ================================
function randomBlockImage() {
  if (blockImages.length === 0) return null;
  const idx = Math.floor(Math.random() * blockImages.length);
  return blockImages[idx];
}

// ================================
// 게임 초기화
// ================================
function resetGame() {
  score = 0;
  currentScoreEl.textContent = score;
  isGameOver = false;

  // 블록 배열 초기화
  blocks = [];

  // 아래 판(바닥) 생성 - 블록처럼 취급
  const baseWidth = 160;
  const baseHeight = 20;
  const baseY = CANVAS_HEIGHT - 50;

  blocks.push({
    x: (CANVAS_WIDTH - baseWidth) / 2,
    y: baseY,
    width: baseWidth,
    height: baseHeight,
    img: null // 바닥은 이미지 없음
  });

  // 첫 블록 생성
  createNewMovingBlock();

  // 오버레이 숨기기
  hideOverlay();

  if (!isRunning) {
    isRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

// ================================
// 새로 움직이는 블록 생성
// ================================
function createNewMovingBlock() {
  const last = blocks[blocks.length - 1];

  const width = BLOCK_WIDTH;
  const height = BLOCK_HEIGHT;

  const x = (CANVAS_WIDTH - width) / 2;
  const y = last.y - height - 5;

  const speed = BASE_SPEED + score * SPEED_INCREASE;

  currentBlock = {
    x,
    y,
    width,
    height,
    vx: speed,   // 좌우 속도
    vy: 0,       // 낙하 속도
    isFalling: false,
    direction: 1,
    img: randomBlockImage()
  };
}

// ================================
// 점수 업데이트
// ================================
function updateScore() {
  currentScoreEl.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    bestScoreEl.textContent = bestScore;
    saveBestScore();
  }
}

// ================================
// 게임 오버 처리
// ================================
function gameOver() {
  isGameOver = true;
  isRunning = false;

  showOverlay();
}

// ================================
// 오버레이 표시/숨김
// ================================
function showOverlay() {
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

// ================================
// 그리기 함수들
// ================================
function drawBackground() {
  // 이미 CSS 그라디언트가 있으므로 여기서는 바닥 선 정도만 그려도 됨
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawBlocks() {
  // 쌓인 블록들
  blocks.forEach((block, index) => {
    if (index === 0) {
      // 아래 판 (단순 사각형)
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 2;
      ctx.fillRect(block.x, block.y, block.width, block.height);
      ctx.strokeRect(block.x, block.y, block.width, block.height);
    } else {
      if (block.img) {
        ctx.drawImage(block.img, block.x, block.y, block.width, block.height);
      } else {
        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(block.x, block.y, block.width, block.height);
      }
    }
  });

  // 현재 움직이는 블록
  if (currentBlock) {
    if (currentBlock.img) {
      ctx.drawImage(
        currentBlock.img,
        currentBlock.x,
        currentBlock.y,
        currentBlock.width,
        currentBlock.height
      );
    } else {
      ctx.fillStyle = "#ff8888";
      ctx.fillRect(
        currentBlock.x,
        currentBlock.y,
        currentBlock.width,
        currentBlock.height
      );
    }
  }
}

// ================================
// 게임 업데이트
// ================================
function update(delta) {
  if (!currentBlock || isGameOver) return;

  const last = blocks[blocks.length - 1];

  if (!currentBlock.isFalling) {
    // 좌우 이동
    currentBlock.x += currentBlock.vx * currentBlock.direction * delta;

    // 화면 양 끝에서 반사
    if (currentBlock.x <= 10) {
      currentBlock.x = 10;
      currentBlock.direction *= -1;
    }
    if (currentBlock.x + currentBlock.width >= CANVAS_WIDTH - 10) {
      currentBlock.x = CANVAS_WIDTH - 10 - currentBlock.width;
      currentBlock.direction *= -1;
    }
  } else {
    // 낙하
    currentBlock.vy += GRAVITY * delta;
    currentBlock.y += currentBlock.vy * delta;

    // 현재 블록의 아래 y
    const bottomY = currentBlock.y + currentBlock.height;

    // 마지막 블록과의 충돌 체크
    const targetTopY = last.y;
    const currentLeft = currentBlock.x;
    const currentRight = currentBlock.x + currentBlock.width;
    const targetLeft = last.x;
    const targetRight = last.x + last.width;

    if (bottomY >= targetTopY) {
      // 수평 겹침 계산
      const overlap = Math.min(currentRight, targetRight) - Math.max(currentLeft, targetLeft);

      if (overlap <= 10) {
        // 거의 안 겹침 → 그대로 떨어지게 두고, 화면 아래로 나가면 게임 오버
      } else {
        // 제대로 쌓였다고 판정
        currentBlock.y = targetTopY - currentBlock.height;
        blocks.push(currentBlock);
        score++;
        updateScore();
        createNewMovingBlock();
        return;
      }
    }

    // 화면 아래로 완전히 떨어지면 게임 오버
    if (currentBlock.y > CANVAS_HEIGHT) {
      gameOver();
    }
  }
}

// ================================
// 메인 게임 루프
// ================================
function gameLoop(timestamp) {
  if (!isRunning) return;

  const delta = (timestamp - lastTime) / 1000; // 초 단위
  lastTime = timestamp;

  drawBackground();
  update(delta);
  drawBlocks();

  requestAnimationFrame(gameLoop);
}

// ================================
// 입력 처리 (클릭 / 스페이스바)
// ================================
function handleDrop() {
  if (!isRunning || isGameOver) return;
  if (!currentBlock) return;
  if (currentBlock.isFalling) return;

  currentBlock.isFalling = true;
  currentBlock.vy = 0;
}

canvas.addEventListener("click", handleDrop);

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleDrop();
  }
});

// ================================
// 버튼 이벤트
// ================================
btnRestart.addEventListener("click", () => {
  resetGame();
});

btnHome.addEventListener("click", () => {
  // 현재 게임과 동일하게 "처음 상태"로 리셋
  resetGame();
});

btnShare.addEventListener("click", async () => {
  const shareText = `내 임타워 기록은 ${score}층! 당신도 도전해 보세요.`;
  const shareUrl = window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "임타워 - 임지훈을 쌓아라",
        text: shareText,
        url: shareUrl
      });
    } catch (err) {
      console.log("공유 취소 또는 오류:", err);
    }
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("페이지 주소가 클립보드에 복사되었습니다.");
    } catch (err) {
      alert("자동 복사에 실패했습니다. 주소창의 링크를 직접 복사해 주세요.");
    }
  } else {
    alert("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
  }
});

// ================================
// 시작
// ================================
loadBestScore();

preloadImages(blockImageSources, () => {
  resetGame();
});
