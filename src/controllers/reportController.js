const Order = require('../models/Order');

function getDateRange(req) {
  const { startDate, endDate, range } = req.query;
  let start, end;

  if (range === 'week') {
    start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  } else if (range === 'month') {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  } else if (startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    // default / range === 'today'
    start = new Date();
    start.setHours(0, 0, 0, 0);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

const getDailyReport = async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const filter = { ...req.branchFilter, createdAt: { $gte: start, $lte: end } };

    const orders = await Order.find(filter).lean();
    const completed = orders.filter((o) => o.status === 'completed');
    const cancelled = orders.filter((o) => o.status === 'cancelled');

    const totalRevenue = completed.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const cashTotal = completed
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const upiTotal = completed
      .filter((o) => o.paymentMethod === 'upi')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const dineIn = completed.filter((o) => o.orderType === 'dine-in');
    const takeaway = completed.filter((o) => o.orderType === 'takeaway');

    const dayMap = {};
    completed.forEach((o) => {
      const key = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dayMap[key]) dayMap[key] = { date: key, revenue: 0, bills: 0 };
      dayMap[key].revenue += o.totalAmount || 0;
      dayMap[key].bills += 1;
    });

    res.json({
      summary: {
        totalRevenue,
        totalBills: completed.length,
        cancelledCount: cancelled.length,
        cashTotal,
        upiTotal,
        avgBillValue: completed.length ? Math.round(totalRevenue / completed.length) : 0,
        dineInCount: dineIn.length,
        dineInRevenue: dineIn.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        takeawayCount: takeaway.length,
        takeawayRevenue: takeaway.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
      dailyBreakdown: Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getEmployeeReport = async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const filter = { ...req.branchFilter, createdAt: { $gte: start, $lte: end }, status: 'completed' };

    const orders = await Order.find(filter).select('staff totalAmount').lean();

    const empMap = {};
    orders.forEach((o) => {
      const name = o.staff || 'Unknown';
      if (!empMap[name]) empMap[name] = { name, bills: 0, revenue: 0 };
      empMap[name].bills += 1;
      empMap[name].revenue += o.totalAmount || 0;
    });

    const employees = Object.values(empMap)
      .map((e) => ({ ...e, avgBillValue: e.bills ? Math.round(e.revenue / e.bills) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({ employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemReport = async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const filter = { ...req.branchFilter, createdAt: { $gte: start, $lte: end }, status: 'completed' };

    const orders = await Order.find(filter).select('items').lean();

    const itemMap = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.name + (item.variantName ? ` (${item.variantName})` : '');
        if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 };
        itemMap[key].qty += item.qty;
        itemMap[key].revenue += item.subtotal;
      });
    });

    const items = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function toCsvField(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const exportReport = async (req, res) => {
  try {
    const { type } = req.params; // 'daily' | 'employee' | 'item'
    const { start, end } = getDateRange(req);
    const filter = { ...req.branchFilter, createdAt: { $gte: start, $lte: end }, status: 'completed' };

    let csv = '';
    if (type === 'daily') {
      const orders = await Order.find(filter).lean();
      csv = 'Bill No,Date,Type,Payment,Amount\n';
      orders.forEach((o) => {
        csv += [
          o.orderNumber,
          new Date(o.createdAt).toLocaleString(),
          o.orderType,
          o.paymentMethod,
          o.totalAmount,
        ]
          .map(toCsvField)
          .join(',') + '\n';
      });
    } else if (type === 'employee') {
      const orders = await Order.find(filter).select('staff totalAmount').lean();
      const empMap = {};
      orders.forEach((o) => {
        const name = o.staff || 'Unknown';
        if (!empMap[name]) empMap[name] = { bills: 0, revenue: 0 };
        empMap[name].bills += 1;
        empMap[name].revenue += o.totalAmount || 0;
      });
      csv = 'Employee,Bills,Revenue\n';
      Object.entries(empMap).forEach(([name, d]) => {
        csv += [name, d.bills, d.revenue].map(toCsvField).join(',') + '\n';
      });
    } else if (type === 'item') {
      const orders = await Order.find(filter).select('items').lean();
      const itemMap = {};
      orders.forEach((order) => {
        order.items.forEach((item) => {
          const key = item.name + (item.variantName ? ` (${item.variantName})` : '');
          if (!itemMap[key]) itemMap[key] = { qty: 0, revenue: 0 };
          itemMap[key].qty += item.qty;
          itemMap[key].revenue += item.subtotal;
        });
      });
      csv = 'Item,Qty Sold,Revenue\n';
      Object.entries(itemMap).forEach(([name, d]) => {
        csv += [name, d.qty, d.revenue].map(toCsvField).join(',') + '\n';
      });
    } else {
      return res.status(400).json({ message: 'Invalid report type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDailyReport, getEmployeeReport, getItemReport, exportReport };
