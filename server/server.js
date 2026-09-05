const express = require("express");
const cors = require("cors");
require("dotenv").config();

const supabase = require("./config/supabase");

const employeeRoutes = require("./routes/employee");

const app = express();

app.use(cors());

// Increase request size for Base64 images
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/employees", employeeRoutes);

app.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("employees")
    .select("*");

  if (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }

  res.json({
    success: true,
    message: "Face Attendance API Running",
    employees: data
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
