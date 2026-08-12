import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import pool from '../db/connection';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  checkStockAvailability,
  deductStockForChallan,
  generateChallanNumber,
} from '../services/challanService';

const router = Router();

const createChallanSchema = z.object({
  customer_id: z.string().uuid(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
});

const updateChallanSchema = z.object({
  customer_id: z.string().uuid().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1).optional(),
});

// GET /challans
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const customer_id = req.query.customer_id as string | undefined;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND ch.status = ?';
      params.push(status);
    }
    if (customer_id) {
      whereClause += ' AND ch.customer_id = ?';
      params.push(customer_id);
    }

    // Sales role: only see their own challans
    if (req.user!.role === 'sales') {
      whereClause += ' AND ch.created_by = ?';
      params.push(req.user!.id);
    }

    const [countRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as total FROM challans ch ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<any[]>(
      `SELECT ch.*, c.name as customer_name, u.name as created_by_name
       FROM challans ch
       LEFT JOIN customers c ON ch.customer_id = c.id
       LEFT JOIN users u ON ch.created_by = u.id
       ${whereClause}
       ORDER BY ch.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [...params]
    );

    res.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /challans/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [challans] = await pool.execute<any[]>(
      `SELECT ch.*, c.name as customer_name, c.mobile as customer_mobile,
              u.name as created_by_name
       FROM challans ch
       LEFT JOIN customers c ON ch.customer_id = c.id
       LEFT JOIN users u ON ch.created_by = u.id
       WHERE ch.id = ?`,
      [req.params.id]
    );

    if (challans.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challan not found' } });
      return;
    }

    const challan = challans[0];

    // Sales can only see their own challans
    if (req.user!.role === 'sales' && challan.created_by !== req.user!.id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const [items] = await pool.execute<any[]>(
      `SELECT ci.*, p.current_stock as current_product_stock
       FROM challan_items ci
       LEFT JOIN products p ON ci.product_id = p.id
       WHERE ci.challan_id = ?`,
      [req.params.id]
    );

    res.json({ ...challan, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /challans (sales, admin)
router.post('/', requireAuth, requireRole('sales', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = createChallanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  const { customer_id, items } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify customer exists
    const [customers] = await conn.execute<any[]>('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if ((customers as any[]).length === 0) {
      await conn.rollback();
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    // Generate challan number
    const challanNumber = await generateChallanNumber(conn);
    const challanId = uuidv4();
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    // Snapshot product details
    const itemsWithSnapshots: any[] = [];
    for (const item of items) {
      const [products] = await conn.execute<any[]>(
        'SELECT id, name, sku, unit_price FROM products WHERE id = ?',
        [item.product_id]
      );
      if ((products as any[]).length === 0) {
        await conn.rollback();
        res.status(404).json({ error: { code: 'NOT_FOUND', message: `Product ${item.product_id} not found` } });
        return;
      }
      const product = products[0];
      itemsWithSnapshots.push({
        ...item,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        unit_price_snapshot: product.unit_price,
      });
    }

    // Create challan
    await conn.execute(
      'INSERT INTO challans (id, challan_number, customer_id, total_quantity, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [challanId, challanNumber, customer_id, totalQuantity, 'draft', req.user!.id]
    );

    // Create challan items
    for (const item of itemsWithSnapshots) {
      const itemId = uuidv4();
      await conn.execute(
        'INSERT INTO challan_items (id, challan_id, product_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, challanId, item.product_id, item.product_name_snapshot, item.sku_snapshot, item.unit_price_snapshot, item.quantity]
      );
    }

    await conn.commit();

    const [challan] = await conn.execute<any[]>(
      `SELECT ch.*, c.name as customer_name FROM challans ch
       LEFT JOIN customers c ON ch.customer_id = c.id
       WHERE ch.id = ?`,
      [challanId]
    );

    const [challanItems] = await conn.execute<any[]>(
      'SELECT * FROM challan_items WHERE challan_id = ?',
      [challanId]
    );

    res.status(201).json({ ...challan[0], items: challanItems });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  } finally {
    conn.release();
  }
});

// PUT /challans/:id (edit while draft — sales own, admin all)
router.put('/:id', requireAuth, requireRole('sales', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const parsed = updateChallanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [challans] = await conn.execute<any[]>('SELECT * FROM challans WHERE id = ? FOR UPDATE', [req.params.id]);
    if ((challans as any[]).length === 0) {
      await conn.rollback();
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challan not found' } });
      return;
    }

    const challan = challans[0];

    if (challan.status !== 'draft') {
      await conn.rollback();
      res.status(409).json({ error: { code: 'NOT_EDITABLE', message: 'Only draft challans can be edited' } });
      return;
    }

    if (req.user!.role === 'sales' && challan.created_by !== req.user!.id) {
      await conn.rollback();
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own challans' } });
      return;
    }

    const updates = parsed.data;

    if (updates.customer_id) {
      const [customers] = await conn.execute<any[]>('SELECT id FROM customers WHERE id = ?', [updates.customer_id]);
      if ((customers as any[]).length === 0) {
        await conn.rollback();
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
        return;
      }
      await conn.execute('UPDATE challans SET customer_id = ? WHERE id = ?', [updates.customer_id, req.params.id]);
    }

    if (updates.items) {
      // Delete existing items and re-insert
      await conn.execute('DELETE FROM challan_items WHERE challan_id = ?', [req.params.id]);

      const totalQuantity = updates.items.reduce((sum, item) => sum + item.quantity, 0);
      const itemsWithSnapshots: any[] = [];

      for (const item of updates.items) {
        const [products] = await conn.execute<any[]>(
          'SELECT id, name, sku, unit_price FROM products WHERE id = ?',
          [item.product_id]
        );
        if ((products as any[]).length === 0) {
          await conn.rollback();
          res.status(404).json({ error: { code: 'NOT_FOUND', message: `Product ${item.product_id} not found` } });
          return;
        }
        const product = products[0];
        itemsWithSnapshots.push({
          ...item,
          product_name_snapshot: product.name,
          sku_snapshot: product.sku,
          unit_price_snapshot: product.unit_price,
        });
      }

      for (const item of itemsWithSnapshots) {
        const itemId = uuidv4();
        await conn.execute(
          'INSERT INTO challan_items (id, challan_id, product_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [itemId, req.params.id, item.product_id, item.product_name_snapshot, item.sku_snapshot, item.unit_price_snapshot, item.quantity]
        );
      }

      await conn.execute('UPDATE challans SET total_quantity = ? WHERE id = ?', [totalQuantity, req.params.id]);
    }

    await conn.commit();

    const [updated] = await conn.execute<any[]>(
      `SELECT ch.*, c.name as customer_name FROM challans ch
       LEFT JOIN customers c ON ch.customer_id = c.id
       WHERE ch.id = ?`,
      [req.params.id]
    );
    const [items] = await conn.execute<any[]>('SELECT * FROM challan_items WHERE challan_id = ?', [req.params.id]);

    res.json({ ...updated[0], items });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  } finally {
    conn.release();
  }
});

// POST /challans/:id/confirm (warehouse, admin)
router.post('/:id/confirm', requireAuth, requireRole('warehouse', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [challans] = await conn.execute<any[]>('SELECT * FROM challans WHERE id = ? FOR UPDATE', [req.params.id]);
    if ((challans as any[]).length === 0) {
      await conn.rollback();
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challan not found' } });
      return;
    }

    const challan = challans[0];

    if (challan.status !== 'draft') {
      await conn.rollback();
      res.status(409).json({ error: { code: 'NOT_CONFIRMABLE', message: `Challan is already ${challan.status}` } });
      return;
    }

    const [items] = await conn.execute<any[]>(
      'SELECT product_id, quantity FROM challan_items WHERE challan_id = ?',
      [req.params.id]
    );

    if ((items as any[]).length === 0) {
      await conn.rollback();
      res.status(422).json({ error: { code: 'NO_ITEMS', message: 'Challan has no items' } });
      return;
    }

    // Check stock availability (locks rows)
    const stockCheck = await checkStockAvailability(conn, items as any[]);

    if (!stockCheck.success) {
      await conn.rollback();
      res.status(409).json({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock for one or more items',
          details: stockCheck.insufficientItems,
        },
      });
      return;
    }

    // Deduct stock + create movements
    await deductStockForChallan(conn, req.params.id, challan.challan_number, items as any[], req.user!.id);

    // Update challan status
    await conn.execute(
      'UPDATE challans SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['confirmed', req.params.id]
    );

    await conn.commit();

    const [updated] = await conn.execute<any[]>(
      `SELECT ch.*, c.name as customer_name FROM challans ch
       LEFT JOIN customers c ON ch.customer_id = c.id
       WHERE ch.id = ?`,
      [req.params.id]
    );
    const [challanItems] = await conn.execute<any[]>('SELECT * FROM challan_items WHERE challan_id = ?', [req.params.id]);

    res.json({ ...updated[0], items: challanItems });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  } finally {
    conn.release();
  }
});

// POST /challans/:id/cancel (sales own draft, warehouse/admin any)
router.post('/:id/cancel', requireAuth, requireRole('sales', 'warehouse', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [challans] = await conn.execute<any[]>('SELECT * FROM challans WHERE id = ? FOR UPDATE', [req.params.id]);
    if ((challans as any[]).length === 0) {
      await conn.rollback();
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Challan not found' } });
      return;
    }

    const challan = challans[0];

    if (challan.status === 'cancelled') {
      await conn.rollback();
      res.status(409).json({ error: { code: 'ALREADY_CANCELLED', message: 'Challan is already cancelled' } });
      return;
    }

    if (req.user!.role === 'sales') {
      if (challan.created_by !== req.user!.id) {
        await conn.rollback();
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only cancel your own challans' } });
        return;
      }
      if (challan.status !== 'draft') {
        await conn.rollback();
        res.status(409).json({ error: { code: 'NOT_CANCELLABLE', message: 'Sales can only cancel draft challans' } });
        return;
      }
    }

    await conn.execute('UPDATE challans SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await conn.commit();

    const [updated] = await conn.execute<any[]>(
      `SELECT ch.*, c.name as customer_name FROM challans ch
       LEFT JOIN customers c ON ch.customer_id = c.id
       WHERE ch.id = ?`,
      [req.params.id]
    );
    const [challanItems] = await conn.execute<any[]>('SELECT * FROM challan_items WHERE challan_id = ?', [req.params.id]);

    res.json({ ...updated[0], items: challanItems });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  } finally {
    conn.release();
  }
});

export default router;
