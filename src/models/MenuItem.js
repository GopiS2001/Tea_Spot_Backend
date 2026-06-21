const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Small", "Medium", "Large", etc.
    price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

// Menu items form a single shared catalog across all branches (not per-branch).
const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    price: { type: Number, default: 0, min: 0 }, // base price; used when hasVariants = false
    hasVariants: { type: Boolean, default: false },
    variants: { type: [variantSchema], default: [] },
    cost: { type: Number, default: 0, min: 0 },
    sku: { type: String, trim: true },
    tax: { type: Number, default: 0, min: 0 },
    image: { type: String, default: '🍽️' },
    description: { type: String, default: '' },
    allergens: { type: [String], default: [] },
    qty: { type: Number, default: 0, min: 0 },
    sales: { type: Number, default: 0, min: 0 },
    kitchen_display: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

menuItemSchema.index({ category_id: 1 });
menuItemSchema.index({ status: 1 });
menuItemSchema.index({ name: 'text' });

module.exports = mongoose.model('MenuItem', menuItemSchema);
