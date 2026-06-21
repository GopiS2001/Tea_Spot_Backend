const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantName: { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    orderNumber: { type: String, required: true },
    orderType: {
      type: String,
      enum: ['dine-in', 'takeaway'],
      required: true,
      default: 'takeaway',
    },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    staff: { type: String, default: '' },
  },
  { timestamps: true }
);

orderSchema.index({ branchId: 1 });
orderSchema.index({ branchId: 1, createdAt: -1 });
orderSchema.index({ branchId: 1, status: 1, createdAt: -1 });
orderSchema.index({ branchId: 1, orderType: 1 });
// Bill numbers (e.g. 01TA200626) are sequenced per branch, so uniqueness is
// scoped to the branch — two outlets can each have their own 01TA200626.
orderSchema.index({ branchId: 1, orderNumber: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
