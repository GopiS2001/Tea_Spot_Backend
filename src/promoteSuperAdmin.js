require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

// Usage: node src/promoteSuperAdmin.js <email>
// Promotes an existing user to the super_admin role.
const run = async () => {
  const email = (process.argv[2] || process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email) {
    console.error('Please pass an email: node src/promoteSuperAdmin.js you@example.com');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOneAndUpdate(
    { email },
    { role: 'super_admin', active: true },
    { new: true }
  ).select('-password');

  if (!user) {
    console.error(`No user found with email "${email}". Register first, then re-run.`);
  } else {
    console.log(`Promoted ${user.email} to super_admin.`);
  }

  await mongoose.connection.close();
  process.exit(user ? 0 : 1);
};

run().catch((err) => {
  console.error('Promotion failed:', err);
  process.exit(1);
});
