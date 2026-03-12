const BAUD_RATE = 9600; // This should match the baud rate in your Arduino sketch

let port, connectBtn; // Declare global variables
let keypadInput = ""; // Store the last keypad value sent from Arduino
let ledOn = false; // Track if the LED is ON or OFF
let bgColor; // Store the current background color for the canvas
let r=255, g=255, b=255; // Store RGB values

function setup() {
  setupSerial(); // Run our serial setup function (below)

  // Create a canvas that is the size of our browser window.
  // windowWidth and windowHeight are p5 variables
  createCanvas(windowWidth, windowHeight);
  bgColor = color(255,255,255);
  // p5 text settings. BOLD and CENTER are constants provided by p5.
  // See the "Typography" section in the p5 reference: https://p5js.org/reference/
  textFont("system-ui", 50);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
}

function draw() {
  // Check if the serial port is connected
  const portIsOpen = checkPort();
  if (!portIsOpen) return; // Do nothing when not connected

  let str = port.readUntil("\n"); // Read from the port until the newline

  // If there's no new data, still draw the current UI and exit
  if (str.length == 0){
    background(bgColor); // Keep the last background color
    fill("black"); // Text color

    // Show the values on screen
    text("Keypad Input: " + keypadInput, windowWidth/2, windowHeight/2-40);
    text("LED Status: " + (ledOn? "ON":"OFF"), windowWidth/2, windowHeight/2+40);
    text("Background Color: (" + int(r)+", "+int(g)+", "+int(b)+")", windowWidth/2, windowHeight/2+120);
    return; // No new serial data, so stop this fram after drawing UI
  }

  // Remove extra spaces and newline from the serial string
  const msg = str.trim();

  // Update keypadInput if the user presses keypad
  if(msg.startsWith("KEY,")){
    keypadInput = msg.split(",")[1];
  }

  // Change background to a random color if button is pressed
  if(msg === "BTN"){
    r=random(255);
    g=random(255);
    b=random(255);
    bgColor = color(r,g,b);
  }

  // Draw the current UI
  background(bgColor);
  fill("black");
  text("Keypad Input: " + keypadInput, windowWidth/2, windowHeight/2-40);
  text("LED Status: " + (ledOn? "ON":"OFF"), windowWidth/2, windowHeight/2+40);
  text("Background Color: (" + int(r)+", "+int(g)+", "+int(b)+")", windowWidth/2, windowHeight/2+120);
}

// Run when the user presses a key on the laptop keyboard
function keyPressed(){
  // If the user presses ENTER, reset the background to white
  if (keyCode === ENTER){
    bgColor = color(255, 255, 255);
    r = 255;
    g = 255;
    b = 255;
    // Stop here so ENTER does not trigger LED logic
    return false;
  }
  if(!keypadInput) return false; // Do nothing if there's no keypad value

  // If the pressed laptop key matches the last keypad input, toggle LED
  if(key.toUpperCase() === keypadInput.toUpperCase()){
    ledOn =! ledOn;
    // If the serial port is open, send the LED command to Arduino
    if(port.opened()){
    port.write("LED\n");
    }
  }
return false; // End keyPressed
}

// Set up the serial port and the connect button
function setupSerial() {
  port = createSerial();

  // Check to see if there are any ports we have used previously
  let usedPorts = usedSerialPorts();
  if (usedPorts.length > 0) {
    // If there are ports we've used, open the first one
    port.open(usedPorts[0], BAUD_RATE);
  }

  // create a connect button
  connectBtn = createButton("Connect to Arduino");
  connectBtn.position(5, 5); // Position the button in the top left of the screen.
  connectBtn.mouseClicked(onConnectButtonClicked); // When the button is clicked, run the onConnectButtonClicked function
}

function checkPort() {
  if (!port.opened()) {
    // If the port is not open, change button text
    connectBtn.html("Connect to Arduino");
    // Set background to gray
    background("gray");
    return false;
  } else {
    // Otherwise we are connected
    connectBtn.html("Disconnect");
    return true;
  }
}

function onConnectButtonClicked() {
  // When the connect button is clicked
  if (!port.opened()) {
    // If the port is not opened, we open it
    port.open(BAUD_RATE);
  } else {
    // Otherwise, we close it!
    port.close();
  }
}