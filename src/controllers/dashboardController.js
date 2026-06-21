const Order = require('../models/Order');
const InventoryItem = require('../models/InventoryItem');
const SpecialOrder = require('../models/SpecialOrder');
const Branch = require('../models/Branch');
const User = require('../models/User');

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Scope: super_admin with no ?branchId = ALL branches combined.
//        super_admin with ?branchId, or admin = a single branch (req.branchFilter).
const getDashboard = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const isAllBranches = req.user.role === 'super_admin' && !req.query.branchId;

    const filter = { ...req.branchFilter, createdAt: { $gte: start, $lte: end } };

    const [todayOrders, lowStockItems, upcomingSpecialOrders, pendingBalanceCount, branches] =
      await Promise.all([
        Order.find(filter).lean(),
        InventoryItem.find({
          ...req.branchFilter,
          $expr: { $lte: ['$currentQty', '$minQty'] },
        }).lean(),
        SpecialOrder.find({
          ...req.branchFilter,
          deliveryDate: { $gte: new Date() },
          status: { $nin: ['delivered', 'cancelled'] },
        })
          .sort({ deliveryDate: 1 })
          .limit(5)
          .lean(),
        SpecialOrder.countDocuments({ ...req.branchFilter, balanceCollected: false }),
        isAllBranches ? Branch.find({ active: true }).lean() : [],
      ]);

    const completedOrders = todayOrders.filter((o) => o.status === 'completed');
    const cancelledOrders = todayOrders.filter((o) => o.status === 'cancelled');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const cashRevenue = completedOrders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const upiRevenue = completedOrders
      .filter((o) => o.paymentMethod === 'upi')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const dineInOrders = completedOrders.filter((o) => o.orderType === 'dine-in');
    const takeawayOrders = completedOrders.filter((o) => o.orderType === 'takeaway');
    const avgBillValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    let branchBreakdown = [];
    if (isAllBranches) {
      branchBreakdown = await Promise.all(
        branches.map(async (branch) => {
          const branchOrders = await Order.find({
            branchId: branch._id,
            createdAt: { $gte: start, $lte: end },
            status: 'completed',
          }).lean();
          const branchRevenue = branchOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const staffCount = await User.countDocuments({ branchId: branch._id, active: true });

          return {
            branchId: branch._id,
            branchName: branch.name,
            city: branch.city,
            ordersToday: branchOrders.length,
            revenueToday: branchRevenue,
            staffCount,
          };
        })
      );
    }

    res.json({
      scope: isAllBranches ? 'all-branches' : 'single-branch',
      today: {
        totalRevenue,
        cashRevenue,
        upiRevenue,
        totalBills: completedOrders.length,
        cancelledCount: cancelledOrders.length,
        avgBillValue: Math.round(avgBillValue),
        dineInCount: dineInOrders.length,
        dineInRevenue: dineInOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        takeawayCount: takeawayOrders.length,
        takeawayRevenue: takeawayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
      lowStock: {
        count: lowStockItems.length,
        items: lowStockItems.slice(0, 5).map((i) => ({
          name: i.name,
          currentQty: i.currentQty,
          minQty: i.minQty,
          unit: i.unit,
        })),
      },
      specialOrders: {
        upcomingCount: upcomingSpecialOrders.length,
        pendingBalanceCount,
        upcoming: upcomingSpecialOrders.map((o) => ({
          _id: o._id,
          customerName: o.customerName,
          deliveryDate: o.deliveryDate,
          deliveryTime: o.deliveryTime,
          totalAmount: o.totalAmount,
          balanceCollected: o.balanceCollected,
        })),
      },
      branchBreakdown,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Last 7 days' revenue, for the trend chart.
const getWeeklyTrend = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      ...req.branchFilter,
      status: 'completed',
      createdAt: { $gte: sevenDaysAgo },
    })
      .select('createdAt totalAmount')
      .lean();

    const dayMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { date: key, revenue: 0, bills: 0 };
    }

    orders.forEach((o) => {
      const key = new Date(o.createdAt).toISOString().split('T')[0];
      if (dayMap[key]) {
        dayMap[key].revenue += o.totalAmount || 0;
        dayMap[key].bills += 1;
      }
    });

    res.json({ trend: Object.values(dayMap) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Top 5 selling items today, aggregated across completed orders.
const getTopItems = async (req, res) => {
  try {
    const { start, end } = getTodayRange();
    const orders = await Order.find({
      ...req.branchFilter,
      status: 'completed',
      createdAt: { $gte: start, $lte: end },
    })
      .select('items')
      .lean();

    const itemMap = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.name + (item.variantName ? ` (${item.variantName})` : '');
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 };
        itemMap[key].qty += item.qty;
        itemMap[key].revenue += item.subtotal;
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json({ topItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDashboard, getWeeklyTrend, getTopItems };
