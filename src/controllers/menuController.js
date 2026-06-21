const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');

// Shape a menu item for the API: expose category_id as a plain id and a
// derived `category` name (from the populated reference) so existing clients
// that read `item.category` keep working.
const formatItem = (item) => {
  const obj = item.toObject ? item.toObject() : item;
  const cat = obj.category_id;
  if (cat && typeof cat === 'object' && cat._id) {
    return { ...obj, category_id: cat._id, category: cat.name };
  }
  return { ...obj, category: '' };
};

// Normalize variant-related fields. When hasVariants is true, validate that at
// least one valid variant exists and force base price to 0. When false, clear
// variants and keep the single base price.
const applyVariantRules = (body) => {
  if (body.hasVariants) {
    const variants = Array.isArray(body.variants) ? body.variants : [];
    const cleaned = variants
      .map((v) => ({ name: String(v.name || '').trim(), price: Number(v.price) }))
      .filter((v) => v.name && !Number.isNaN(v.price));
    if (cleaned.length === 0) {
      return { error: 'Variants required when hasVariants is true' };
    }
    return { hasVariants: true, variants: cleaned, price: 0 };
  }
  return { hasVariants: false, variants: [], price: Number(body.price) || 0 };
};

// Resolve a category id from the request body. Accepts an explicit
// `category_id`, or a `category` name which is looked up (created if missing).
// Categories are a single shared catalog, so lookup is global (no branch).
const resolveCategoryId = async (body) => {
  if (body.category_id) return body.category_id;
  if (body.category && String(body.category).trim()) {
    const name = String(body.category).trim();
    let cat = await Category.findOne({ name });
    if (!cat) cat = await Category.create({ name });
    return cat._id;
  }
  return undefined;
};

const getMenuItems = async (req, res) => {
  try {
    const { search, category } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      // `category` may arrive as an id or a name; support both.
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        filter.category_id = category;
      } else {
        const cat = await Category.findOne({ name: category });
        filter.category_id = cat ? cat._id : null; // null => no matches
      }
    }

    if (search && search.trim()) {
      // escape regex special chars so user input is treated literally
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const matchingCats = await Category.find({ name: regex }).select('_id');
      const catIds = matchingCats.map((c) => c._id);
      filter.$or = [
        { name: regex },
        { sku: regex },
        ...(catIds.length ? [{ category_id: { $in: catIds } }] : []),
      ];
    }

    const items = await MenuItem.find(filter)
      .populate('category_id', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json(items.map(formatItem));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
      .populate('category_id', 'name')
      .lean();
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    res.json(formatItem(item));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createMenuItem = async (req, res) => {
  try {
    const category_id = await resolveCategoryId(req.body);
    if (!category_id) {
      return res.status(400).json({ message: 'Category is required' });
    }

    const variantResult = applyVariantRules(req.body);
    if (variantResult.error) {
      return res.status(400).json({ message: variantResult.error });
    }

    const payload = { ...req.body, category_id, ...variantResult };
    delete payload.category;
    delete payload.branchId;

    const item = await MenuItem.create(payload);
    await item.populate('category_id', 'name');
    res.status(201).json(formatItem(item));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.branchId;

    if (payload.category_id || payload.category) {
      const category_id = await resolveCategoryId(payload);
      if (!category_id) {
        return res.status(400).json({ message: 'Category is required' });
      }
      payload.category_id = category_id;
    }
    delete payload.category;

    if (payload.hasVariants !== undefined) {
      const variantResult = applyVariantRules(payload);
      if (variantResult.error) {
        return res.status(400).json({ message: variantResult.error });
      }
      Object.assign(payload, variantResult);
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).populate('category_id', 'name');
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    res.json(formatItem(item));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    res.json({ message: 'Menu item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
