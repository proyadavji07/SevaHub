const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
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
  serviceType: {
    type: Map,
    of: new mongoose.Schema({
      price: { type: Number, required: true },
      description: { type: String }
    }),
    required: true
  },
  address: { type: String },
  createdAt: { type: Date, default: Date.now }
});

serviceProviderSchema.pre("save", function (next) {
  if (this.serviceType && this.serviceType instanceof Map) {
    const normalized = new Map();
    this.serviceType.forEach((value, key) => {
      normalized.set(key.toLowerCase(), value);
    });
    this.serviceType = normalized;
  }
  next();
});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
