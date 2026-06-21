require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Role = require('./models/Role');

const roles = [
  {
    name: 'super_admin',
    isEditable: false,
    permissions: {
      dashboard: true, pos: true, orders: true,
      menu: true, categories: true, inventory: true,
      users: true, roles: true, reports: true,
      specialOrders: true, branches: true, settings: true,
      profile: true, help: true,
    },
  },
  {
    name: 'admin',
    isEditable: true,
    permissions: {
      dashboard: true, pos: true, orders: true,
      menu: true, categories: true, inventory: true,
      users: true, roles: false, reports: true,
      specialOrders: true, branches: false, settings: true,
      profile: true, help: true,
    },
  },
  {
    name: 'staff',
    isEditable: true,
    permissions: {
      dashboard: false, pos: true, orders: true,
      menu: false, categories: false, inventory: false,
      users: false, roles: false, reports: false,
      specialOrders: false, branches: false, settings: false,
      profile: true, help: true,
    },
  },
];

const seedRoles = async () => {
  await connectDB();

  // Upsert each role so re-running keeps a single definition per role
  for (const role of roles) {
    await Role.findOneAndUpdate({ name: role.name }, role, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  console.log('Roles seeded successfully');
  await mongoose.connection.close();
  process.exit(0);
};

seedRoles().catch((err) => {
  console.error('Role seeding failed:', err);
  process.exit(1);
});
