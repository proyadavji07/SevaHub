const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  name: { type: String, trim: true, required: true },
  gender: { type: String, enum: ["Male", "Female"], required: true },
  dob: { type: Date, required: true },
  email: { type: String, lowercase: true, trim: true, required: true, unique: true },
  passwordHash: { type: String, required: true },
  image: {
    type: String,
    default: "/uploads/profile/default-profile.jpg"  // default avatar
  },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
  cart: [
    {
      serviceProviderId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceProvider" },
      providerName: String,
      serviceName: String,
      price: Number,
      description: String,
      addedAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("Customer", customerSchema);
