const mongoose = require('mongoose');

// Categories are a single shared catalog across all branches (not per-branch).
// Category names are therefore unique globally.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
