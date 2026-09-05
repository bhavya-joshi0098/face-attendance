const video = document.getElementById("video");
const status = document.getElementById("status");

const resultCard = document.getElementById("resultCard");
const employeePhoto = document.getElementById("employeePhoto");
const employeeName = document.getElementById("employeeName");
const employeeDepartment = document.getElementById("employeeDepartment");
const attendanceTime = document.getElementById("attendanceTime");

let employees = [];
let matcher = null;
let lastRecognized = "";
let lastTime = 0;

async function loadModels() {

  status.innerText = "Loading Models...";

  await faceapi.nets.ssdMobilenetv1.loadFromUri("./models");
  await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("./models");

  status.innerText = "Loading Employees...";

}

async function loadEmployees() {

  const response = await fetch("http://localhost:5000/api/employees");
  const result = await response.json();

  employees = result.employees.map(emp => {

    return new faceapi.LabeledFaceDescriptors(
      emp.full_name,
      [new Float32Array(emp.face_descriptor)]
    );

  });

  matcher = new faceapi.FaceMatcher(employees, 0.45);

  status.innerText = "Models Ready";

}

async function startCamera() {

  const stream = await navigator.mediaDevices.getUserMedia({

    video:{
      facingMode:"user",
      width:{ideal:720},
      height:{ideal:1280}
    }

  });

  video.srcObject = stream;

}

video.addEventListener("play", () => {

  const canvas = document.getElementById("overlay");

  const displaySize = {

    width: video.clientWidth,
    height: video.clientHeight

  };

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;

  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {

    const detection = await faceapi
      .detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);

    if (!detection) {

      status.innerText = "No Face";

      resultCard.style.display = "none";

      return;

    }

    const resized = faceapi.resizeResults(detection,displaySize);

    faceapi.draw.drawDetections(canvas,[resized]);
    faceapi.draw.drawFaceLandmarks(canvas,[resized]);

    const best = matcher.findBestMatch(detection.descriptor);

    if(best.label==="unknown"){

      status.innerText="Unknown Person";

      resultCard.style.display="none";

      return;

    }

    const now=Date.now();

    if(best.label===lastRecognized && now-lastTime<5000){

      return;

    }

    lastRecognized=best.label;
    lastTime=now;

    const employee=employees.find(e=>e.label===best.label);

    const response=await fetch("http://localhost:5000/api/employees");

    const data=await response.json();

    const info=data.employees.find(e=>e.full_name===best.label);

    resultCard.style.display = "block";
resultCard.className = "result-card success-card";

employeePhoto.src = info.photo_url;
employeeName.innerText = `Welcome ${info.full_name}`;
employeeDepartment.innerText = info.department;
attendanceTime.innerText = new Date().toLocaleTimeString();

// Save attendance in Supabase
const save = await fetch("http://localhost:5000/api/employees/attendance", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
body: JSON.stringify({
  employee_id: info.id,
  confidence: Number((1 - best.distance).toFixed(3))
})
});

const saveResult = await save.json();

if (saveResult.duplicate) {
  status.innerText = "Already Marked";
} else {
  status.innerText = "Attendance Marked";
}

  },250);

});

(async()=>{

  await loadModels();
  await loadEmployees();
  await startCamera();

})();