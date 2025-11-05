const express = require("express");
const router = express.Router();
const isProvider = require("../middleware/isProvider"); // we’ll create this next
const Order = require("../models/Order");
const ServiceProvider = require("../models/ServiceProvider");


router.use((req, res, next) => {
  if (!req.session.user || req.session.role !== "service_provider") {
    return res.redirect("/login");
  }
  next();
});


// ✅ GET: Provider Dashboard (Main Page)
router.get("/dashboard", isProvider, async (req, res) => {
  try {
    const providerId = req.session.user._id;

    // Find all orders for this provider
    const orders = await Order.find({ serviceProvider: providerId })
      .populate("customer")
      .sort({ createdAt: -1 });

    const provider = await ServiceProvider.findById(providerId);

    res.render("provider/dashboard", {
      layout: "providerDashboardLayout",
      provider,
      orders,
      active: "dashboard",
    });
  } catch (err) {
    console.error("❌ Error loading provider dashboard:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ✅ POST: Update order status (e.g., Accept / Complete / Cancel)
router.post("/orders/:orderId/status", isProvider, async (req, res) => {
  const { status } = req.body;
  await Order.findByIdAndUpdate(req.params.orderId, { status });
  res.redirect("/provider/dashboard");
});

module.exports = router;
