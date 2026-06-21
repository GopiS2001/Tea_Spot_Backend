const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

branchSchema.index({ active: 1 });

module.exports = mongoose.model('Branch', branchSchema);
