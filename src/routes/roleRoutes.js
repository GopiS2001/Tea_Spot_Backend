const express = require('express');
const { getRoles, getRole, updateRole } = require('../controllers/roleController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// All authenticated users can read roles (frontend needs them to know what to show)
router.get('/', getRoles);
router.get('/:roleName', getRole);

// Only super_admin can update role permissions
router.put('/:roleName', restrictTo('super_admin'), updateRole);

module.exports = router;
