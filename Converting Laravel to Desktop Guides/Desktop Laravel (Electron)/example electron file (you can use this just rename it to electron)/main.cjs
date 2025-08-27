const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let processes = [];
let splashWindow;
let mainWindow;

function runArtisan(command) {
  const proc = spawn("php", ["artisan", ...command], {
    cwd: path.join(__dirname, ".."), // Laravel root
    shell: true,
  });
  proc.stdout.on("data", (data) => {
    console.log(`[${command.join(" ")}]: ${data}`);
  });
  proc.stderr.on("data", (data) => {
    console.error(`[${command.join(" ")} ERROR]: ${data}`);
  });
  processes.push(proc);
  return proc;
}

// Function to check if Laravel server is running
function checkLaravelReady(url, callback) {
  const tryConnect = () => {
    console.log("Checking Laravel server...");
    http
      .get(url, (res) => {
        console.log("Laravel status:", res.statusCode);
        if (res.statusCode === 200) {
          callback(true);
        } else {
          setTimeout(tryConnect, 1000);
        }
      })
      .on("error", () => {
        console.log("Laravel not ready yet...");
        setTimeout(tryConnect, 1000);
      });
  };
  tryConnect();
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

function createMainWindow() {
  console.log("Opening main window...");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("http://127.0.0.1:8000");

  mainWindow.on("closed", () => {
    processes.forEach((p) => p.kill());
  });

  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }
}

app.whenReady().then(() => {
  createSplash();

  // Start Laravel backend + workers
  runArtisan(["serve", "--host=127.0.0.1", "--port=8000"]); // Web server
  runArtisan(["queue:work"]);   // Queue worker
  runArtisan(["reverb:start"]); // Reverb server

  // Wait until Laravel is ready before showing main window
  checkLaravelReady("http://127.0.0.1:8000/login", () => {
    createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    processes.forEach((p) => p.kill());
    app.quit();
  }
});
