const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');

// super_admin can address any branch; admin/staff are pinned to their own.
const resolveBranchId = (req) =>
  req.user.role === 'super_admin' ? req.body.branchId : req.user.branchId;

// For per-item operations, ensure the caller can act on this branch's data.
// super_admin sees every branch; admin/staff are confined to their own.
const loadItemForCaller = async (req) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return { error: { status: 404, message: 'Item not found' } };
  if (
    req.user.role !== 'super_admin' &&
    String(item.branchId) !== String(req.user.branchId)
  ) {
    return { error: { status: 403, message: 'Access denied' } };
  }
  return { item };
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getInventory = async (req, res) => {
  try {
    const { search, type } = req.query;
    const filter = { ...(req.branchFilter || {}) };
    if (type && type !== 'all') filter.type = type;
    if (search && search.trim()) {
      filter.name = new RegExp(escapeRegex(search.trim()), 'i');
    }

    const items = await InventoryItem.find(filter).sort({ name: 1 }).lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLowStockAlerts = async (req, res) => {
  try {
    const items = await InventoryItem.find({
      ...(req.branchFilter || {}),
      $expr: { $lte: ['$currentQty', '$minQty'] },
    })
      .sort({ name: 1 })
      .lean();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createInventoryItem = async (req, res) => {
  try {
    const { name, unit, type, currentQty, minQty, packSize, packSizeUnit } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ message: 'name and unit are required' });
    }

    const assignedBranch = resolveBranchId(req);
    if (!assignedBranch) {
      return res.status(400).json({ message: 'branchId is required' });
    }

    const openingQty = Number(currentQty) || 0;
    const item = await InventoryItem.create({
      name,
      unit,
      type: type || 'raw',
      currentQty: openingQty,
      minQty: Number(minQty) || 0,
      packSize: packSize !== undefined ? Number(packSize) || 0 : 1,
      packSizeUnit: packSizeUnit || 'piece',
      branchId: assignedBranch,
    });

    // Log the opening stock so the history reflects how the item arrived.
    if (openingQty > 0) {
      await StockTransaction.create({
        stockItemId: item._id,
        type: 'in',
        qty: openingQty,
        reason: 'initial stock',
        branchId: assignedBranch,
        employeeId: req.user.id,
      });
    }

    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Only metadata fields (name/unit/minQty) — quantity changes go through the
// stock-in/out/adjust endpoints so every change is auditable.
const updateInventoryItem = async (req, res) => {
  try {
    const { error } = await loadItemForCaller(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const { name, unit, minQty, type, packSize, packSizeUnit } = req.body;
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (unit !== undefined) payload.unit = unit;
    if (type !== undefined) payload.type = type;
    if (minQty !== undefined) payload.minQty = Number(minQty) || 0;
    if (packSize !== undefined) payload.packSize = Number(packSize) || 0;
    if (packSizeUnit !== undefined) payload.packSizeUnit = packSizeUnit;

    const item = await InventoryItem.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteInventoryItem = async (req, res) => {
  try {
    const { error } = await loadItemForCaller(req);
    if (error) return res.status(error.status).json({ message: error.message });

    await InventoryItem.findByIdAndDelete(req.params.id);
    // Transactions are kept for audit history.
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Stock IN — receive a purchase, top up after a delivery.
const stockIn = async (req, res) => {
  try {
    const { qty, reason } = req.body;
    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'Valid qty required' });
    }

    const { item, error } = await loadItemForCaller(req);
    if (error) return res.status(error.status).json({ message: error.message });

    item.currentQty += Number(qty);
    await item.save();

    await StockTransaction.create({
      stockItemId: item._id,
      type: 'in',
      qty: Number(qty),
      reason: reason || 'purchase',
      branchId: item.branchId,
      employeeId: req.user.id,
    });

    res.json({ item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Stock OUT — waste, spillage, expired, manual deduction.
const stockOut = async (req, res) => {
  try {
    const { qty, reason } = req.body;
    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'Valid qty required' });
    }

    const { item, error } = await loadItemForCaller(req);
    if (error) return res.status(error.status).json({ message: error.message });

    item.currentQty = Math.max(0, item.currentQty - Number(qty));
    await item.save();

    await StockTransaction.create({
      stockItemId: item._id,
      type: 'out',
      qty: Number(qty),
      reason: reason || 'waste',
      branchId: item.branchId,
      employeeId: req.user.id,
    });

    res.json({ item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Adjust — set the current qty to an exact number (manual recount).
// The recorded `qty` is the delta so the audit log shows the direction.
const stockAdjust = async (req, res) => {
  try {
    const { newQty, reason } = req.body;
    if (newQty === undefined || newQty === null || Number(newQty) < 0) {
      return res.status(400).json({ message: 'Valid newQty required' });
    }

    const { item, error } = await loadItemForCaller(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const target = Number(newQty);
    const diff = target - item.currentQty;
    item.currentQty = target;
    await item.save();

    await StockTransaction.create({
      stockItemId: item._id,
      type: 'adjust',
      qty: diff,
      reason: reason || 'manual count correction',
      branchId: item.branchId,
      employeeId: req.user.id,
    });

    res.json({ item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStockHistory = async (req, res) => {
  try {
    const { error } = await loadItemForCaller(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const { page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { stockItemId: req.params.id };

    const [transactions, total] = await Promise.all([
      StockTransaction.find(filter)
        .populate('employeeId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      StockTransaction.countDocuments(filter),
    ]);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getInventory,
  getLowStockAlerts,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  stockIn,
  stockOut,
  stockAdjust,
  getStockHistory,
};
