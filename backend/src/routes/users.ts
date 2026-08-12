import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import pool from '../db/connection';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'sales', 'warehouse', 'accounts']),
});

// GET /users (admin only)
router.get('/', requireAuth, requireRole('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ data: rows, total: rows.length, page: 1, limit: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /users (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  const { name, email, password, role } = parsed.data;

  try {
    const [existing] = await pool.execute<any[]>('SELECT id FROM users WHERE email = ?', [email]);
    if ((existing as any[]).length > 0) {
      res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Email already exists' } });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, passwordHash, role]
    );

    res.status(201).json({ id, name, email, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

export default router;
