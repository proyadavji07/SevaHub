const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmailOTP(email, otp, purpose) {
  const subject = purpose === "register"
    ? "SevaHub Email Verification OTP"
    : "SevaHub Password Reset OTP";

  const html = `
    <div style="font-family: Arial; padding: 10px; border: 1px solid #ddd;">
      <h2>🔐 ${subject}</h2>
      <p>Hello,</p>
      <p>Your OTP for ${purpose === "register" ? "email verification" : "password reset"} is:</p>
      <h3 style="color: #007bff;">${otp}</h3>
      <p>This OTP is valid for 5 minutes. Do not share it with anyone.</p>
      <p>Regards,<br>Team SevaHub</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SevaHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html
    });
    console.log(`✅ OTP sent to ${email}`);
    return true;
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    return false;
  }
}

async function sendRegistrationSuccess(email, name, role) {
  try {
    const subject = "🎉 Welcome to SevaHub!";
    const html = `
      <div style="font-family: Arial, sans-serif; color:#333;">
        <h2 style="color:#007bff;">Welcome, ${name}!</h2>
        <p>Thank you for registering as a <b>${role.replace('_', ' ')}</b> on <b>SevaHub</b>.</p>
        <p>Your account has been successfully created. You can now log in and start using our services.</p>
        <p style="margin-top:15px; font-size:12px; color:#777;">
          If you didn’t register this account, please contact us immediately.
        </p>
        <br/>
        <p>Best regards,</p>
        <p><b>SevaHub Team</b></p>
      </div>
    `;

    await transporter.sendMail({
      from: `"SevaHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
    });

    console.log(`✅ Registration confirmation email sent to ${email}`);
  } catch (err) {
    console.error("❌ Failed to send registration confirmation email:", err);
  }
}

async function sendPasswordResetSuccess(email, name) {
  try {
    const subject = "🔒 Your SevaHub Password Has Been Reset";
    const html = `
      <div style="font-family: Arial, sans-serif; color:#333;">
        <h2 style="color:#007bff;">Password Reset Successful</h2>
        <p>Hello ${name || "User"},</p>
        <p>This is to confirm that your <b>SevaHub</b> account password has been successfully reset.</p>
        <p>If you did not make this change, please contact us immediately to secure your account.</p>
        <br/>
        <br/><br/>
        <p>Best regards,</p>
        <p><b>SevaHub Team</b></p>
      </div>
    `;

    await transporter.sendMail({
      from: `"SevaHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
    });

    console.log(`✅ Password reset confirmation email sent to ${email}`);
  } catch (err) {
    console.error("❌ Failed to send password reset confirmation email:", err);
  }
}

async function sendPaymentEmails(customer, provider, order) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 💌 Email to Customer
    const customerMail = {
      from: `"SevaHub" <${process.env.EMAIL_USER}>`,
      to: customer.email,
      subject: "Payment Successful - SevaHub",
      html: `
        <h2>✅ Payment Confirmation</h2>
        <p>Dear <strong>${customer.name}</strong>,</p>
        <p>Your payment for <strong>${order.service}</strong> (₹${order.totalAmount}) has been successfully processed.</p>
        <p>Payment Method: ${order.paymentMethod}</p>
        <p>Service Provider: <strong>${provider.name}</strong></p>
        <p>We’ll notify you once the provider confirms your booking.</p>
        <br>
        <p>Thank you for using <strong>SevaHub</strong>!</p>
      `,
    };

    // 💌 Email to Service Provider
    const providerMail = {
      from: `"SevaHub" <${process.env.EMAIL_USER}>`,
      to: provider.email,
      subject: "New Paid Order Received - SevaHub",
      html: `
        <h2>📦 New Paid Booking</h2>
        <p>Dear <strong>${provider.name}</strong>,</p>
        <p>You’ve received a new booking from <strong>${customer.name}</strong>.</p>
        <ul>
          <li>Service: <strong>${order.service}</strong></li>
          <li>Amount: ₹${order.totalAmount}</li>
          <li>Payment Method: ${order.paymentMethod}</li>
        </ul>
        <p>Please confirm the booking at your earliest convenience.</p>
        <br>
        <p>– The SevaHub Team</p>
      `,
    };

    await transporter.sendMail(customerMail);
    await transporter.sendMail(providerMail);

    console.log(`📧 Payment emails sent to ${customer.email} and ${provider.email}`);
  } catch (err) {
    console.error("❌ Error sending payment emails:", err);
  }
}

async function sendContactMessage(name, email, message) {
  try {
    const subject = `📩 New Contact Message from ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color:#333;">
        <h2>New Contact Form Message</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b></p>
        <p>${message}</p>
        <br/>
        <p style="font-size:12px;color:#777;">Sent from SevaHub Contact Form</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.EMAIL_USER,
      subject,
      html
    });

    console.log(`✅ Contact form message received from ${name} (${email})`);
    return true;
  } catch (err) {
    console.error("❌ Failed to send contact message:", err);
    return false;
  }
}

module.exports = { sendEmailOTP, sendRegistrationSuccess, sendPasswordResetSuccess, sendPaymentEmails, sendContactMessage };