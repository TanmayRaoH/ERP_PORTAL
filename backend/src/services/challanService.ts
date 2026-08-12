import { PoolConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface ChallanItem {
  product_id: string;
  quantity: number;
}

export interface StockCheckResult {
  success: boolean;
  insufficientItems?: Array<{ product_name: string; available: number; requested: number }>;
}

/**
 * Checks stock availability for a set of challan items within a transaction.
 * Returns success or a list of failing items.
 */
export async function checkStockAvailability(
  conn: PoolConnection,
  items: ChallanItem[]
): Promise<StockCheckResult> {
  const insufficientItems: Array<{ product_name: string; available: number; requested: number }> = [];

  for (const item of items) {
    const [rows] = await conn.execute<any[]>(
      'SELECT id, name, current_stock FROM products WHERE id = ? FOR UPDATE',
      [item.product_id]
    );

    if (rows.length === 0) {
      insufficientItems.push({
        product_name: `Product ID: ${item.product_id}`,
        available: 0,
        requested: item.quantity,
      });
      continue;
    }

    const product = rows[0];
    if (product.current_stock < item.quantity) {
      insufficientItems.push({
        product_name: product.name,
        available: product.current_stock,
        requested: item.quantity,
      });
    }
  }

  return {
    success: insufficientItems.length === 0,
    insufficientItems: insufficientItems.length > 0 ? insufficientItems : undefined,
  };
}

/**
 * Deducts stock for each challan item and records stock movements.
 * Must be called inside an existing transaction.
 */
export async function deductStockForChallan(
  conn: PoolConnection,
  challanId: string,
  challanNumber: string,
  items: Array<ChallanItem & { product_id: string }>,
  userId: string
): Promise<void> {
  for (const item of items) {
    // Deduct stock
    await conn.execute(
      'UPDATE products SET current_stock = current_stock - ? WHERE id = ?',
      [item.quantity, item.product_id]
    );

    // Record stock movement
    const movementId = uuidv4();
    await conn.execute(
      'INSERT INTO stock_movements (id, product_id, quantity_changed, movement_type, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [movementId, item.product_id, item.quantity, 'OUT', `challan ${challanNumber}`, userId]
    );
  }
}

/**
 * Generates the next challan number in format CH-000001
 */
export async function generateChallanNumber(conn: PoolConnection): Promise<string> {
  const [rows] = await conn.execute<any[]>(
    "SELECT challan_number FROM challans ORDER BY created_at DESC LIMIT 1"
  );

  if (rows.length === 0) {
    return 'CH-000001';
  }

  const last = rows[0].challan_number as string;
  const match = last.match(/CH-(\d+)/);
  if (!match) return 'CH-000001';

  const nextNum = parseInt(match[1]) + 1;
  return `CH-${String(nextNum).padStart(6, '0')}`;
}
