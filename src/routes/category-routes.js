import { Router } from 'express';
import { requireAuth } from '../middleware/auth-middleware.js';
import { categoriesRepo, accountsRepo } from '../db.js';

export const categoryRouter = Router();

// Protect all category routes
categoryRouter.use(requireAuth);

// GET /api/categories - list all categories with accountCount
categoryRouter.get('/', async (_req, res) => {
  const categories = await categoriesRepo.getAllWithCounts();
  res.json(categories);
});

// POST /api/categories - create custom category
categoryRouter.post('/', async (req, res) => {
  const rawName = req.body?.name;
  if (typeof rawName !== 'string') {
    return res.status(400).json({ error: 'Category name must be a string' });
  }

  const trimmedName = rawName.trim();
  if (trimmedName.length < 1 || trimmedName.length > 50) {
    return res.status(400).json({ error: 'Category name must be between 1 and 50 characters' });
  }

  const existing = await categoriesRepo.getByName(trimmedName);
  if (existing) {
    return res.status(400).json({ error: 'Category already exists' });
  }

  const created = await categoriesRepo.create(trimmedName);
  res.status(201).json(created);
});

// DELETE /api/categories/:id - delete custom category if empty and not preset
categoryRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const category = await categoriesRepo.getById(id);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  if (category.is_preset === 1) {
    return res.status(400).json({ error: 'Cannot delete preset category' });
  }

  const accounts = await accountsRepo.getByCategoryId(id);
  if (accounts.length > 0) {
    return res.status(409).json({ error: 'Cannot delete category containing accounts' });
  }

  await categoriesRepo.delete(id);
  res.json({ message: 'Category deleted successfully' });
});
