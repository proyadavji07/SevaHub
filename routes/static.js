const express = require("express");
const { sendContactMessage } = require("../utils/sendEmail");
const router = express.Router();


// 🏢 About Us
router.get("/about", (req, res) => {
  res.render("static/about", { title: "About Us - SevaHub" });
});

// 📜 Terms & Conditions
router.get("/terms", (req, res) => {
  res.render("static/terms", { title: "Terms & Conditions - SevaHub" });
});

// 📞 Contact Us
router.get("/contact", (req, res) => {
  res.render("static/contact", { title: "Contact Us - SevaHub" });
});

router.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.render("static/contact", { 
      title: "Contact Us - SevaHub", 
      error: "Please fill all fields." 
    });
  }

  const success = await sendContactMessage(name, email, message);

  if (success) {
    res.render("static/contact", { 
      title: "Contact Us - SevaHub", 
      success: "Thank you! We’ve received your message. Our team will contact you soon." 
    });
  } else {
    res.render("static/contact", { 
      title: "Contact Us - SevaHub", 
      error: "Failed to send your message. Please try again later." 
    });
  }
});

module.exports = router;