const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['super_admin', 'admin', 'staff'],
      unique: true,
      required: true,
    },
    permissions: {
      dashboard: { type: Boolean, default: false },
      pos: { type: Boolean, default: false },
      orders: { type: Boolean, default: false },
      menu: { type: Boolean, default: false },
      categories: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      users: { type: Boolean, default: false },
      roles: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
      specialOrders: { type: Boolean, default: false },
      branches: { type: Boolean, default: false },
      settings: { type: Boolean, default: false },
      profile: { type: Boolean, default: true },
      help: { type: Boolean, default: true },
    },
    // super_admin role → isEditable: false
    isEditable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
