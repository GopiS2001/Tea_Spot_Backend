const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
} = require('../controllers/orderController');
const { protect, branchFilter } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(branchFilter);

router.route('/').get(getOrders).post(createOrder);
router.route('/:id').get(getOrder).put(updateOrder).delete(deleteOrder);

module.exports = router;
