import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import pool from '../db/connection';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  business_name: z.string().optional().default(''),
  gst_number: z.string().optional().nullable(),
  customer_type: z.enum(['retail', 'wholesale', 'distributor']),
  address: z.string().min(1),
  status: z.enum(['lead', 'active', 'inactive']).optional().default('lead'),
  follow_up_date: z.string().optional().nullable(),
});

const updateCustomerSchema = createCustomerSchema.partial();

const noteSchema = z.object({
  note: z.string().min(1),
});

// GET /customers
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.mobile LIKE ? OR c.business_name LIKE ? OR c.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    const [countRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as total FROM customers c ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<any[]>(
      `SELECT c.*, u.name as created_by_name
       FROM customers c
       LEFT JOIN users u ON c.created_by = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /customers/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT c.*, u.name as created_by_name
       FROM customers c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /customers (sales, admin)
router.post('/', requireAuth, requireRole('sales', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  const data = parsed.data;
  const id = uuidv4();

  try {
    await pool.execute(
      `INSERT INTO customers (id, name, mobile, email, business_name, gst_number, customer_type, address, status, follow_up_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name, data.mobile, data.email || null, data.business_name || null,
        data.gst_number || null, data.customer_type, data.address,
        data.status, data.follow_up_date || null, req.user!.id
      ]
    );

    const [customer] = await pool.execute<any[]>('SELECT * FROM customers WHERE id = ?', [id]);
    res.status(201).json(customer[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// PUT /customers/:id (sales, admin)
router.put('/:id', requireAuth, requireRole('sales', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = updateCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  try {
    const [existing] = await pool.execute<any[]>('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const updates = parsed.data;
    const setClauses: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, any> = {
      name: updates.name,
      mobile: updates.mobile,
      email: updates.email,
      business_name: updates.business_name,
      gst_number: updates.gst_number,
      customer_type: updates.customer_type,
      address: updates.address,
      status: updates.status,
      follow_up_date: updates.follow_up_date,
    };

    for (const [field, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        setClauses.push(`${field} = ?`);
        params.push(value === '' ? null : value);
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: { code: 'NO_CHANGES', message: 'No fields to update' } });
      return;
    }

    params.push(req.params.id);
    await pool.execute(`UPDATE customers SET ${setClauses.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.execute<any[]>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /customers/:id/notes (sales, admin)
router.post('/:id/notes', requireAuth, requireRole('sales', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  try {
    const [customer] = await pool.execute<any[]>('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if ((customer as any[]).length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const noteId = uuidv4();
    await pool.execute(
      'INSERT INTO customer_notes (id, customer_id, note, created_by) VALUES (?, ?, ?, ?)',
      [noteId, req.params.id, parsed.data.note, req.user!.id]
    );

    const [note] = await pool.execute<any[]>(
      `SELECT cn.*, u.name as created_by_name
       FROM customer_notes cn
       LEFT JOIN users u ON cn.created_by = u.id
       WHERE cn.id = ?`,
      [noteId]
    );
    res.status(201).json(note[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /customers/:id/notes
router.get('/:id/notes', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [customer] = await pool.execute<any[]>('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if ((customer as any[]).length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const [notes] = await pool.execute<any[]>(
      `SELECT cn.*, u.name as created_by_name
       FROM customer_notes cn
       LEFT JOIN users u ON cn.created_by = u.id
       WHERE cn.customer_id = ?
       ORDER BY cn.created_at DESC`,
      [req.params.id]
    );

    res.json({ data: notes, total: notes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

export default router;
