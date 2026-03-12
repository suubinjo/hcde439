const BAUD_RATE = 9600;

let port, connectBtn;
let grid, progressText, statusText, subText;
let cards = [];

// Game State Variables
let round = 1;
let success = 0;
let sequence = [];
let inputIndex = 0;
let phase = "WAIT";
let locked = false;

// Timer Management
let timerIds = [];
let gameSession = 0;

// Symbol Groups
const symbols = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "A", "B", "C", "D", "*", "#"]; // all possible keypad inputs
const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]; // numeric keypad values
const specials = ["*", "#"]; // special keypad characters
const letters = ["A", "B", "C", "D"]; // letter keys


function setup() {
  noCanvas();
  setupSerial();

  grid = document.getElementById("grid");
  progressText = document.getElementById("progressText");
  statusText = document.getElementById("statusText");
  subText = document.getElementById("subText");

  createGrid();
  resetGame();
}

function draw() {
  const portIsOpen = checkPort();
  if (!portIsOpen) return;

  let str = port.readUntil("\n");
  if (str.length === 0) return;

  let msg = str.trim().toUpperCase();
  if (symbols.includes(msg)) {
    handleInput(msg);
  }
}

function keyPressed() {
  let k = key.toUpperCase();
  if (k === "R" || keyCode === 82) {
    resetGame();
    return false;
  }
  if (keyCode === 32 && phase === "WAIT" && !locked) {
    startRound();
    return false;
  }
  return false;
}

// ---------- SERIAL FUNCTIONS ----------
function setupSerial() {
  port = createSerial();
  let usedPorts = usedSerialPorts();
  if (usedPorts.length > 0) {
    port.open(usedPorts[0], BAUD_RATE);
  }

  connectBtn = createButton("Connect to Arduino");
  connectBtn.position(12, 12);
  connectBtn.mouseClicked(onConnectButtonClicked);
}

function checkPort() {
  if (!port.opened()) {
    connectBtn.html("Connect to Arduino");
    return false;
  } else {
    connectBtn.html("Disconnect");
    return true;
  }
}

function onConnectButtonClicked() {
  if (!port.opened()) {
    port.open(BAUD_RATE);
  } else {
    port.close();
  }
}

function sendLED(state) {
  if (port.opened()) {
    port.write(state + "\n");
  }
}

// ---------- UI FUNCTION ----------
function createGrid() {
  for (let i = 0; i < 8; i++) {
    let card = document.createElement("div");
    card.className = "card";

    let front = document.createElement("div");
    front.className = "face front";

    let back = document.createElement("div");
    back.className = "face back";

    card.appendChild(front);
    card.appendChild(back);
    grid.appendChild(card);
    cards.push(card);
  }
}

function setText(progress, title, subtitle) {
  progressText.textContent = progress;
  statusText.textContent = title;
  subText.textContent = subtitle;
}

function clearFaces() {
  for (let card of cards) {
    card.querySelector(".front").textContent = "";
  }
}

function clearStates() {
  for (let card of cards) {
    card.classList.remove("reveal", "flip", "correct", "wrong", "input-mode");
  }
}

function setInputMode(on) {
  for (let card of cards) {
    if (on) card.classList.add("input-mode");
    else card.classList.remove("input-mode");
  }
}

// ---------- TIMER HELPERS ----------
function addTimer(fn, ms) {
  const id = setTimeout(fn, ms);
  timerIds.push(id);
  return id;
}

function clearAllTimers() {
  for (let id of timerIds) {
    clearTimeout(id);
  }
  timerIds = [];
}

// ---------- GAME LOGIC ----------
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function makeSequence() {
  sequence = [];
  if (round === 1) {
    for (let i = 0; i < 8; i++) {
      sequence.push(random(numbers));
    }

  } else if (round === 2) {
    let specialCount = floor(random(1, 3));
    let numberCount = 8 - specialCount;

    for (let i = 0; i < numberCount; i++) {
      sequence.push(random(numbers));
    }

    for (let i = 0; i < specialCount; i++) {
      sequence.push(random(specials));
    }
    shuffle(sequence);

  } else if (round === 3) {
    let specialCount = floor(random(1, 3)); // 1 or 2
    let letterCount = floor(random(1, 5));  // 1 to 4
    while (specialCount + letterCount > 8) {
      letterCount = floor(random(1, 5));
    }
    let numberCount = 8 - specialCount - letterCount;
    for (let i = 0; i < numberCount; i++) {
      sequence.push(random(numbers));
    }
    for (let i = 0; i < specialCount; i++) {
      sequence.push(random(specials));
    }
    for (let i = 0; i < letterCount; i++) {
      sequence.push(random(letters));
    }
    shuffle(sequence);
  }
}

