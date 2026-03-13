const BAUD_RATE = 9600; // Serial Communication

// Serial Connection
let port, connectBtn;

// UI Elements
let grid, progressText, statusText, subText;

// Card Storage
let cards = [];

// Game State Variables
let round = 1;
let success = 0;
let sequence = [];
let inputIndex = 0; // which symbol the player is currently entering
let phase = "WAIT"; // current stage of the game (Wait, Playback, Input, Success, Fail)
let locked = false; // preventing inputs during animations or playback

// Timer Management
let timerIds = []; // stores all active setTimeout timres so they can be cleared on reset
let gameSession = 0; // increments when restarting the game

// Symbol Groups
const symbols = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "A", "B", "C", "D", "*", "#"]; // all possible keypad inputs
const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]; // numeric keypad values
const specials = ["*", "#"]; // special keypad characters
const letters = ["A", "B", "C", "D"]; // letter keys

/**
 * setup()
 * initializes serial communication, load UI elements, creates the card grid, and resets the game state
 */
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

/**
 * draw()
 * read incoming serial data from Arduino and processes keypad input
 */
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

/**
 * keyPressed()
 * handles keyboard input from the computer
 * R is resetting the game, SPACE is starting the game
 */
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
/**
 * setupSerial()
 * initialize the serial port and creates the connect button to the Arduino
 */
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

/**
 * checkPort()
 * checks whether the seiral port is open and updates the connect button label
 */
function checkPort() {
  if (!port.opened()) {
    connectBtn.html("Connect to Arduino");
    return false;
  } else {
    connectBtn.html("Disconnect");
    return true;
  }
}

/**
 * onConnectButtonClicked()
 * toggles serial connection when the button is pressed
 */
function onConnectButtonClicked() {
  if (!port.opened()) {
    port.open(BAUD_RATE);
  } else {
    port.close();
  }
}

/**
 * sendLED(state)
 * sends a signal to Arduino to switch the led state (five states: O, W, P, S, F)
 */
function sendLED(state) {
  if (port.opened()) {
    port.write(state + "\n");
  }
}

// ---------- UI FUNCTION ----------
/**
 * createGrid()
 * creating 8 card elements and adds them to the grid container
 */
function createGrid() {
  for (let i = 0; i < 8; i++) {
    let card = document.createElement("div");
    card.className = "card";

    let front = document.createElement("div");
    front.className = "face front";

    let back = document.createElement("div");
    back.className = "face back";

    // adding front and back to the cards
    card.appendChild(front);
    card.appendChild(back);
    grid.appendChild(card); // adding cards to the grid section of the screen
    cards.push(card);
  }
}

/**
 * setText()
 * update the progress, title and subtitle text
 * progress: number of rounds or success
 * title: main instructions (e.g. watch the pattern)
 * subtitle: additional explanation
 */
function setText(progress, title, subtitle) {
  progressText.textContent = progress;
  statusText.textContent = title;
  subText.textContent = subtitle;
}

/**
 * clearFaces()
 * removes symbols from all cards front
 */
function clearFaces() {
  for (let card of cards) {
    card.querySelector(".front").textContent = "";
  }
}

/**
 * clearStates()
 * reset all visual states from the cards by removing the css classes used for animations and ffedback
 * so the next round can start clean
 */
function clearStates() {
  for (let card of cards) {
    card.classList.remove("reveal", "flip", "correct", "wrong", "input-mode");
  }
}

/**
 * setInputMode(on)
 * adds or removes the input mode style on all cards
 * to show when the players can start entering the sequence
 */
function setInputMode(on) {
  for (let card of cards) {
    if (on) card.classList.add("input-mode");
    else card.classList.remove("input-mode");
  }
}

// ---------- TIMER HELPERS ----------
// these helper functions manage all the animation (e.g. filpping/revealing the cards) timers so they can be cancelled when the game resets

/**
 * addTimer()
 * create a timeout and stores its ID for later clean up
 */
function addTimer(fn, ms) {
  const id = setTimeout(fn, ms);
  timerIds.push(id);
  return id;
}

/**
 * clearAllTimers()
 * cancels all currently active timers
 */
function clearAllTimers() {
  for (let id of timerIds) {
    clearTimeout(id);
  }
  timerIds = [];
}

// ---------- GAME LOGIC ----------
/**
 * shuffle(array)
 * randomly shuffles an array
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

/**
 * makeSequence()
 * generates the 8 symbol sequence for the current round
 * round 1: numbers only
 * round 2: numbers + special char (min 1, max 2)
 * round 3: numbers + letters A-D (min 1, max 4)
 */
function makeSequence() {
  sequence = [];
  // round 1
  if (round === 1) {
    for (let i = 0; i < 8; i++) {
      sequence.push(random(numbers));
    }
  //round 2
  } else if (round === 2) {
    let specialCount = floor(random(1, 3)); // 1 or 2
    let numberCount = 8 - specialCount;
    for (let i = 0; i < numberCount; i++) {
      sequence.push(random(numbers));
    }
    for (let i = 0; i < specialCount; i++) {
      sequence.push(random(specials));
    }
    shuffle(sequence);

  //round 3
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

/**
 * startRound()
 * begins a new round by generating the sequence
 */
function startRound() {
  if (locked) return;
  sendLED("W")
  locked = true;
  inputIndex = 0;
  makeSequence();

  const session = gameSession;
  playSequence(session);
}

/**
 * playSequence()
 * displays the generated sequence one card at a time
 */
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

/**
 * flipCards()
 * flips the card to hide the sequence before user input starts
 */
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

/**
 * startInput()
 * allow player input after the sequence playback is done
 */
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

/**
 * handleInput()
 * check player input vs actual order
 */
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

/**
 * roundSuccess()
 * handles visual feedback and progression when a round is completed
 */
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

/**
 * roundFail()
 * handles visual feedback and restart the round after an incorrect input
 */
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

/**
 * resetGame()
 * resets the game state and UI
 */
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