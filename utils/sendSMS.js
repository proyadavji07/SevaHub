const axios = require("axios");

async function sendOTPvia2Factor(phone, otp) {
  try {
    const apiKey = process.env.TWO_FACTOR_API_KEY;

    // ✅ Ensure phone number starts with country code
    const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

    // ✅ Use Template-based SMS API endpoint
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${formattedPhone}/${otp}/SevaHub_OTP`;

    const response = await axios.get(url);

    if (response.data.Status === "Success") {
      console.log(`✅ SMS OTP sent successfully to ${formattedPhone}`);
      return true;
    } else {
      console.error("❌ 2Factor Error:", response.data);
      return false;
    }
  } catch (err) {
    console.error("❌ Error sending OTP via 2Factor:", err.message);
    return false;
  }
}

module.exports = { sendOTPvia2Factor };
