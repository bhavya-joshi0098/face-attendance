// ===============================
// FaceAttend AI - Register Page
// ===============================

// DOM Elements
const video = document.getElementById("video");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("startCamera");
const registerBtn = document.getElementById("registerBtn");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

// Enrollment Settings
const MAX_SAMPLES = 10;
const CAPTURE_DELAY = 500; // milliseconds

let samples = [];
let isCapturing = false;
let detectionInterval = null;
let finalDescriptor = null;

let bestFrame = null;
let bestScore = -1;



// -------------------------------
// Load Face API Models
// -------------------------------
async function loadModels() {
  try {
    statusText.innerText = "Loading AI Models...";

    await faceapi.nets.ssdMobilenetv1.loadFromUri("./models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("./models");

    statusText.innerText = "Models Loaded";
  } catch (err) {
    console.error("Model Loading Error:", err);
    statusText.innerText = "Error loading models";
  }
}

// -------------------------------
// Start Camera
// -------------------------------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 }
      },
      audio: false
    });

    video.srcObject = stream;
  } catch (err) {
    console.error("Camera Error:", err);
    statusText.innerText = "Camera access denied";
  }
}

// -------------------------------
// Open Camera Button
// -------------------------------
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;

  await loadModels();
  await startCamera();
});

// -------------------------------
// Average Face Descriptors
// -------------------------------
function averageDescriptors(sampleList) {
  const avg = new Array(128).fill(0);

  sampleList.forEach(sample => {
    sample.forEach((value, index) => {
      avg[index] += value;
    });
  });

  return avg.map(v => v / sampleList.length);
}

// -------------------------------
// Reset Enrollment
// -------------------------------
function resetEnrollment() {
  samples = [];
  isCapturing = false;
  finalDescriptor = null;

  progressFill.style.width = "0%";
  progressText.innerText = "0/10 Samples";

  registerBtn.disabled = true;
}

// -------------------------------
// Video Started
// -------------------------------
video.addEventListener("play", () => {

  const canvas = document.getElementById("overlay");

  const displaySize = {
    width: video.clientWidth,
    height: video.clientHeight
  };

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;

  faceapi.matchDimensions(canvas, displaySize);

  if (detectionInterval) {
    clearInterval(detectionInterval);
  }

  detectionInterval = setInterval(async () => {

    const detection = await faceapi
      .detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection) {
      statusText.innerText = "No Face Detected";
      return;
    }

    const resized = faceapi.resizeResults(detection, displaySize);

    const box = detection.detection.box;

const faceArea = box.width * box.height;

const centerX = box.x + box.width / 2;
const centerY = box.y + box.height / 2;

const offsetX = Math.abs(centerX - displaySize.width / 2);
const offsetY = Math.abs(centerY - displaySize.height / 2);

// Higher score = better frame
const score = faceArea - (offsetX + offsetY) * 100;

if (score > bestScore) {

  bestScore = score;

  const captureCanvas = document.getElementById("captureCanvas");

  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;

  const captureCtx = captureCanvas.getContext("2d");

  captureCtx.drawImage(video, 0, 0);

  bestFrame = captureCanvas.toDataURL("image/jpeg", 0.95);

}

    faceapi.draw.drawDetections(canvas, [resized]);
    faceapi.draw.drawFaceLandmarks(canvas, [resized]);

    statusText.innerText = "Face Detected";

    // Enrollment already finished
    if (samples.length >= MAX_SAMPLES) {
      return;
    }

    // Capture one sample every 500ms
    if (!isCapturing) {

      isCapturing = true;

      samples.push(Array.from(detection.descriptor));

      const percent = (samples.length / MAX_SAMPLES) * 100;

      progressFill.style.width = percent + "%";
      progressText.innerText = `${samples.length}/${MAX_SAMPLES} Samples`;

      if (samples.length === MAX_SAMPLES) {

        finalDescriptor = averageDescriptors(samples);

        statusText.innerText = "Enrollment Complete";

        registerBtn.disabled = false;

        clearInterval(detectionInterval);

        console.log("Final Descriptor:", finalDescriptor);

      }

      setTimeout(() => {
        isCapturing = false;
      }, CAPTURE_DELAY);

    }

  }, 150);

});

// -------------------------------
// Register Button (Next Step)
// -------------------------------
registerBtn.addEventListener("click", async () => {

  if (!finalDescriptor || !bestFrame) {
    alert("Complete face enrollment first.");
    return;
  }

  const employeeId = document
    .getElementById("employeeId")
    .value.trim();

  const fullName = document
    .getElementById("fullName")
    .value.trim();

  const department = document
    .getElementById("department")
    .value.trim();

  if (!employeeId || !fullName) {
    alert("Enter Employee ID and Name.");
    return;
  }

  registerBtn.disabled = true;
  statusText.innerText = "Uploading Employee...";

  try {

    const response = await fetch(
      "http://localhost:5000/api/employees/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          employeeId,
          fullName,
          department,
          faceDescriptor: finalDescriptor,
          profileImage: bestFrame
        })
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    statusText.innerText = "Employee Registered";

    showSuccess(result.employee);

  } catch (err) {

    console.error(err);

    statusText.innerText = "Registration Failed";

    alert(err.message);

    registerBtn.disabled = false;

  }

});

function showSuccess(employee) {

  document.querySelector(".container").style.display = "none";

  const card = document.getElementById("successCard");
  card.style.display = "block";

  document.getElementById("successPhoto").src = employee.photo_url;
  document.getElementById("successName").innerText = employee.full_name;
  document.getElementById("successId").innerText =
    `Employee ID: ${employee.employee_id}`;
  document.getElementById("successDepartment").innerText =
    `Department: ${employee.department || "Not Assigned"}`;
  document.getElementById("successTime").innerText =
    `Registered: ${new Date(employee.created_at).toLocaleString()}`;
}

document.getElementById("nextEmployee").addEventListener("click", () => {

  document.getElementById("successCard").style.display = "none";
  document.querySelector(".container").style.display = "block";

  document.getElementById("employeeId").value = "";
  document.getElementById("fullName").value = "";
  document.getElementById("department").value = "";

  resetEnrollment();

  bestFrame = null;
  bestScore = -1;

  statusText.innerText = "Waiting...";

  startBtn.disabled = false;

});