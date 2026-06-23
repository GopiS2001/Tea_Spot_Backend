const express = require('express');
const router = express.Router();
const { protect, restrictTo, branchFilter } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

router.use(protect);
router.use(restrictTo('super_admin', 'admin'));
router.use(branchFilter);

router.get('/daily', reportController.getDailyReport);
router.get('/employee', reportController.getEmployeeReport);
router.get('/items', reportController.getItemReport);
router.get('/export/:type', reportController.exportReport);

module.exports = router;
