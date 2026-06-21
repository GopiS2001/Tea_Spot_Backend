const express = require('express');
const {
  getInventory,
  getLowStockAlerts,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  stockIn,
  stockOut,
  stockAdjust,
  getStockHistory,
} = require('../controllers/inventoryController');
const { protect, restrictTo, branchFilter } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(branchFilter);

router.get('/', getInventory);
router.get('/alerts', getLowStockAlerts);

router.post('/', restrictTo('super_admin', 'admin'), createInventoryItem);
router.put('/:id', restrictTo('super_admin', 'admin'), updateInventoryItem);
router.delete('/:id', restrictTo('super_admin', 'admin'), deleteInventoryItem);

router.post('/:id/stock-in', restrictTo('super_admin', 'admin'), stockIn);
router.post('/:id/stock-out', restrictTo('super_admin', 'admin'), stockOut);
router.post('/:id/adjust', restrictTo('super_admin', 'admin'), stockAdjust);
router.get('/:id/history', restrictTo('super_admin', 'admin'), getStockHistory);

module.exports = router;
