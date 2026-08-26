import { Router } from 'express';
import { requireAuth } from '../middleware/auth-middleware.js';
import { accountsRepo, categoriesRepo } from '../db.js';

export const accountRouter = Router();

// Protect all account routes
accountRouter.use(requireAuth);

// GET /api/accounts - retrieve accounts (optional categoryId filter)
accountRouter.get('/', async (req, res) => {
  const { categoryId } = req.query;
  if (typeof categoryId === 'string' && categoryId.trim() !== '') {
    const accounts = await accountsRepo.getByCategoryId(categoryId.trim());
    return res.json(accounts);
  }

  const accounts = await accountsRepo.getAll();
  res.json(accounts);
});

// POST /api/accounts - create account credential
accountRouter.post('/', async (req, res) => {
  const { email, password, categoryId, notes } = req.body || {};

  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  const cleanPassword = typeof password === 'string' ? password : '';

  // At least one of email or password/secret must be present
  if (!cleanEmail && !cleanPassword) {
    return res.status(400).json({ error: 'Either email/identifier or password/secret/command is required' });
  }

  if (cleanEmail.length > 255) {
    return res.status(400).json({ error: 'Identifier must be up to 255 characters' });
  }

  if (cleanPassword.length > 2000) {
    return res.status(400).json({ error: 'Password / API key / command must be up to 2000 characters' });
  }

  if (typeof categoryId !== 'string' || categoryId.trim() === '') {
    return res.status(400).json({ error: 'Category ID is required' });
  }

  const category = await categoriesRepo.getById(categoryId.trim());
  if (!category) {
    return res.status(400).json({ error: 'Category does not exist' });
  }

  let formattedNotes = '';
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string' || notes.length > 2000) {
      return res.status(400).json({ error: 'Notes must be a string up to 2000 characters' });
    }
    formattedNotes = notes;
  }

  const created = await accountsRepo.create({
    category_id: categoryId.trim(),
    email: cleanEmail,
    password: cleanPassword,
    notes: formattedNotes,
  });

  const fullAccount = await accountsRepo.getById(created.id);
  res.status(201).json(fullAccount || created);
});

// PUT /api/accounts/:id - update account
accountRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await accountsRepo.getById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const { email, password, categoryId, notes } = req.body || {};
  const updates = {};

  if (email !== undefined) {
    if (typeof email !== 'string' || email.trim().length > 255) {
      return res.status(400).json({ error: 'Identifier must be up to 255 characters' });
    }
    updates.email = email.trim();
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length > 2000) {
      return res.status(400).json({ error: 'Password / API key / command must be up to 2000 characters' });
    }
    updates.password = password;
  }

  if (categoryId !== undefined) {
    if (typeof categoryId !== 'string' || categoryId.trim() === '') {
      return res.status(400).json({ error: 'Category ID cannot be empty' });
    }
    const category = await categoriesRepo.getById(categoryId.trim());
    if (!category) {
      return res.status(400).json({ error: 'Category does not exist' });
    }
    updates.category_id = categoryId.trim();
  }

  if (notes !== undefined) {
    if (typeof notes !== 'string' || notes.length > 2000) {
      return res.status(400).json({ error: 'Notes must be a string up to 2000 characters' });
    }
    updates.notes = notes;
  }

  const updated = await accountsRepo.update(id, updates);
  res.json(updated);
});

// DELETE /api/accounts/:id - delete account
accountRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const deleted = await accountsRepo.delete(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Account not found' });
  }
  res.json({ message: 'Account deleted successfully' });
});
