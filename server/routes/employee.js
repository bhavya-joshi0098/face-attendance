const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Upload Base64 image to Cloudinary
function uploadToCloudinary(base64Image) {
  return new Promise((resolve, reject) => {

    const buffer = Buffer.from(
      base64Image.split(",")[1],
      "base64"
    );

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "face-attend-ai/employees"
      },
      (error, result) => {

        if (error) reject(error);
        else resolve(result);

      }
    );

    streamifier.createReadStream(buffer).pipe(stream);

  });
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*");

    if (error) throw error;

    res.json({
      success: true,
      employees: data
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
});

router.post("/register", async (req, res) => {

  try {

    const {
      employeeId,
      fullName,
      department,
      faceDescriptor,
      profileImage
    } = req.body;

    if (!employeeId || !fullName || !faceDescriptor || !profileImage) {

      return res.status(400).json({
        success: false,
        message: "Missing required data."
      });

    }

    // Upload image
    const uploaded = await uploadToCloudinary(profileImage);

    // Save employee
    const { data, error } = await supabase
      .from("employees")
      .insert([
        {
          employee_id: employeeId,
          full_name: fullName,
          department,
          photo_url: uploaded.secure_url,
          face_descriptor: faceDescriptor
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      employee: data[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});

// Mark attendance
// Mark attendance
router.post("/attendance", async (req, res) => {
  try {
    const { employee_id, confidence } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID missing."
      });
    }

    // Prevent duplicate attendance within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: recent, error: recentError } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employee_id)
      .gte("check_in", fiveMinutesAgo)
      .limit(1);

    if (recentError) throw recentError;

    if (recent.length > 0) {
      return res.json({
        success: true,
        duplicate: true
      });
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert([
        {
          employee_id,
          confidence,
          device_name: "Office Kiosk"
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      attendance: data[0]
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Dashboard - Today's attendance
router.get("/attendance/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("attendance")
      .select(`
        id,
        check_in,
        confidence,
        device_name,
        employees (
          employee_id,
          full_name,
          department,
          photo_url
        )
      `)
      .eq("attendance_date", today)
      .order("check_in", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      attendance: data
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
});

module.exports = router;
