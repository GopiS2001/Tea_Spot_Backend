const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');

// Only populate the branch when the Branch model is registered (separate module).
const withBranch = (query) =>
  mongoose.models.Branch ? query.populate('branchId', 'name city') : query;

const sameBranch = (a, b) => a && b && a.toString() === b.toString();

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/users — super_admin sees all, admin sees own branch (via branchFilter)
// Supports ?search= (name/email) and ?role= filters, applied server-side.
const getUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter = { ...(req.branchFilter || {}) };

    if (role && role !== 'all') filter.role = role;

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const users = await withBranch(User.find(filter).select('-password'))
      .sort({ createdAt: -1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/users/:id — own profile for anyone; other users for admin/super_admin only
const getUser = async (req, res) => {
  try {
    const isSelf = req.params.id === req.user.id;
    if (!isSelf && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await withBranch(User.findById(req.params.id).select('-password')).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // admin can only view users in their own branch
    if (req.user.role === 'admin' && !isSelf) {
      const targetBranch = user.branchId && (user.branchId._id || user.branchId);
      if (!sameBranch(targetBranch, req.user.branchId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const requestedRole = role || 'staff';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    // admin cannot create admin or super_admin
    if (req.user.role === 'admin' && requestedRole !== 'staff') {
      return res.status(403).json({ message: 'Admin can only create staff users' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    let assignedBranch = null;
    if (requestedRole !== 'super_admin') {
      if (req.user.role === 'admin') {
        // admin: force own branch, ignore whatever was sent
        assignedBranch = req.user.branchId;
      } else {
        // super_admin must explicitly pick a branch for admin/staff
        if (!req.body.branchId) {
          return res.status(400).json({ message: 'Branch is required for admin and staff roles' });
        }
        const branchExists = await Branch.findOne({ _id: req.body.branchId, active: true });
        if (!branchExists) {
          return res.status(400).json({ message: 'Invalid or inactive branch selected' });
        }
        assignedBranch = req.body.branchId;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: requestedRole,
      branchId: assignedBranch,
    });

    const safe = user.toObject();
    delete safe.password;
    res.status(201).json({ user: safe });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'admin') {
      // admin cannot edit users in other branches
      if (!sameBranch(target.branchId, req.user.branchId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // admin cannot escalate role
      if (req.body.role && req.body.role !== 'staff') {
        return res.status(403).json({ message: 'Cannot assign this role' });
      }
      // admin cannot move a user to another branch — always force their own
      req.body.branchId = req.user.branchId;
    } else if (req.body.role === 'super_admin') {
      // super_admin has no branch
      req.body.branchId = null;
    } else if (req.body.branchId) {
      // super_admin assigning/changing an admin/staff user's branch
      const branchExists = await Branch.findOne({ _id: req.body.branchId, active: true });
      if (!branchExists) {
        return res.status(400).json({ message: 'Invalid or inactive branch selected' });
      }
    } else if (req.body.role && req.body.role !== 'super_admin' && !target.branchId) {
      // role changing from super_admin to admin/staff must come with a branch
      return res.status(400).json({ message: 'Branch is required for admin and staff roles' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const updated = await withBranch(
      User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).select('-password')
    );
    res.json({ user: updated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/users/:id — soft delete (active = false)
const deleteUser = async (req, res) => {
  try {
    // cannot delete self
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (req.user.role === 'admin') {
      // admin can only deactivate own-branch staff
      if (!sameBranch(target.branchId, req.user.branchId) || target.role !== 'staff') {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await User.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
