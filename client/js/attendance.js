// =========================================
// FaceAttend AI - Attendance Kiosk
// =========================================

// ---------- DOM ----------
const video = document.getElementById("video");
const status = document.getElementById("status");

const resultCard = document.getElementById("resultCard");
const employeePhoto = document.getElementById("employeePhoto");
const employeeName = document.getElementById("employeeName");
const employeeDepartment = document.getElementById("employeeDepartment");
const attendanceTime = document.getElementById("attendanceTime");

// ---------- Audio ----------
window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

async function playBeep(type = "success") {
  try {
    if (window.audioCtx.state === "suspended") {
      await window.audioCtx.resume();
    }

    const oscillator = window.audioCtx.createOscillator();
    const gain = window.audioCtx.createGain();

    oscillator.connect(gain);
    gain.connect(window.audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = type === "success" ? 900 : 300;

    gain.gain.setValueAtTime(0.2, window.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      window.audioCtx.currentTime + 0.18
    );

    oscillator.start();
    oscillator.stop(window.audioCtx.currentTime + 0.18);

  } catch (err) {
    console.error("Beep Error:", err);
  }
}

// Make available from browser console
window.playBeep = playBeep;

// ---------- Recognition ----------
let employees = [];
let matcher = null;

let lastRecognized = "";
let lastRecognizedTime = 0;

let detectionInterval = null;

// =========================================
// Load AI Models
// =========================================

async function loadModels() {

  status.innerText = "Loading AI Models...";

  await faceapi.nets.ssdMobilenetv1.loadFromUri("./models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("./models");

}

// =========================================
// Load Employees
// =========================================

async function loadEmployees() {

  status.innerText = "Loading Employees...";

  const response = await fetch("http://localhost:5000/api/employees");
  const result = await response.json();

  employees = result.employees;

  const labeledDescriptors = employees.map(emp =>

    new faceapi.LabeledFaceDescriptors(
      emp.full_name,
      [new Float32Array(emp.face_descriptor)]
    )

  );

  matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45);

  status.innerText = "Models Ready";

}

// =========================================
// Start Camera
// =========================================

async function startCamera() {

  const stream = await navigator.mediaDevices.getUserMedia({

    video: {
      facingMode: "user",
      width: { ideal: 720 },
      height: { ideal: 1280 }
    },

    audio: false

  });

  video.srcObject = stream;

  // Unlock audio after camera permission
  await window.audioCtx.resume();

}

// =========================================
// Face Recognition Loop
// =========================================

video.addEventListener("play", () => {

  const canvas = document.getElementById("overlay");

  const displaySize = {
    width: video.clientWidth,
    height: video.clientHeight
  };

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;

  faceapi.matchDimensions(canvas, displaySize);

  if (detectionInterval) clearInterval(detectionInterval);

  detectionInterval = setInterval(async () => {

    const detection = await faceapi
      .detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection) {

      status.innerText = "No Face";

      resultCard.style.display = "none";

      return;
    }

    const resized = faceapi.resizeResults(detection, displaySize);

    faceapi.draw.drawDetections(canvas, [resized]);
    faceapi.draw.drawFaceLandmarks(canvas, [resized]);

    const best = matcher.findBestMatch(detection.descriptor);

    // ---------- Unknown ----------
    if (best.label === "unknown") {

      status.innerText = "Unknown Person";

      resultCard.style.display = "none";

      playBeep("error");

      return;
    }

    // Prevent repeated recognition every 5 seconds
    const now = Date.now();

    if (
      best.label === lastRecognized &&
      now - lastRecognizedTime < 5000
    ) {
      return;
    }

    lastRecognized = best.label;
    lastRecognizedTime = now;

    // Employee already exists in memory
    const info = employees.find(emp => emp.full_name === best.label);

    if (!info) return;

    // ---------- Show Success ----------
    resultCard.style.display = "block";
    resultCard.className = "result-card success-card";

    employeePhoto.src = info.photo_url;
    employeeName.innerText = `Welcome ${info.full_name}`;
    employeeDepartment.innerText = info.department || "Not Assigned";

    attendanceTime.innerText = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short"
    });

    // ---------- Save Attendance ----------
    try {

      const saveResponse = await fetch(
        "http://localhost:5000/api/employees/attendance",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            employee_id: info.id,
            confidence: Number((1 - best.distance).toFixed(3))
          })
        }
      );

      const saveResult = await saveResponse.json();

      if (saveResult.duplicate) {
        status.innerText = "Already Marked";
      } else {
        status.innerText = "Attendance Marked";
      }

    } catch (err) {

      console.error("Attendance Save Error:", err);

      status.innerText = "Attendance Save Failed";

    }

    playBeep("success");

    // Hide welcome card after 3 seconds
    setTimeout(() => {

      resultCard.style.display = "none";

      status.innerText = "Ready";

    }, 3000);

  }, 250);

});

// =========================================
// Initialize
// =========================================

(async () => {

  try {

    await loadModels();
    await loadEmployees();
    await startCamera();

  } catch (err) {

    console.error(err);

    status.innerText = "Initialization Failed";

  }

})();

// =========================================
// Unlock Audio (First Touch)
// =========================================

document.addEventListener("pointerdown", async () => {

  if (window.audioCtx.state === "suspended") {
    await window.audioCtx.resume();
    console.log("Audio Unlocked");
  }

}, { once: true });

// =========================================
// Service Worker
// =========================================

if ("serviceWorker" in navigator) {

  navigator.serviceWorker.register("./service-worker.js")
    .catch(console.error);

}