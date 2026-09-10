const body = document.getElementById("attendanceBody");

const presentCount = document.getElementById("presentCount");
const employeeCount = document.getElementById("employeeCount");

const search = document.getElementById("search");

let attendanceData = [];

async function loadDashboard() {

  const response = await fetch(
    "http://localhost:5000/api/employees/attendance/today"
  );

  const result = await response.json();

  attendanceData = result.attendance;

  renderTable(attendanceData);

}

function renderTable(data){

body.innerHTML="";

presentCount.innerText=data.length;

const uniqueEmployees=new Set();

data.forEach(item=>{

uniqueEmployees.add(item.employees.employee_id);

const row=document.createElement("tr");

row.innerHTML=`

<td>

<img src="${item.employees.photo_url}">

</td>

<td>${item.employees.full_name}</td>

<td>${item.employees.department}</td>

<td>

${new Date(item.check_in).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short"
})}

</td>

`;

body.appendChild(row);

});

employeeCount.innerText=uniqueEmployees.size;

}

search.addEventListener("input",()=>{

const value=search.value.toLowerCase();

const filtered=attendanceData.filter(item=>{

return item.employees.full_name
.toLowerCase()
.includes(value);

});

renderTable(filtered);

});

loadDashboard();

setInterval(loadDashboard,10000);