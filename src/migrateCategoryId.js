/**
 * One-off migration: convert menuitems.category (string) -> category_id (ObjectId ref Category).
 *
 * For every menu item that still has a `category` string but no `category_id`,
 * find (or create) the matching Category document, set `category_id`, and remove
 * the old `category` field. Idempotent and safe to re-run.
 *
 * Run with:  node src/migrateCategoryId.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const MenuItem = require('./models/MenuItem');
const Category = require('./models/Category');

const migrate = async () => {
  await connectDB();

  // Read raw docs so we can still see the legacy `category` field, which the
  // updated schema no longer maps.
  const docs = await MenuItem.collection.find({}).toArray();

  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    if (doc.category_id) {
      skipped += 1;
      continue;
    }

    const name = doc.category && String(doc.category).trim();
    if (!name) {
      console.warn(`Skipping ${doc._id}: no category to migrate`);
      skipped += 1;
      continue;
    }

    let cat = await Category.findOne({ name });
    if (!cat) cat = await Category.create({ name });

    await MenuItem.collection.updateOne(
      { _id: doc._id },
      { $set: { category_id: cat._id }, $unset: { category: '' } }
    );
    migrated += 1;
  }

  console.log(`Migration complete. Migrated: ${migrated}, skipped: ${skipped}.`);
  await mongoose.connection.close();
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
