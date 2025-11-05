const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const upload = require("../middleware/uploadImage");
const fs = require("fs");
const path = require("path");
const { sendPasswordResetSuccess, sendPaymentEmails } = require('../utils/sendEmail');
const Order = require("../models/Order");
const Review = require('../models/Review');


router.use((req, res, next) => {
  if (!req.session.user || req.session.role !== "customer") {
    return res.redirect("/login");
  }
  next();
});

// Middleware: only customer
function isCustomer(req, res, next) {
  if (req.session.user && req.session.user.role === "customer") return next();
  res.redirect("/login");
}

// Dashboard home
router.get("/dashboard", isCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.user._id);

    const cartCount = customer.cart ? customer.cart.length : 0;
    const myOrders = await Order.countDocuments({ customer: customer._id });
    const reviewCount = await Review.countDocuments({ customerId: customer._id });

    res.render("customer/dashboard", {
      layout: "customerDashboardLayout",
      active: "dashboard",
      user: customer,
      cartCount,
      myOrders,
      reviewCount
    });
  } catch (err) {
    console.error("❌ Dashboard Load Error:", err);
    res.status(500).send("Internal Server Error while loading dashboard");
  }
});

// Profile
router.get("/profile", isCustomer, async (req, res) => {
  const customer = await Customer.findById(req.session.user._id);
  res.render("customer/profile", { 
    layout: "customerDashboardLayout",
    active: "profile",
    user: customer
  });
});

// Update profile
router.post("/profile/update", isCustomer, async (req, res) => {
  const { name, email, phone, address } = req.body;
  await Customer.findByIdAndUpdate(req.session.user._id, { name, email, phone, address });
  res.redirect("/customer/profile");
});

// 📸 Upload or change profile picture
router.post("/profile/upload-image", isCustomer, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const customer = await Customer.findById(req.session.user._id);
    customer.image = "/uploads/profile/" + req.file.filename; // relative path
    await customer.save();

    // Update session info too
    req.session.user.image = customer.image;

    res.json({ success: true, image: customer.image, message: "Profile image updated successfully" });
  } catch (err) {
    console.error("❌ Image upload error:", err);
    res.status(500).json({ success: false, message: "Server error while uploading image" });
  }
});

// 📸 Remove profile picture
router.post("/profile/remove-image", isCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.user._id);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    if (customer.image && !customer.image.includes("default-profile.jpg")) {
      const filePath = path.join(__dirname, "../public", customer.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    customer.image = "/uploads/profile/default-profile.jpg";
    await customer.save();
    req.session.user.image = customer.image;

    res.json({ success: true, message: "Profile picture removed successfully", image: customer.image });
  } catch (err) {
    console.error("❌ Error removing customer image:", err);
    res.status(500).json({ success: false, message: "Server error while removing image" });
  }
});


// Change password
router.get("/profile/change-password", isCustomer, (req, res) => {
  res.render("customer/change-password", { 
    layout: "customerDashboardLayout",
    active: "profile"
  });
});

const bcrypt = require("bcrypt");

// Change Password
router.post("/profile/change-password", async (req, res) => {
  try {
    if (!req.session.user)
      return res.status(401).json({ success: false, message: "Please login again." });

    const { oldPassword, newPassword, confirmPassword } = req.body;
    const customer = await Customer.findById(req.session.user._id);

    if (!customer)
      return res.status(404).json({ success: false, message: "Customer not found." });

    // ✅ Check old password
    const isMatch = await bcrypt.compare(oldPassword, customer.passwordHash);
    if (!isMatch)
      return res.json({ success: false, message: "Old password is incorrect." });

    // ✅ Check confirm password
    if (newPassword !== confirmPassword)
      return res.json({ success: false, message: "New passwords do not match." });

    // ✅ Hash and save new password
    const hashed = await bcrypt.hash(newPassword, 10);
    customer.passwordHash = hashed;
    await customer.save();

    // ✅ Optional: Send success email
    await sendPasswordResetSuccess(customer.email, customer.name);

    console.log("✅ Customer password changed:", customer.email);

    // ✅ Respond with JSON success
    res.json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("❌ Change password error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while updating password."
    });
  }
});

// Cart page
router.get("/cart", isCustomer, async (req, res) => {
  const customer = await Customer.findById(req.session.user._id).populate("cart.serviceProviderId");
  
  res.render("customer/cart", {
    layout: "customerDashboardLayout",
    active: "cart",
    cart: customer.cart
  });
});

// Remove item from cart
router.post("/cart/remove/:id", isCustomer, async (req, res) => {
  await Customer.findByIdAndUpdate(req.session.user._id, {
    $pull: { cart: { _id: req.params.id } }
  });
  res.redirect("/customer/cart");
});


// Checkout page
router.get("/checkout/:cartId", isCustomer, async (req, res) => {
  const customer = await Customer.findById(req.session.user._id)
    .populate("cart.serviceProviderId");

  const item = customer.cart.id(req.params.cartId);
  if (!item) return res.status(404).send("Cart item not found");

  res.render("customer/checkout", {
    layout: "customerDashboardLayout",
    active: "cart",
    item,
  });
});

