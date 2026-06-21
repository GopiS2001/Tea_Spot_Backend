const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Counting unit used by currentQty/minQty (packet, box, bottle, piece, kg…).
    unit: { type: String, required: true, trim: true },
    type: { type: String, enum: ['raw', 'finished'], default: 'raw' },
    currentQty: { type: Number, default: 0, min: 0 },
    minQty: { type: Number, default: 0, min: 0 }, // alert threshold
    // How much one counting unit actually contains (e.g. 1 packet = 500 ml).
    packSize: { type: Number, default: 1, min: 0 },
    packSizeUnit: {
      type: String,
      enum: ['ml', 'litre', 'g', 'kg', 'piece', 'pack'],
      default: 'piece',
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
  },
  { timestamps: true }
);

// Convenience virtual: total quantity in the base measurement.
// Example: 10 packets × 500 ml packSize → 5000 (ml).
inventoryItemSchema.virtual('totalBaseQty').get(function () {
  return (this.currentQty || 0) * (this.packSize || 0);
});

inventoryItemSchema.set('toJSON', { virtuals: true });
inventoryItemSchema.set('toObject', { virtuals: true });

inventoryItemSchema.index({ branchId: 1 });
inventoryItemSchema.index({ branchId: 1, currentQty: 1, minQty: 1 });
inventoryItemSchema.index({ branchId: 1, type: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
