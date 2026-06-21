const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'staff'],
      default: 'staff',
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ branchId: 1, role: 1 });
userSchema.index({ branchId: 1, active: 1 });

module.exports = mongoose.model('User', userSchema);
