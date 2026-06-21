require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const Branch = require('./models/Branch');
const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const InventoryItem = require('./models/InventoryItem');
const Order = require('./models/Order');
const Category = require('./models/Category');

const menuItems = [
  {
    name: 'Margherita Pizza',
    category: 'Pizza',
    price: 15.99,
    cost: 6.5,
    sku: 'PZ001',
    tax: 5,
    image: '🍕',
    sales: 145,
    status: 'active',
    allergens: ['Dairy', 'Gluten'],
    qty: 15,
    kitchen_display: true,
  },
  {
    name: 'Caesar Salad',
    category: 'Salads',
    price: 10.99,
    cost: 4.2,
    sku: 'SL001',
    tax: 5,
    image: '🥗',
    sales: 98,
    status: 'active',
    allergens: ['Dairy'],
    qty: 10,
    kitchen_display: true,
  },
  {
    name: 'Classic Burger',
    category: 'Burgers',
    price: 12.99,
    cost: 5.8,
    sku: 'BG001',
    tax: 5,
    image: '🍔',
    sales: 87,
    status: 'active',
    allergens: ['Gluten'],
    qty: 20,
    kitchen_display: true,
  },
  {
    name: 'Pasta Carbonara',
    category: 'Pasta',
    price: 14.99,
    cost: 5.5,
    sku: 'PS001',
    tax: 5,
    image: '🍝',
    sales: 76,
    status: 'active',
    allergens: ['Dairy', 'Gluten', 'Eggs'],
    qty: 12,
    kitchen_display: true,
  },
  {
    name: 'Tea',
    category: 'Hot Drinks',
    price: 2.5,
    cost: 0.8,
    sku: 'HD001',
    tax: 5,
    image: '🍵',
    sales: 0,
    status: 'active',
    allergens: [],
    qty: 50,
    kitchen_display: true,
  },
  {
    name: 'Coffee',
    category: 'Hot Drinks',
    price: 3.0,
    cost: 1.0,
    sku: 'HD002',
    tax: 5,
    image: '☕',
    sales: 0,
    status: 'active',
    allergens: [],
    qty: 50,
    kitchen_display: true,
  },
  {
    name: 'Hot Chocolate',
    category: 'Hot Drinks',
    price: 3.5,
    cost: 1.2,
    sku: 'HD003',
    tax: 5,
    image: '🍫',
    sales: 0,
    status: 'active',
    allergens: ['Dairy'],
    qty: 30,
    kitchen_display: true,
  },
  {
    name: 'Coke',
    category: 'Cool Drinks',
    price: 2.0,
    cost: 0.7,
    sku: 'CD001',
    tax: 5,
    image: '🥤',
    sales: 0,
    status: 'active',
    allergens: [],
    qty: 60,
    kitchen_display: true,
  },
  {
    name: 'Badam Milk',
    category: 'Cool Drinks',
    price: 3.5,
    cost: 1.3,
    sku: 'CD002',
    tax: 5,
    image: '🥛',
    sales: 0,
    status: 'active',
    allergens: ['Dairy', 'Nuts'],
    qty: 30,
    kitchen_display: true,
  },
  {
    name: 'Rose Milk',
    category: 'Cool Drinks',
    price: 3.0,
    cost: 1.1,
    sku: 'CD003',
    tax: 5,
    image: '🥛',
    sales: 0,
    status: 'active',
    allergens: ['Dairy'],
    qty: 30,
    kitchen_display: true,
  },
  {
    name: 'Biscuits',
    category: 'Biscuits',
    price: 1.5,
    cost: 0.5,
    sku: 'BC001',
    tax: 5,
    image: '🍪',
    sales: 0,
    status: 'active',
    allergens: ['Gluten'],
    qty: 100,
    kitchen_display: true,
  },
];

const inventoryItems = [
  { name: 'Tomatoes',         unit: 'kg',     type: 'raw', currentQty: 5,  minQty: 10, packSize: 1,   packSizeUnit: 'kg' },
  { name: 'Mozzarella Cheese',unit: 'kg',     type: 'raw', currentQty: 12, minQty: 8,  packSize: 1,   packSizeUnit: 'kg' },
  { name: 'Flour',            unit: 'kg',     type: 'raw', currentQty: 3,  minQty: 15, packSize: 1,   packSizeUnit: 'kg' },
  { name: 'Lettuce',          unit: 'kg',     type: 'raw', currentQty: 18, minQty: 10, packSize: 1,   packSizeUnit: 'kg' },
  { name: 'Ground Beef',      unit: 'kg',     type: 'raw', currentQty: 22, minQty: 15, packSize: 1,   packSizeUnit: 'kg' },
  { name: 'Olive Oil',        unit: 'litre',  type: 'raw', currentQty: 4,  minQty: 5,  packSize: 1,   packSizeUnit: 'litre' },
  { name: 'Aavin Milk',       unit: 'packet', type: 'raw', currentQty: 20, minQty: 10, packSize: 500, packSizeUnit: 'ml' },
];

const buildOrderItems = (count, amount) => {
  const names = ['Margherita Pizza', 'Caesar Salad', 'Classic Burger', 'Pasta Carbonara'];
  const price = Math.round((amount / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    name: names[i % names.length],
    qty: 1,
    price,
    subtotal: price,
  }));
};

