const mongoose = require('mongoose');

// Per-branch settings for a tea shop — only what's actually needed.
const settingsSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

    // General
    shopName: { type: String, default: 'Tea Spot' },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    operatingHours: [
      {
        day: String, // "Monday", "Tuesday", etc
        enabled: { type: Boolean, default: true },
        openTime: { type: String, default: '09:00 AM' },
        closeTime: { type: String, default: '10:00 PM' },
      },
    ],
    acceptCash: { type: Boolean, default: true },
    acceptUpi: { type: Boolean, default: true },

    // Tax
    taxName: { type: String, default: 'GST' },
    taxRate: { type: Number, default: 0 },
    taxNumber: { type: String },
    applyTaxToAllItems: { type: Boolean, default: false },

    // Printer
    printerName: { type: String, default: '' },
    printerIp: { type: String, default: '' },
    printerPort: { type: String, default: '9100' },
  },
  { timestamps: true }
);

settingsSchema.index({ branchId: 1 }, { unique: true });

module.exports = mongoose.model('Settings', settingsSchema);
