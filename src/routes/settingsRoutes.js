const express = require('express');
const router = express.Router();
const { protect, restrictTo, branchFilter } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

router.use(protect);
router.use(branchFilter);

router.get('/', getSettings);
// Only super_admin / admin can change settings — not staff.
router.put('/', restrictTo('super_admin', 'admin'), updateSettings);

module.exports = router;
