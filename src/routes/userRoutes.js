const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { protect, restrictTo, branchFilter } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(restrictTo('super_admin', 'admin'), branchFilter, getUsers)
  .post(restrictTo('super_admin', 'admin'), createUser);

// getUser handles its own self/own-branch authorization
router
  .route('/:id')
  .get(getUser)
  .put(restrictTo('super_admin', 'admin'), updateUser)
  .delete(restrictTo('super_admin', 'admin'), deleteUser);

module.exports = router;
