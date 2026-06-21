const mongoose = require('mongoose');

const specialOrderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    items: [
      {
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        name: String,
        qty: Number,
        price: Number,
        subtotal: Number,
        variantName: { type: String, default: null },
      },
    ],
    totalAmount: { type: Number, required: true },
    advancePaid: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 }, // auto: totalAmount - advancePaid
    balanceCollected: { type: Boolean, default: false }, // has the remaining balance been paid
    balanceCollectedAt: { type: Date, default: null },
    deliveryDate: { type: Date, required: true },
    deliveryTime: { type: String, required: true }, // e.g. "07:00 AM"
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'ready', 'delivered', 'cancelled'],
      default: 'pending',
    },
    notes: { type: String },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Auto-calculate balance and auto-flag fully-paid orders.
specialOrderSchema.pre('save', function (next) {
  this.balanceAmount = this.totalAmount - this.advancePaid;
  if (this.balanceAmount <= 0) {
    this.balanceAmount = 0;
    this.balanceCollected = true;
    if (!this.balanceCollectedAt) this.balanceCollectedAt = new Date();
  }
  next();
});

specialOrderSchema.index({ branchId: 1, deliveryDate: 1 });
specialOrderSchema.index({ branchId: 1, status: 1 });
specialOrderSchema.index({ branchId: 1, balanceCollected: 1 });

module.exports = mongoose.model('SpecialOrder', specialOrderSchema);
