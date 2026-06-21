const Settings = require('../models/Settings');

const getSettings = async (req, res) => {
  try {
    const branchId =
      req.user.role === 'super_admin' ? req.query.branchId || null : req.user.branchId;

    if (!branchId) {
      return res.status(400).json({ message: 'branchId required' });
    }

    let settings = await Settings.findOne({ branchId });
    if (!settings) {
      settings = await Settings.create({ branchId });
    }
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const branchId =
      req.user.role === 'super_admin'
        ? req.body.branchId || req.query.branchId
        : req.user.branchId;

    if (!branchId) {
      return res.status(400).json({ message: 'branchId required' });
    }

    // Never let branchId be reassigned through the body payload.
    const { branchId: _ignore, ...payload } = req.body;

    let settings = await Settings.findOne({ branchId });
    if (!settings) {
      settings = await Settings.create({ ...payload, branchId });
    } else {
      Object.assign(settings, payload);
      await settings.save();
    }
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSettings, updateSettings };
