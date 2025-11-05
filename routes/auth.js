const express = require('express');
const bcrypt = require('bcryptjs');
const { sendOTPvia2Factor } = require('../utils/sendSMS');
const { sendEmailOTP, sendRegistrationSuccess, sendPasswordResetSuccess } = require('../utils/sendEmail');
const Customer = require('../models/Customer');
const ServiceProvider = require('../models/ServiceProvider');

const router = express.Router();

// 🚫 Prevent browser from caching login/register pages
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Temporary OTP store (replace with Redis or DB in production)
const otpStore = {};

// Home route
router.get('/', (req, res) => {
  res.render('home', { title: 'Home Page', user: req.session.user });
});

// Login GET
router.get('/login', (req, res) => {
  if (req.session.user) {
    const role = req.session.user.role;
    if (role === "customer") return res.redirect("/customer/dashboard");
    if (role === "service_provider") return res.redirect("/provider/dashboard");
  }
  res.render('login');
});


// Login POST
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  let user = await Customer.findOne({ email });
  let role = "customer";

  if (!user) {
    user = await ServiceProvider.findOne({ email });
    role = "service_provider";
  }

  if (user && await bcrypt.compare(password, user.passwordHash)) {
    // store minimal safe user info in session
    req.session.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image || "/uploads/profile/default-profile.jpg",
      role
    };
    req.session.role = role;

    // redirect based on role
    if (role === "customer") return res.redirect("/customer/dashboard");
    if (role === "service_provider") return res.redirect("/provider/dashboard");
    return res.redirect("/");
  }

  const returnUrl = req.query.returnUrl || "/service-provider";
  res.redirect(returnUrl);
  
  // invalid login
  return res.render('login', { error: 'Invalid email or password' });
});

// Registration Step 1: Phone input page
router.get('/reg-phone', (req, res) => {
  if (req.session.user) {
    const role = req.session.user.role;
    if (role === "customer") return res.redirect("/customer/dashboard");
    if (role === "service_provider") return res.redirect("/provider/dashboard");
  }
  res.render('reg-phone');
});

// Send OTP POST
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  const existingCustomer = await Customer.findOne({ phone });
  const existingProvider = await ServiceProvider.findOne({ phone });
  if (existingCustomer || existingProvider) {
    return res.render('reg-phone', { error: 'Phone number already registered' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
otpStore[phone] = otp;

// ✅ Send OTP via 2Factor.in
const sent = await sendOTPvia2Factor(phone, otp);

if (!sent) {
  return res.render('reg-phone', { error: 'Failed to send OTP. Please try again.' });
}

res.render('reg-otp', { phone });
});

// Verify OTP POST
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;

  if (otpStore[phone] && otpStore[phone] === otp) {
    delete otpStore[phone];
    req.session.tempPhone = phone;
    return res.redirect('/reg-role');
  }

  return res.render('reg-otp', { phone, error: 'Invalid OTP' });
});

// Role selection page GET
router.get('/reg-role', (req, res) => {
  if (!req.session.tempPhone) return res.redirect('/reg-phone');
  res.render('reg-role');
});

// Role selection POST
router.post('/reg-role', (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.render('reg-role', { error: 'Please select a role', phone: req.session.tempPhone });
  }

  req.session.role = role;

  if (role === 'customer') {
    return res.redirect('/reg-customer');
  } else if (role === 'service_provider') {
    return res.redirect('/reg-provider');
  } else {
    return res.render('reg-role', { error: 'Invalid role selected', phone: req.session.tempPhone });
  }
});

// Customer registration form GET
router.get('/reg-customer', (req, res) => {
  if (!req.session.tempPhone || req.session.role !== 'customer') return res.redirect('/reg-phone');
  res.render('reg-customer', { phone: req.session.tempPhone, role: 'customer' });
});

// Provider registration form GET
router.get('/reg-provider', (req, res) => {
  if (!req.session.tempPhone || req.session.role !== 'service_provider') return res.redirect('/reg-phone');
  res.render('reg-provider', { phone: req.session.tempPhone, role: 'service_provider' });
});

