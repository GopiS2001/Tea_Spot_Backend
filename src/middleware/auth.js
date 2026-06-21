const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load role/branch fresh from the DB so permission changes take effect
    // immediately, without forcing the user to log in again.
    const user = await User.findById(decoded.id).select('role branchId active');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    if (user.active === false) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      branchId: user.branchId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Scopes list queries to the caller's branch.
// - super_admin sees everything by default, but may pass ?branchId=... to narrow.
// - admin and staff are always locked to their own branch.
const branchFilter = (req, res, next) => {
  if (!req.user) {
    req.branchFilter = {};
    return next();
  }

  if (req.user.role === 'super_admin') {
    req.branchFilter = req.query.branchId
      ? { branchId: req.query.branchId }
      : {};
  } else if (req.user.branchId) {
    req.branchFilter = { branchId: req.user.branchId };
  } else {
    req.branchFilter = {};
  }
  next();
};

module.exports = { protect, restrictTo, branchFilter };
