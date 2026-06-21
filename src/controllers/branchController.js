const Branch = require('../models/Branch');
const Order = require('../models/Order');
const User = require('../models/User');

const getBranches = async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      const branches = await Branch.find().sort({ name: 1 }).lean();
      return res.json({ branches });
    }

    if (!req.user.branchId) {
      return res.json({ branches: [] });
    }

    const branch = await Branch.findById(req.user.branchId).lean();
    res.json({ branches: branch ? [branch] : [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createBranch = async (req, res) => {
  try {
    const { name, city, address, phone } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const branch = await Branch.create({ name, city, address, phone });
    res.status(201).json({ branch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.json({ branch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Soft delete — flip `active` to false.
const deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.json({ branch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBranchStats = async (req, res) => {
  try {
    const branchId = req.params.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayOrders, staffCount] = await Promise.all([
      Order.find({ branchId, createdAt: { $gte: startOfDay } }),
      User.countDocuments({ branchId, active: true }),
    ]);

    const revenueToday = todayOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    res.json({
      branchId,
      ordersToday: todayOrders.length,
      revenueToday,
      staffCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchStats,
};
