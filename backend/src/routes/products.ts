import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import pool from '../db/connection';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().min(1),
  unit_price: z.number().positive(),
  current_stock: z.number().int().min(0).optional().default(0),
  min_stock_alert: z.number().int().min(0).optional().default(0),
  location: z.string().optional().default(''),
});

const updateProductSchema = createProductSchema.partial();

const stockMovementSchema = z.object({
  quantity_changed: z.number().int().positive(),
  movement_type: z.enum(['IN', 'OUT']),
  reason: z.string().min(1),
});

// GET /products
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    const [countRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<any[]>(
      `SELECT * FROM products ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /products/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.execute<any[]>('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /products (warehouse, admin)
router.post('/', requireAuth, requireRole('warehouse', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  const { name, sku, category, unit_price, current_stock, min_stock_alert, location } = parsed.data;

  try {
    const [existing] = await pool.execute<any[]>('SELECT id FROM products WHERE sku = ?', [sku]);
    if ((existing as any[]).length > 0) {
      res.status(409).json({ error: { code: 'DUPLICATE_SKU', message: 'SKU already exists' } });
      return;
    }

    const id = uuidv4();
    await pool.execute(
      'INSERT INTO products (id, name, sku, category, unit_price, current_stock, min_stock_alert, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, sku, category, unit_price, current_stock, min_stock_alert, location]
    );

    const [newProduct] = await pool.execute<any[]>('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json(newProduct[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// PUT /products/:id (warehouse, admin)
router.put('/:id', requireAuth, requireRole('warehouse', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  try {
    const [existing] = await pool.execute<any[]>('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if ((existing as any[]).length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    const updates = parsed.data;
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
    if (updates.sku !== undefined) { setClauses.push('sku = ?'); params.push(updates.sku); }
    if (updates.category !== undefined) { setClauses.push('category = ?'); params.push(updates.category); }
    if (updates.unit_price !== undefined) { setClauses.push('unit_price = ?'); params.push(updates.unit_price); }
    if (updates.min_stock_alert !== undefined) { setClauses.push('min_stock_alert = ?'); params.push(updates.min_stock_alert); }
    if (updates.location !== undefined) { setClauses.push('location = ?'); params.push(updates.location); }

    if (setClauses.length === 0) {
      res.status(400).json({ error: { code: 'NO_CHANGES', message: 'No fields to update' } });
      return;
    }

    params.push(req.params.id);
    await pool.execute(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.execute<any[]>('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /products/:id/stock-movements
router.get('/:id/stock-movements', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const [product] = await pool.execute<any[]>('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if ((product as any[]).length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    const [countRows] = await pool.execute<any[]>(
      'SELECT COUNT(*) as total FROM stock_movements WHERE product_id = ?',
      [req.params.id]
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<any[]>(
      `SELECT sm.*, u.name as created_by_name 
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = ?
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset]
    );

    res.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /products/:id/stock-movements (warehouse, admin)
router.post('/:id/stock-movements', requireAuth, requireRole('warehouse', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = stockMovementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  const { quantity_changed, movement_type, reason } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [productRows] = await conn.execute<any[]>(
      'SELECT id, current_stock FROM products WHERE id = ? FOR UPDATE',
      [req.params.id]
    );

    if ((productRows as any[]).length === 0) {
      await conn.rollback();
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    const product = productRows[0];

    if (movement_type === 'OUT' && product.current_stock < quantity_changed) {
      await conn.rollback();
      res.status(422).json({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock. Available: ${product.current_stock}, requested: ${quantity_changed}`,
        },
      });
      return;
    }

    const newStock = movement_type === 'IN'
      ? product.current_stock + quantity_changed
      : product.current_stock - quantity_changed;

    await conn.execute('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, req.params.id]);

    const movementId = uuidv4();
    await conn.execute(
      'INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [movementId, req.params.id, quantity_changed, movement_type, reason, req.user!.id]
    );

    await conn.commit();

    const [movement] = await conn.execute<any[]>('SELECT * FROM stock_movements WHERE id = ?', [movementId]);
    res.status(201).json(movement[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  } finally {
    conn.release();
  }
});

export default router;
