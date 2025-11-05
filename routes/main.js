
const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const ServiceProvider = require("../models/ServiceProvider");

router.get("/", async (req, res) => {
  try {
    // Fetch global counts
    const totalCustomers = await Customer.countDocuments();
    const totalProviders = await ServiceProvider.countDocuments();

    console.log("🟢 Connected DB:", Customer.db.name);
    console.log("Total Customers:", totalCustomers);
    console.log("Total Providers:", totalProviders);

    // Render homepage and send counts to handlebars
    res.render("home", {
      title: "SevaHub - Home Services",
      totalCustomers,
      totalProviders,
      user: req.session.user || null
    });
  } catch (err) {
    console.error("❌ Error fetching stats:", err);
    res.render("home", {
      totalCustomers: 0,
      totalProviders: 0,
      user: req.session.user || null
    });
  }
});

module.exports = router;