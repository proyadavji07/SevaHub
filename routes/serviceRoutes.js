// routes/serviceRoutes.js
const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const ServiceProvider = require("../models/ServiceProvider");

router.get("/:serviceType", async (req, res) => {
  try {
    const serviceType = req.params.serviceType.toLowerCase();

    // Find all providers offering this service
    const providers = await ServiceProvider.find({
      [`serviceType.${serviceType}`]: { $exists: true }
    }).lean();

    // Format provider data for the frontend
    const formattedProviders = providers.map(p => {
      const serviceData = p.serviceType?.[serviceType];
      return {
        _id: p._id.toString(),
        name: p.name,
        gender: p.gender,
        phone: p.phone,
        serviceName: serviceType,
        price: serviceData?.price || 0,
        description: serviceData?.description || "Not available",
      };
    });

    // 🛒 Fetch customer cart if logged in
    let cart = [];
    if (req.session.user && req.session.user.role === "customer") {
      const customer = await Customer.findById(req.session.user._id)
        .populate("cart.serviceProviderId")
        .lean();

      if (customer?.cart?.length) {
        cart = customer.cart.map(item => ({
          providerId: item.serviceProviderId?._id?.toString() || "",
          providerName: item.serviceProviderId?.name || "Unknown",
          serviceName: item.serviceName,
          price: item.price,
        }));
      }
    }

    // Render the service providers page
    res.render("service-providers", {
      serviceType,
      providers: formattedProviders,
      cart,
    });
  } catch (err) {
    console.error("❌ Error fetching providers:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;