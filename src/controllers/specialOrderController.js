const SpecialOrder = require('../models/SpecialOrder');

const getSpecialOrders = async (req, res) => {
  try {
    const filter = { ...(req.branchFilter || {}) };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus === 'pending') filter.balanceCollected = false;
    if (req.query.paymentStatus === 'paid') filter.balanceCollected = true;

    if (req.query.upcoming === 'true') {
      filter.deliveryDate = { $gte: new Date() };
      filter.status = { $nin: ['delivered', 'cancelled'] };
    }

    if (req.query.today === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.deliveryDate = { $gte: start, $lt: end };
    }

    const orders = await SpecialOrder.find(filter).sort({ deliveryDate: 1 }).lean();
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSpecialOrder = async (req, res) => {
  try {
    const branchId =
      req.user.role === 'super_admin' ? req.body.branchId : req.user.branchId;
    if (!branchId) return res.status(400).json({ message: 'branchId required' });

    const order = new SpecialOrder({
      ...req.body,
      branchId,
      createdBy: req.user.id,
    });
    await order.save(); // triggers pre-save balance calculation
    res.status(201).json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSpecialOrder = async (req, res) => {
  try {
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });

    // Don't let branch/creator be reassigned via a generic update.
    const { branchId, createdBy, ...rest } = req.body;
    Object.assign(order, rest);
    await order.save(); // triggers balanceAmount + balanceCollected recalculation
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await SpecialOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Dedicated endpoint — mark the remaining balance as collected.
const collectBalance = async (req, res) => {
  try {
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });

    order.advancePaid = order.totalAmount; // fully paid now
    order.balanceCollected = true;
    order.balanceCollectedAt = new Date();
    await order.save();

    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSpecialOrder = async (req, res) => {
  try {
    const order = await SpecialOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSpecialOrders,
  createSpecialOrder,
  updateSpecialOrder,
  updateStatus,
  collectBalance,
  deleteSpecialOrder,
};
