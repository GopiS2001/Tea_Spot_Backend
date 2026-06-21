const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    stockItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    type: {
      type: String,
      enum: ['in', 'out', 'adjust'],
      required: true,
    },
    qty: { type: Number, required: true },
    reason: { type: String, trim: true, default: '' },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ branchId: 1, createdAt: -1 });
stockTransactionSchema.index({ stockItemId: 1, createdAt: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
