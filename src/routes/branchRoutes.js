const express = require('express');
const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchStats,
} = require('../controllers/branchController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getBranches);
router.get('/:id/stats', restrictTo('super_admin'), getBranchStats);
router.post('/', restrictTo('super_admin'), createBranch);
router.put('/:id', restrictTo('super_admin'), updateBranch);
router.delete('/:id', restrictTo('super_admin'), deleteBranch);

module.exports = router;