function startRound() {
  if (locked) return;
  sendLED("W")
  locked = true;
  inputIndex = 0;
  makeSequence();

  const session = gameSession;
  playSequence(session);
}

function playSequence(session) {
  if (session !== gameSession) return;

  phase = "PLAYBACK";
  clearFaces();
  clearStates();
  setInputMode(false);

  setText(
    `ROUND ${round} / 3`,
    "WATCH THE PATTERN",
    "Memorize the 8-symbol sequence."
  );

  sendLED("W");

  let i = 0;

  function showNext() {
    if (session !== gameSession) return;
    if (i >= sequence.length) {
      addTimer(() => flipCards(session), 500);
      return;
    }

    let card = cards[i];
    let front = card.querySelector(".front");

    front.textContent = sequence[i];
    card.classList.add("reveal");

    addTimer(() => {
      if (session !== gameSession) return;
      card.classList.remove("reveal");
      i++;
      showNext();
    }, 500);
  }

  showNext();
}

function flipCards(session) {
  if (session !== gameSession) return;
  phase = "FLIP";
  for (let card of cards) {
    card.classList.add("flip");
  }
  addTimer(() => {
    if (session !== gameSession) return;
    clearFaces();
    for (let card of cards) {
      card.classList.remove("flip");
    }
    startInput();
  }, 450);
}

function startInput() {
  phase = "INPUT";
  locked = false;
  inputIndex = 0;
  setInputMode(true);

  setText(
    `ROUND ${round} / 3`,
    "ENTER THE SEQUENCE",
    "Repeat the pattern in the same order."
  );

  sendLED("P");
}

function handleInput(inputKey) {
  if (phase !== "INPUT" || locked) return;

  let expected = sequence[inputIndex];
  let card = cards[inputIndex];
  let front = card.querySelector(".front");

  if (inputKey === expected) {
    front.textContent = inputKey;
    card.classList.add("correct");

    inputIndex++;

    if (inputIndex === 8) {
      addTimer(() => {
        card.classList.remove("correct");
        roundSuccess();
      }, 250);
    } else {
      addTimer(() => {
        card.classList.remove("correct");
      }, 250);
    }
  } else {
    front.textContent = inputKey;
    card.classList.add("wrong");

    addTimer(() => {
      card.classList.remove("wrong");
      roundFail();
    }, 250);
  }
}

function roundSuccess() {
  if (phase !== "INPUT") return;

  phase = "SUCCESS";
  locked = true;
  setInputMode(false);
  success++;

  setText(
    `ROUND ${round} / 3`,
    `SUCCESS ${success} / 3`,
    "Round complete."
  );

  sendLED("S");

  for (let card of cards) {
    card.classList.add("correct");
  }

  addTimer(() => {
    if (phase !== "SUCCESS") return;
    for (let card of cards) {
      card.classList.remove("correct");
    }

    if (success === 3) {
      phase = "COMPLETE";
      locked = false;
      setText("SUCCESS 3 / 3", "GAME COMPLETE", "Press R to restart.");
      return;
    }

    round++;
    locked = false;
    startRound();
  }, 1000);
}

function roundFail() {
  if (phase !== "INPUT") return;

  phase = "FAIL";
  locked = true;
  setInputMode(false);

  setText(
    `ROUND ${round} / 3`,
    "WRONG SEQUENCE",
    "Restarting this round..."
  );

  sendLED("F");

  for (let card of cards) {
    card.classList.add("wrong");
  }

  addTimer(() => {
    if (phase !== "FAIL") return;
    for (let card of cards) {
      card.classList.remove("wrong");
    }

    clearFaces();
    clearStates();
    locked = false;
    startRound();
  }, 1000);
}

function resetGame() {
  gameSession ++
  clearAllTimers();

  round = 1;
  success = 0;
  sequence = [];
  inputIndex = 0;
  phase = "WAIT";
  locked = false;

  clearFaces();
  clearStates();
  setInputMode(false);

  setText(
    "ROUND 1 / 3",
    "PRESS SPACE TO START",
    "8 empty cards will fill in rhythm. Then repeat the sequence."
  );
  sendLED("O");
}