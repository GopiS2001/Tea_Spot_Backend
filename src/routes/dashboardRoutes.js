const express = require('express');
const router = express.Router();
const { protect, restrictTo, branchFilter } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.use(protect);
router.use(restrictTo('super_admin', 'admin'));
router.use(branchFilter);

router.get('/', dashboardController.getDashboard);
router.get('/weekly-trend', dashboardController.getWeeklyTrend);
router.get('/top-items', dashboardController.getTopItems);

module.exports = router;
