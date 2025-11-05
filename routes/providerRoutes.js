const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Review = require('../models/Review');
const Order = require('../models/Order');
const upload = require("../middleware/uploadImage");
const fs = require("fs");
const path = require("path");
const { sendPasswordResetSuccess } = require('../utils/sendEmail');
const ServiceProvider = require("../models/ServiceProvider");

// 📌 GET: Provider Profile Page
router.get("/profile", async (req, res) => {
  if (!req.session.user || req.session.role !== "service_provider") {
    return res.status(403).render("error", { message: "Access denied — only for providers" });
  }

  const provider = await ServiceProvider.findById(req.session.user._id).lean();

  // Convert Map → Array for Handlebars
  const serviceArray = [];
  if (provider.serviceType && typeof provider.serviceType === "object") {
    for (const [key, value] of Object.entries(provider.serviceType)) {
      serviceArray.push({
        sname: key,
        price: value.price,
        description: value.description || ""
      });
    }
  }

  const serviceOptions = [
    "waxing", "manicure", "cleanup", "hair care", "haircut & styling", "beard trim & shape",
    "hair color & highlights", "head massage", "ac repair & service", "washing machine repair",
    "refrigerator repair", "tv repair & installation", "home deep cleaning", "sanitization service",
    "pest control", "sofa & carpet cleaning", "plumbing", "electrical", "painting", "carpentry"
  ];

  res.render("provider/profile", {
    layout: "providerDashboardLayout",
    provider,
    services: serviceArray,
    serviceOptions,
    active: "profile"
  });
});

// 📌 POST: Update Provider Profile
router.post('/profile', async (req, res) => {
  try {
    // ✅ Ensure provider is logged in
    if (!req.session.user || req.session.role !== "service_provider") {
      return res.redirect('/login');
    }

    const provider = await ServiceProvider.findById(req.session.user._id);
    if (!provider) {
      return res.redirect('/login');
    }

    const {
      name,
      phone,
      gender,
      dob,
      address,
      serviceTypeNames,
      serviceTypePrices,
      serviceTypeDescriptions
    } = req.body;

    // ✅ Update profile fields
    provider.name = name;
    provider.phone = phone;
    provider.gender = gender;
    provider.dob = dob;
    provider.address = address;

    // ✅ Update service types
    const serviceMap = new Map();
    if (Array.isArray(serviceTypeNames)) {
      for (let i = 0; i < serviceTypeNames.length; i++) {
        const sname = serviceTypeNames[i];
        const price = parseFloat(serviceTypePrices[i]) || 0;
        const desc = serviceTypeDescriptions?.[i] || "";
        if (sname) serviceMap.set(sname, { price, description: desc });
      }
    } else if (serviceTypeNames) {
      serviceMap.set(serviceTypeNames, {
        price: parseFloat(serviceTypePrices) || 0,
        description: serviceTypeDescriptions || ""
      });
    }

    provider.serviceType = serviceMap;

    await provider.save();

    console.log("✅ Provider profile updated:", provider);
    return res.redirect("/provider/profile?success=1");

  } catch (err) {
    console.error('❌ Error updating provider profile:', err);
    return res.redirect("/provider/profile?error=1");
  }
});

router.post("/upload-image", ensureProvider, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const provider = await ServiceProvider.findById(req.session.user._id);
    provider.image = "/uploads/profile/" + req.file.filename;
    await provider.save();

    // Also update session data
    req.session.user.image = provider.image;

    res.json({
      success: true,
      image: provider.image,
      message: "Profile picture updated successfully"
    });
  } catch (err) {
    console.error("❌ Provider image upload error:", err);
    res.status(500).json({ success: false, message: "Server error while uploading image" });
  }
});


// 🗑️ Remove Provider Profile Image
router.post("/remove-image", ensureProvider, async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.session.user._id);
    if (!provider) return res.status(404).json({ success: false, message: "Provider not found" });

    // Skip deleting if already default image
    if (provider.image && !provider.image.includes("default-profile.jpg")) {
      const filePath = path.join(__dirname, "../public", provider.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Reset to default
    provider.image = "/uploads/profile/default-profile.jpg";
    await provider.save();
    req.session.user.image = provider.image;

    res.json({ success: true, message: "Profile picture removed successfully", image: provider.image });
  } catch (err) {
    console.error("❌ Error removing provider image:", err);
    res.status(500).json({ success: false, message: "Server error while removing image" });
  }
});

// ✅ Middleware: ensure provider logged in
function ensureProvider(req, res, next) {
  if (req.session.user && req.session.role === "service_provider") {
    return next();
  }
  return res.status(403).render("error", { message: "Access denied — only for providers" });
}

// 👀 Provider can see all reviews for their orders
router.get('/reviews', async (req, res) => {
  try {
    if (!req.session.user || req.session.role !== "service_provider") {
      return res.status(403).render("error", { message: "Access denied — only for providers" });
    }

    // Fetch all orders of this provider
    const orders = await Order.find({ serviceProvider: req.session.user._id }).select('_id');

    // Extract all orderIds
    const orderIds = orders.map(o => o._id);

    // Fetch reviews linked to those orders
    const reviews = await Review.find({ orderId: { $in: orderIds } })
      .populate({
        path: 'orderId',
        populate: { path: 'customer serviceProvider', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();

    res.render('provider/reviews', {
      layout: 'providerDashboardLayout',
      active: 'reviews',
      reviews
    });
  } catch (err) {
    console.error("❌ Error loading provider reviews:", err);
    res.status(500).send("Server Error");
  }
});

// 📄 GET: Change Password Page
router.get("/change-password", (req, res) => {
  if (!req.session.user || req.session.role !== "service_provider") {
    return res.status(403).render("error", { message: "Access denied — only for providers" });
  }

  res.render("provider/changePassword", {
    layout: "providerDashboardLayout",
    title: "Change Password",
    active: "profile"
  });
});

// 🔐 POST: Change Password Logic
router.post("/change-password", async (req, res) => {
  try {
    if (!req.session.user || req.session.role !== "service_provider") {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    const provider = await ServiceProvider.findById(req.session.user._id);
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    const { oldPassword, newPassword } = req.body;

    const isMatch = await bcrypt.compare(oldPassword, provider.passwordHash);
    if (!isMatch) {
      return res.json({ success: false, message: "Old password is incorrect" });
    }

    provider.passwordHash = await bcrypt.hash(newPassword, 10);
    await provider.save();
    await sendPasswordResetSuccess(provider.email, provider.name);
    console.log("✅ Provider password changed:", provider.email);

    res.json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("❌ Error changing password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


module.exports = router;