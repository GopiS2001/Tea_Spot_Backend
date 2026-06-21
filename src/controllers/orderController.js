const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');

const TYPE_CODE = { 'dine-in': 'DI', takeaway: 'TA' };

// Bill number format: {seq}{DI|TA}{DDMMYY} e.g. 01TA200626.
// Sequence is per branch + order type + calendar day, continuing from the
// previous bill of that type today (starts at 01 each day).
//
// Only *finalised* orders (status !== 'pending') get a real bill number.
// Parked/pending orders are drafts — they're shown by id and deleted when
// resumed — so they get a temporary number instead. Otherwise every
// park+resume cycle would burn a bill number and leave gaps (e.g. dine-in
// starting at 02 instead of 01).
const generateOrderNumber = async (branchId, orderType, status) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(
    now.getFullYear()
  ).slice(-2)}`;
  const typeCode = TYPE_CODE[orderType] || 'XX';

  // Draft (parked) order → temporary, non-bill number.
  if (status === 'pending') {
    return `PK${typeCode}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Continue from the latest *bill-format* order of this type today (those
  // whose number starts with a digit); drafts (PK…) are ignored.
  const last = await Order.findOne({
    branchId,
    orderType,
    createdAt: { $gte: startOfDay },
    orderNumber: { $regex: '^[0-9]' },
  })
    .sort({ createdAt: -1 })
    .select('orderNumber')
    .lean();

  let nextSeq = 1;
  if (last && last.orderNumber) {
    const match = last.orderNumber.match(/^(\d+)/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }

  return `${pad(nextSeq)}${typeCode}${datePart}`;
};

// super_admin must specify a branch on writes (via body or the ?branchId=
// query that the frontend appends from the Topbar selection); admin/staff
// always use their own branch.
const resolveBranchId = (req) =>
  req.user.role === 'super_admin'
    ? req.body.branchId || req.query.branchId
    : req.user.branchId;

const ORDER_TYPES = ['dine-in', 'takeaway'];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getOrders = async (req, res) => {
  try {
    const { status, search, paymentMethod, orderType, startDate, endDate, page, limit } =
      req.query;

    const filter = { ...(req.branchFilter || {}) };
    if (status && status !== 'all') filter.status = status;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
    if (orderType && orderType !== 'all') filter.orderType = orderType;

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ orderNumber: regex }, { staff: regex }];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Backward-compatible: without pagination params, return the plain array
    // (used by ParkedOrdersPanel and any other simple consumers).
    if (page === undefined && limit === undefined) {
      const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
      return res.json(orders);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Summary stats ignore search/status/payment/date filters (so the dashboard
    // cards stay stable while paging/searching) but stay scoped to the branch.
    const statsMatch = { ...(req.branchFilter || {}) };

    const [orders, total, statsAgg] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: statsMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            refunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] },
            },
          },
        },
      ]),
    ]);

    const stats = statsAgg[0] || {
      totalOrders: 0,
      completed: 0,
      refunded: 0,
      totalRevenue: 0,
    };
    delete stats._id;

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      stats,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) {
      return res
        .status(400)
        .json({ message: 'branchId is required (super_admin must pick a branch)' });
    }

    const { orderType } = req.body;
    if (!orderType || !ORDER_TYPES.includes(orderType)) {
      return res
        .status(400)
        .json({ message: `orderType is required and must be one of: ${ORDER_TYPES.join(', ')}` });
    }

    const orderNumber =
      req.body.orderNumber ||
      (await generateOrderNumber(branchId, orderType, req.body.status));

    // Store a human-readable staff name (not the raw user id) for the orders
    // list and receipts. Falls back to an explicit body value or the id.
    let staffName = req.body.staff;
    if (!staffName) {
      const staffUser = await User.findById(req.user.id).select('name').lean();
      staffName = staffUser ? staffUser.name : req.user.id;
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const items = [];

    for (const item of rawItems) {
      const menuItem = item.menuItem ? await MenuItem.findById(item.menuItem) : null;

      // Items not linked to a menu item (e.g. ad-hoc lines) pass through untouched.
      if (!menuItem) {
        items.push(item);
        continue;
      }

      const qty = Number(item.qty) || 1;

      if (menuItem.hasVariants) {
        if (!item.variantId) {
          return res
            .status(400)
            .json({ message: `Please select a size for ${menuItem.name}` });
        }
        const variant = menuItem.variants.id(item.variantId);
        if (!variant) {
          return res
            .status(400)
            .json({ message: `Invalid variant selected for ${menuItem.name}` });
        }
        items.push({
          menuItem: menuItem._id,
          name: menuItem.name,
          qty,
          price: variant.price, // enforce server-side price
          subtotal: variant.price * qty,
          variantId: variant._id,
          variantName: variant.name,
        });
      } else {
        items.push({
          menuItem: menuItem._id,
          name: menuItem.name,
          qty,
          price: menuItem.price,
          subtotal: menuItem.price * qty,
          variantId: null,
          variantName: null,
        });
      }
    }

    // Server is authoritative for subtotal/total; tax & discount come from client.
    const subtotal = items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
    const tax = Number(req.body.tax) || 0;
    const discount = Number(req.body.discount) || 0;
    const totalAmount = subtotal + tax - discount;

    const order = await Order.create({
      ...req.body,
      branchId,
      orderNumber,
      orderType,
      items,
      subtotal,
      totalAmount,
      staff: staffName,
    });

    if (order.status === 'completed') {
      await Promise.all(
        order.items
          .filter((item) => item.menuItem)
          .map((item) =>
            MenuItem.findByIdAndUpdate(item.menuItem, { $inc: { sales: item.qty } })
          )
      );
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
};
