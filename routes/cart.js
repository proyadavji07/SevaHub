const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const ServiceProvider = require("../models/ServiceProvider");

// Middleware: check login aur role = customer
function isCustomer(req, res, next) {
  if (req.session.user && req.session.user.role === "customer") {
    return next();
  }
  req.session.returnUrl = req.originalUrl;
  return res.redirect("/login");
}

// ✅ Show cart page
router.get("/cart", isCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.user._id)
      .populate("cart.serviceProviderId");

    if (!customer) {
      return res.status(404).send("Customer not found");
    }

    const cart = customer.cart.map(item => {
      const obj = item.toObject();
      return {
        ...obj,
        providerId: obj.serviceProviderId?._id?.toString() || "",
        providerName: obj.serviceProviderId?.name || "Unknown"
      };
    });

    return res.render("cart", { cart });
  } catch (err) {
    console.error("❌ Error loading cart:", err);
    return res.status(500).send("Server error");
  }
});

// ✅ Add to cart
router.post("/add-to-cart", isCustomer, async (req, res) => {
  try {
    const { providerId, serviceName } = req.body;

    // Service Provider fetch karo
    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      return res.status(400).send("Invalid service provider");
    }

    const service = provider.serviceType.get(serviceName.toLowerCase());
    if (!service) {
      return res.status(400).send("Service not found");
    }

    const customer = await Customer.findById(req.session.user._id);

    // Duplicate entry check
    const alreadyInCart = customer.cart.find(
      item =>
        item.serviceProviderId.toString() === providerId &&
        item.serviceName === serviceName
    );

    if (alreadyInCart) {
      return res.redirect("/cart");
    }

    customer.cart.push({
    serviceProviderId: provider._id,
    providerName: provider.name,
    serviceName,
    price: service.price,
    description: service.description,
  });


    await customer.save();
    res.redirect("/customer/cart");
  } catch (err) {
    console.error("❌ Add to Cart Error:", err);
    res.status(500).send("Server error");
  }
});

// ✅ Remove from cart
router.post("/remove-from-cart", isCustomer, async (req, res) => {
  try {
    const { providerId, serviceName } = req.body;

    const customer = await Customer.findById(req.session.user._id);

    customer.cart = customer.cart.filter(
      item =>
        !(
          item.serviceProviderId.toString() === providerId &&
          item.serviceName === serviceName
        )
    );

    await customer.save();

    res.redirect("/customer/cart");
  } catch (err) {
    console.error("❌ Remove Cart Error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
