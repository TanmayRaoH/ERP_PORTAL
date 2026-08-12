import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  // Connect without DB first to create it
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    timezone: '+00:00',
  });

  const dbName = process.env.DB_NAME || 'mini_erp';

  console.log(`Creating database ${dbName} if not exists...`);
  await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.execute(`USE \`${dbName}\``);

  console.log('Running migrations...');

  // Users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','sales','warehouse','accounts') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ users table');

  // Customers table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      business_name VARCHAR(255),
      gst_number VARCHAR(20),
      customer_type ENUM('retail','wholesale','distributor') NOT NULL,
      address TEXT NOT NULL,
      status ENUM('lead','active','inactive') NOT NULL DEFAULT 'lead',
      follow_up_date DATE,
      created_by CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ customers table');

  // Customer notes table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS customer_notes (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      customer_id CHAR(36) NOT NULL,
      note TEXT NOT NULL,
      created_by CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ customer_notes table');

  // Products table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100) NOT NULL UNIQUE,
      category VARCHAR(100) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      current_stock INT NOT NULL DEFAULT 0,
      min_stock_alert INT NOT NULL DEFAULT 0,
      location VARCHAR(255) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ products table');

  // Stock movements table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      product_id CHAR(36) NOT NULL,
      quantity_changed INT NOT NULL,
      movement_type ENUM('IN','OUT') NOT NULL,
      reason VARCHAR(255) NOT NULL,
      created_by CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ stock_movements table');

  // Challans table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS challans (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      challan_number VARCHAR(20) NOT NULL UNIQUE,
      customer_id CHAR(36) NOT NULL,
      total_quantity INT NOT NULL DEFAULT 0,
      status ENUM('draft','confirmed','cancelled') NOT NULL DEFAULT 'draft',
      created_by CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ challans table');

  // Challan items table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS challan_items (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      challan_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      product_name_snapshot VARCHAR(255) NOT NULL,
      sku_snapshot VARCHAR(100) NOT NULL,
      unit_price_snapshot DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL,
      PRIMARY KEY (id),
      FOREIGN KEY (challan_id) REFERENCES challans(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ challan_items table');

  // Seed admin user
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash('admin123', 12);
  const { v4: uuidv4 } = await import('uuid');
  const adminId = uuidv4();

  await connection.execute(`
    INSERT IGNORE INTO users (id, name, email, password_hash, role)
    VALUES (?, 'Admin User', 'admin@erp.com', ?, 'admin')
  `, [adminId, passwordHash]);
  console.log('✓ Seeded admin user (admin@erp.com / admin123)');

  await connection.end();
  console.log('\nMigrations completed successfully!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
