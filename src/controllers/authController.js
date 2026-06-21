const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, branchId: user.branchId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const buildUserResponse = async (user) => {
  const response = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId || null,
    branchName: 'All Branches',
  };

  if (user.branchId) {
    const branch = await Branch.findById(user.branchId).select('name');
    response.branchName = branch ? branch.name : null;
  }

  return response;
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({
      token: generateToken(user),
      user: await buildUserResponse(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.active === false) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save();

    res.json({
      token: generateToken(user),
      user: await buildUserResponse(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const me = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(await buildUserResponse(user));
};

module.exports = { register, login, me };
