const Role = require('../models/Role');

// GET /api/roles — returns all roles with permissions
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json({ roles });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/roles/:roleName — returns single role permissions
const getRole = async (req, res) => {
  try {
    const role = await Role.findOne({ name: req.params.roleName });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.json({ role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/roles/:roleName — super_admin only
const updateRole = async (req, res) => {
  try {
    const { roleName } = req.params;

    // super_admin role cannot be edited
    if (roleName === 'super_admin') {
      return res
        .status(403)
        .json({ message: 'Super Admin permissions cannot be changed' });
    }

    const role = await Role.findOne({ name: roleName });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    if (!role.isEditable) {
      return res.status(403).json({ message: 'This role cannot be edited' });
    }

    const updated = await Role.findOneAndUpdate(
      { name: roleName },
      { permissions: req.body.permissions },
      { new: true, runValidators: true }
    );
    res.json({ role: updated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = { getRoles, getRole, updateRole };