// Final registration POST
router.post("/register", async (req, res) => {
  const { name, dob, email, password, confirmPassword, role, address, serviceType, phone, gender } = req.body;

  try {
    // ✅ Password match check
    if (password !== confirmPassword) {
      return res.render(role === "customer" ? "reg-customer" : "reg-provider", {
        error: "Passwords do not match. Please re-enter.",
        name, dob, email, role, address, phone, gender
      });
    }

    // ✅ Check if email already exists
    const existingCustomer = await Customer.findOne({ email });
    const existingProvider = await ServiceProvider.findOne({ email });
    if (existingCustomer || existingProvider) {
      return res.render(role === "customer" ? "reg-customer" : "reg-provider", {
        error: "This email is already registered. Please use another email.",
        name, dob, email, role, address, phone, gender
      });
    }

    // ✅ Hash password
    const hash = await bcrypt.hash(password, 10);

    if (role === "customer") {
      const newCustomer = new Customer({
        name, gender, dob, email, phone,
        passwordHash: hash, address
      });
      await newCustomer.save();
      await sendRegistrationSuccess(email, name, "Customer");

    } else if (role === "service_provider") {
      let serviceList = [];
      if (Array.isArray(serviceType)) serviceList = serviceType;
      else if (serviceType) serviceList = [serviceType];

      const selectedServices = {};
      serviceList.forEach(s => {
        selectedServices[s.toLowerCase()] = {
          price: Number(req.body.servicePrice?.[s]) || 0,
          description: req.body.serviceDesc?.[s] || ""
        };
      });

      const newProvider = new ServiceProvider({
        name, gender, dob, email, phone,
        passwordHash: hash, address,
        serviceType: selectedServices
      });

      await newProvider.save();
      await sendRegistrationSuccess(email, name, "Service Provider");
    }

    res.redirect("/login");

  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).send("Server error during registration");
  }
});

// ------------------- EMAIL OTP for Register -------------------

router.post("/send-email-otp", async (req, res) => {
  const { email } = req.body;

  // check if already registered
  const existingCustomer = await Customer.findOne({ email });
  const existingProvider = await ServiceProvider.findOne({ email });
  if (existingCustomer || existingProvider) {
    return res.json({ success: false, error: "Email already registered" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  const sent = await sendEmailOTP(email, otp, "register");
  if (!sent) return res.json({ success: false, error: "Failed to send OTP" });

  res.json({ success: true, message: "OTP sent successfully" });
});

router.post("/verify-email-otp", (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email];
    return res.json({ success: true, message: "Email verified successfully" });
  }

  res.json({ success: false, error: "Invalid or expired OTP" });
});

// Middleware to check login
function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

// Dashboard GET
router.get('/dashboard', isLoggedIn, (req, res) => {
  res.render('customer/dashboard', {
    layout: 'customerDashboardLayout',
    title: 'Dashboard',
    user: req.session.user,
  });
});

// Forgot Password Page
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

// Handle Forgot Password (send OTP)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  let user = await Customer.findOne({ email }) || await ServiceProvider.findOne({ email });

  if (!user) {
    return res.render('forgot-password', { error: 'No account found with this email.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  const sent = await sendEmailOTP(email, otp, "forgot");
  if (!sent) return res.render('forgot-password', { error: 'Failed to send OTP. Try again.' });

  res.render('verify-reset-otp', { email });
});

// Verify OTP
router.post('/verify-reset-otp', (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email];
    req.session.resetEmail = email;
    return res.redirect('/reset-password');
  }

  res.render('verify-reset-otp', { email, error: 'Invalid or expired OTP.' });
});

router.get('/reset-password', (req, res) => {
  if (!req.session.resetEmail) return res.redirect('/login');
  res.render('reset-password');
});

router.post('/reset-password', async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const email = req.session.resetEmail;

  if (!email) return res.redirect('/login');
  if (newPassword !== confirmPassword) {
    return res.render('reset-password', { error: 'Passwords do not match.' });
  }

  const hash = await bcrypt.hash(newPassword, 10);

  let user = await Customer.findOne({ email }) || await ServiceProvider.findOne({ email });
  if (!user) {
    return res.render('reset-password', { error: 'User not found.' });
  }

  user.passwordHash = hash;
  await user.save();
  await sendPasswordResetSuccess(email, user.name);

  delete req.session.resetEmail;

  res.render('login', { success: 'Password reset successfully. Please login with new password.' });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("❌ Error destroying session:", err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;