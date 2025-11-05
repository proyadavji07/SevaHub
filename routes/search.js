const express = require("express");
const router = express.Router();
const ServiceProvider = require("../models/ServiceProvider");


// 🔍 AJAX Suggestion API
router.get("/search-services", async (req, res) => {
  try {
    const query = req.query.q?.trim().toLowerCase();
    if (!query) return res.json([]);

    const providers = await ServiceProvider.find({}, "name serviceType").lean();
    let results = [];

    for (const provider of providers) {
      if (!provider.serviceType) continue;

      for (const [serviceName, details] of Object.entries(provider.serviceType)) {
        if (serviceName.includes(query)) {
          results.push({
            service: serviceName.charAt(0).toUpperCase() + serviceName.slice(1),
            price: details.price || 0,
            provider: provider.name,
            providerId: provider._id
          });
        }
      }
    }

    if (results.length === 0) {
      return res.json([{ noResult: true, message: `No providers available for "${query}" service` }]);
    }

    // Group by service name to avoid duplicates
    const uniqueServices = [];
    const seen = new Set();
    for (const r of results) {
      if (!seen.has(r.service.toLowerCase())) {
        seen.add(r.service.toLowerCase());
        uniqueServices.push(r);
      }
    }

    res.json(uniqueServices.slice(0, 10));
  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🧭 Search Results Page (like /services/waxing)
router.get("/services/:serviceName", async (req, res) => {
  try {
    const serviceName = req.params.serviceName.toLowerCase();

    // Find all providers that offer this service
    const providers = await ServiceProvider.find({
      [`serviceType.${serviceName}`]: { $exists: true }
    }).lean();

    if (!providers.length) {
      return res.render("searchResults", {
        title: "No Providers Found",
        serviceName,
        providers: [],
        message: `No providers available for "${serviceName}" service.`
      });
    }

    res.render("searchResults", {
      title: `Service Providers for ${serviceName}`,
      serviceName,
      providers
    });
  } catch (err) {
    console.error("Service search error:", err);
    res.status(500).send("Server error while searching services");
  }
});

module.exports = router;