const ordersSeed = [
  { orderNumber: '#1235', createdAt: new Date('2025-01-18T13:15:00'), orderType: 'dine-in',  amount: 45.6,  status: 'completed', staff: 'Mike',  paymentMethod: 'Card', items: 2 },
  { orderNumber: '#1236', createdAt: new Date('2025-01-18T13:30:00'), orderType: 'dine-in',  amount: 96.2,  status: 'cancelled', staff: 'Sarah', paymentMethod: 'Cash', items: 5 },
  { orderNumber: '#1237', createdAt: new Date('2025-01-18T13:45:00'), orderType: 'dine-in',  amount: 58.9,  status: 'completed', staff: 'Tom',   paymentMethod: 'Card', items: 3 },
  { orderNumber: '#1238', createdAt: new Date('2025-01-18T14:00:00'), orderType: 'takeaway', amount: 127.8, status: 'refunded',  staff: 'Anna',  paymentMethod: 'Card', items: 6 },
  { orderNumber: '#1239', createdAt: new Date('2025-01-18T14:15:00'), orderType: 'dine-in',  amount: 42.0,  status: 'completed', staff: 'Mike',  paymentMethod: 'Cash', items: 2 },
  { orderNumber: '#1240', createdAt: new Date('2025-01-18T14:30:00'), orderType: 'takeaway', amount: 85.5,  status: 'completed', staff: 'Sarah', paymentMethod: 'Card', items: 4 },
];

const seed = async () => {
  await connectDB();

  // Remove stale indexes left over from a previous schema (e.g. billNo, the
  // old global-unique `name` on Category, etc.) so the new ones can be built.
  const indexedCollections = [Order, Category, MenuItem, InventoryItem, User];
  for (const Model of indexedCollections) {
    const existing = await Model.collection.indexes().catch(() => []);
    for (const idx of existing) {
      if (idx.name === '_id_') continue;
      // Drop unique single-field name index on Category; mongoose will rebuild
      // the compound one on first use.
      if (Model === Order && idx.key && idx.key.orderNumber) continue;
      await Model.collection.dropIndex(idx.name).catch(() => {});
    }
  }

  await Promise.all([
    Branch.deleteMany({}),
    User.deleteMany({}),
    MenuItem.deleteMany({}),
    InventoryItem.deleteMany({}),
    Order.deleteMany({}),
    Category.deleteMany({}),
  ]);

  // ---- Branches ----
  const branchA = await Branch.create({
    name: 'Tea Spot - RS Puram',
    city: 'Coimbatore',
    address: 'RS Puram Main Road',
  });
  const branchB = await Branch.create({
    name: 'Tea Spot - Gandhipuram',
    city: 'Coimbatore',
    address: 'Gandhipuram Cross Cut Road',
  });

  // ---- Users (passwords hashed; emails lowercased) ----
  const hash = (pw) => bcrypt.hash(pw, 10);
  const userDocs = await Promise.all([
    User.create({ name: 'Owner',  email: 'owner@teaspot.com',  password: await hash('owner123'),  role: 'super_admin', branchId: null }),
    User.create({ name: 'Ravi',   email: 'ravi@teaspot.com',   password: await hash('ravi123'),   role: 'admin',       branchId: branchA._id }),
    User.create({ name: 'Priya',  email: 'priya@teaspot.com',  password: await hash('priya123'),  role: 'staff',       branchId: branchA._id }),
    User.create({ name: 'Kumar',  email: 'kumar@teaspot.com',  password: await hash('kumar123'),  role: 'admin',       branchId: branchB._id }),
    User.create({ name: 'Selvam', email: 'selvam@teaspot.com', password: await hash('selvam123'), role: 'staff',       branchId: branchB._id }),
  ]);

  // ---- Categories: a single shared catalog across all branches ----
  const categoryNames = Array.from(new Set(menuItems.map((item) => item.category)));
  const categoryDocs = await Category.insertMany(
    categoryNames.map((name) => ({ name }))
  );
  const categoryByName = {};
  for (const doc of categoryDocs) categoryByName[doc.name] = doc._id;

  // ---- Menu items: a single shared catalog across all branches ----
  await MenuItem.insertMany(
    menuItems.map(({ category, ...rest }) => ({
      ...rest,
      category_id: categoryByName[category],
    }))
  );

  // ---- Inventory: same set mirrored to both branches ----
  for (const branch of [branchA, branchB]) {
    await InventoryItem.insertMany(
      inventoryItems.map((it) => ({ ...it, branchId: branch._id }))
    );
  }

  // ---- Orders: split between branches so super_admin sees both ----
  const orderDocs = ordersSeed.map((o, i) => ({
    branchId: i % 2 === 0 ? branchA._id : branchB._id,
    orderNumber: o.orderNumber,
    orderType: o.orderType,
    items: buildOrderItems(o.items, o.amount),
    subtotal: o.amount,
    tax: 0,
    discount: 0,
    totalAmount: o.amount,
    status: o.status,
    paymentMethod: o.paymentMethod,
    staff: o.staff,
    createdAt: o.createdAt,
  }));
  await Order.insertMany(orderDocs);

  console.log('\nSeed data inserted successfully\n');
  console.log(`Branch A (${branchA.name}) id: ${branchA._id}`);
  console.log(`Branch B (${branchB.name}) id: ${branchB._id}`);
  console.log('\nUsers:');
  for (const u of userDocs) {
    console.log(`  ${u.email.padEnd(24)} role=${u.role.padEnd(11)} branch=${u.branchId || 'ALL'}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
