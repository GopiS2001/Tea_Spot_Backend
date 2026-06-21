const express = require('express');
const router = express.Router();
const { protect, branchFilter } = require('../middleware/auth');
const ctrl = require('../controllers/specialOrderController');

router.use(protect);
router.use(branchFilter);

router.get('/', ctrl.getSpecialOrders);
router.post('/', ctrl.createSpecialOrder);
router.put('/:id', ctrl.updateSpecialOrder);
router.put('/:id/status', ctrl.updateStatus);
router.put('/:id/collect-balance', ctrl.collectBalance);
router.delete('/:id', ctrl.deleteSpecialOrder);

module.exports = router;
