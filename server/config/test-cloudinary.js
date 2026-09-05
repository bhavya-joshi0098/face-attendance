const cloudinary = require("./cloudinary");

console.log("Cloud Name:", cloudinary.config().cloud_name);

if (cloudinary.config().cloud_name) {
  console.log("✅ Cloudinary configuration loaded successfully.");
} else {
  console.log("❌ Cloudinary configuration failed.");
}