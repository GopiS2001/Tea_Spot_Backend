const express = require('express');
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Menu is a shared catalog across all branches — no branch scoping.
router.use(protect);

router.route('/').get(getMenuItems).post(createMenuItem);
router.route('/:id').get(getMenuItem).put(updateMenuItem).delete(deleteMenuItem);

module.exports = router;