// post checkout
router.post("/checkout/:cartId/confirm", isCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.user._id)
      .populate("cart.serviceProviderId");
    const item = customer.cart.id(req.params.cartId);
    if (!item) return res.status(404).send("Cart item not found");

    const Order = require("../models/Order");

    // ✅ Create a new order (matches your schema)
    const order = new Order({
      customer: customer._id,
      serviceProvider: item.serviceProviderId._id,
      service: item.serviceName,
      totalAmount: item.price,
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date(),
    });

    await order.save();

    // ✅ Redirect to payment page for that order
    res.redirect(`/customer/payments/${order._id}`);
  } catch (err) {
    console.error("❌ Confirm Checkout Error:", err);
    res.status(500).send("Server error");
  }
});


// Orders list (fixed)
router.get("/orders", isCustomer, async (req, res) => {
  try {
    const customerId = req.session.user._id;

    const orders = await Order.find({ customer: customerId })
      .populate("serviceProvider") // correct field name
      .sort({ createdAt: -1 });    // latest first (optional)

    console.log("🧍 Customer ID:", customerId);
    console.log("📦 Found Orders:", orders);

    res.render("customer/orders", {
      layout: "customerDashboardLayout",
      active: "orders",
      orders
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).send("Server Error");
  }
});

// Payments page for specific order
router.get("/payments/:orderId", isCustomer, async (req, res) => {
  const Order = require("../models/Order");
  const order = await Order.findById(req.params.orderId).populate("serviceProvider");

  if (!order) return res.status(404).send("Order not found");

  res.render("customer/paymentPage", {
    layout: "customerDashboardLayout",
    active: "payments",
    order,
  });
});

// ✅ POST: Confirm Payment (Remove only paid cart item)
router.post("/payments/:orderId/confirm", isCustomer, async (req, res) => {
  try {
    const Order = require("../models/Order");
    const Customer = require("../models/Customer");

    const { paymentMethod } = req.body;
    const { orderId } = req.params;

    // 🔹 Find the order and populate relationships
    const order = await Order.findById(orderId)
      .populate("customer")
      .populate("serviceProvider");

    if (!order) {
      return res.status(404).send("Order not found!");
    }

    // 🔹 Update order payment details
    order.paymentStatus = "paid";
    order.status = "accepted";
    order.paymentMethod = paymentMethod;
    await order.save();
    await sendPaymentEmails(order.customer, order.serviceProvider, order);

    // 🔹 Remove only the matching cart item
    await Customer.updateOne(
      { _id: order.customer._id },
      {
        $pull: {
          cart: {
            serviceProviderId: order.serviceProvider._id,
            serviceName: order.service, // must match serviceName stored in cart
          },
        },
      }
    );

    // 🔹 Render payment success page
    res.render("customer/paymentSuccess", {
      order,
      message: "✅ Payment Successful! Your service has been booked.",
    });
  } catch (err) {
    console.error("❌ Payment confirmation error:", err);
    res.status(500).send("Internal Server Error during payment confirmation");
  }
});

// 📦 My Orders Page
router.get("/orders", isCustomer, async (req, res) => {
  try {
    const Order = require("../models/Order");

    // Always use session user id
    const customerId = req.session.user?._id;

    if (!customerId) {
      console.warn("⚠️ No user session found");
      return res.redirect("/login");
    }

    console.log("🔍 Fetching orders for customer:", customerId);

    const orders = await Order.find({ customer: customerId })
      .populate("serviceProvider")
      .sort({ createdAt: -1 });

    console.log("📦 Found orders:", orders);

    res.render("customer/orders", {
      layout: "customerDashboardLayout",
      active: "orders",
      orders,
    });
  } catch (err) {
    console.error("❌ Error loading My Orders:", err);
    res.status(500).send("Internal Server Error while fetching orders");
  }
});

// 🧾 View all reviews by customer
// ✏️ GET: Review form for a specific order
router.get('/reviews/add/:orderId', isCustomer, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('serviceProvider', 'name')
      .lean();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render('customer/addReview', {
      layout: 'customerDashboardLayout',
      active: 'reviews',
      order
    });
  } catch (err) {
    console.error("❌ Error loading review form:", err);
    res.status(500).send("Server Error");
  }
});

// 📝 Submit review for a specific order
router.post('/reviews/add/:orderId', isCustomer, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId).populate('serviceProvider');
    if (!order) return res.status(404).send("Order not found");

    await Review.create({
      customerId: req.session.user._id,
      orderId: order._id,
      rating,
      comment,
    });

    req.session.message = { type: 'success', text: 'Review added successfully!' };
    res.redirect('/customer/reviews');
  } catch (err) {
    console.error(err);
    req.session.message = { type: 'error', text: 'Error adding review.' };
    res.redirect('/customer/reviews');
  }
});

// 🧾 View all reviews by this customer
router.get('/reviews', isCustomer, async (req, res) => {
  try {
    const reviews = await Review.find({ customerId: req.session.user._id })
      .populate({
        path: 'orderId',
        populate: { path: 'serviceProvider', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();

    res.render('customer/reviews', {
      layout: 'customerDashboardLayout',
      active: 'reviews',
      reviews
    });
  } catch (err) {
    console.error("❌ Error fetching reviews:", err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;