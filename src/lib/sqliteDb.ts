import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import initSqlJs from 'sql.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

type SqlJsStatic = any
type SqlJsDatabase = any
import {
  AuthenticatedUser,
  CartItem,
  Order,
  OrderItem,
  Product,
} from '../types'

const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'whazzonline.db')
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'please-change-this-secret'
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 30

let SQL: SqlJsStatic | null = null
let db: SqlJsDatabase | null = null

const sqlInit = initSqlJs({
  locateFile: (file: string) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file),
})

async function ensureDb(): Promise<SqlJsDatabase> {
  if (db) return db
  if (!SQL) {
    SQL = await sqlInit
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(new Uint8Array(buffer))
  } else {
    db = new SQL.Database()
    createSchema(db)
    seedProducts(db)
    saveDb(db)
  }

  return db
}

function now(): string {
  return new Date().toISOString()
}

function saveDb(database: SqlJsDatabase): void {
  const data = database.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function createSchema(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL CHECK (price >= 0),
      image_url TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      vendor_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
  `)
}

async function dbGet<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const database = await ensureDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const hasRow = stmt.step()
  const row = hasRow ? (stmt.getAsObject() as T) : null
  stmt.free()
  return row
}

async function dbAll<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await ensureDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

async function dbRun(sql: string, params: unknown[] = []): Promise<any> {
  const database = await ensureDb()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  stmt.step()
  stmt.free()
  saveDb(database)
  return { changes: 1 }
}

async function seedProducts(database: SqlJsDatabase): Promise<void> {
  const countStmt = database.prepare('SELECT COUNT(*) as count FROM products')
  const hasRow = countStmt.step()
  const countRow = countStmt.getAsObject() as { count: number }
  countStmt.free()
  
  if (countRow.count > 0) return

  const sampleProducts: Omit<Product, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>[] = [
    {
      name: 'Wireless Bluetooth Earbuds',
      description: 'Premium true wireless earbuds with 30-hour battery life, ANC, and IPX4 water resistance.',
      price: 28500,
      image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
      category: 'electronics',
      stock: 45,
    },
    {
      name: 'Smart Watch with Health Monitor',
      description: 'Heart rate, sleep tracking, GPS, 7-day battery. iOS & Android compatible.',
      price: 65000,
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
      category: 'electronics',
      stock: 20,
    },
    {
      name: 'Premium Men\'s Agbada Set',
      description: 'Handcrafted 3-piece Agbada in rich damask fabric. Royal blue, wine, and gold available.',
      price: 45000,
      image_url: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4c04?w=800',
      category: 'fashion',
      stock: 15,
    },
    {
      name: 'Ceramic Table Lamp',
      description: 'Handmade ceramic base with linen shade. Warm ambient light. Includes LED bulb.',
      price: 16500,
      image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
      category: 'home',
      stock: 18,
    },
    {
      name: 'Natural Shea Butter Body Cream',
      description: 'Pure unrefined shea butter with argan oil and vitamin E. 500ml, fragrance-free option.',
      price: 5500,
      image_url: 'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=800',
      category: 'beauty',
      stock: 80,
    },
  ]

  try {
    for (const item of sampleProducts) {
      const stmt = database.prepare(
        'INSERT INTO products (id, name, description, price, image_url, category, stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      stmt.bind([
        crypto.randomUUID(),
        item.name,
        item.description,
        item.price,
        item.image_url,
        item.category,
        item.stock,
        now(),
        now()
      ])
      stmt.step()
      stmt.free()
    }
  } catch (error) {
    console.error('Error seeding products:', error)
    throw error
  }
  saveDb(database)
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

type JwtPayload = {
  sub: string
  email: string
  role?: string
  iat: number
  exp: number
}

export async function createAccessToken(user: AuthenticatedUser): Promise<string> {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  )
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (typeof payload === 'object' && payload && 'sub' in payload) {
      return payload as JwtPayload
    }
    return null
  } catch {
    return null
  }
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await dbRun('INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
    token,
    userId,
    expiresAt,
    now(),
  ])
  return token
}

export async function consumeRefreshToken(refreshToken: string): Promise<string | null> {
  const tokenRow = await dbGet<{ token: string; user_id: string; expires_at: string }>(
    'SELECT token, user_id, expires_at FROM refresh_tokens WHERE token = ?',
    [refreshToken]
  )
  if (!tokenRow) return null

  if (new Date(tokenRow.expires_at) < new Date()) {
    await dbRun('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken])
    return null
  }

  await dbRun('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken])
  return tokenRow.user_id
}

export async function deleteRefreshTokensByUserId(userId: string): Promise<void> {
  await dbRun('DELETE FROM refresh_tokens WHERE user_id = ?', [userId])
}

export async function createUser(email: string, password: string, fullName: string): Promise<AuthenticatedUser | null> {
  const existing = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', [email])
  if (existing) return null

  const id = crypto.randomUUID()
  const passwordHash = hashPassword(password)

  await dbRun('INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    email,
    passwordHash,
    fullName,
    'user',
    now(),
  ])

  return { id, email, role: 'user' }
}

export async function getUserById(id: string): Promise<AuthenticatedUser | null> {
  const user = await dbGet<{ id: string; email: string; role: string }>('SELECT id, email, role FROM users WHERE id = ?', [id])
  if (!user) return null
  return { id: user.id, email: user.email, role: user.role }
}

export async function authenticateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await dbGet<{ id: string; email: string; password_hash: string; role: string }>(
    'SELECT id, email, password_hash, role FROM users WHERE email = ?',
    [email]
  )
  if (!user) return null
  if (!verifyPassword(password, user.password_hash)) return null
  return { id: user.id, email: user.email, role: user.role }
}

export async function createSessionTokens(user: AuthenticatedUser): Promise<{ access_token: string; refresh_token: string }> {
  return {
    access_token: await createAccessToken(user),
    refresh_token: await createRefreshToken(user.id),
  }
}

export async function getProducts(filters: { q?: string; category?: string; sort?: string; page?: number; limit?: number }): Promise<Product[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.q) {
    conditions.push('name LIKE ?')
    params.push(`%${filters.q}%`)
  }

  if (filters.category && filters.category !== 'all') {
    conditions.push('category = ?')
    params.push(filters.category)
  }

  let orderBy = 'created_at DESC'
  if (filters.sort === 'price-asc') {
    orderBy = 'price ASC'
  } else if (filters.sort === 'price-desc') {
    orderBy = 'price DESC'
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  let sql = `SELECT * FROM products ${whereClause} ORDER BY ${orderBy}`
  if (filters.limit !== undefined) {
    sql += ' LIMIT ? OFFSET ?'
    params.push(filters.limit, ((filters.page ?? 1) - 1) * filters.limit)
  }

  return await dbAll<Product>(sql, params)
}

export async function countProducts(filters: { q?: string; category?: string }): Promise<number> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.q) {
    conditions.push('name LIKE ?')
    params.push(`%${filters.q}%`)
  }

  if (filters.category && filters.category !== 'all') {
    conditions.push('category = ?')
    params.push(filters.category)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRow = await dbGet<{ count: number }>(`SELECT COUNT(*) as count FROM products ${whereClause}`, params)
  return countRow?.count ?? 0
}

export async function getProductById(id: string): Promise<Product | null> {
  return await dbGet<Product>('SELECT * FROM products WHERE id = ?', [id])
}

export async function createProduct(data: {
  name: string
  description?: string
  price: number
  image_url?: string
  category?: string
  stock?: number
  vendor_id?: string
}): Promise<Product> {
  const id = crypto.randomUUID()
  const createdAt = now()
  const updatedAt = createdAt
  const category = data.category || 'general'
  const stock = typeof data.stock === 'number' ? data.stock : 0

  await dbRun(
    'INSERT INTO products (id, name, description, price, image_url, category, stock, vendor_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      data.name,
      data.description || '',
      data.price,
      data.image_url || '',
      category,
      stock,
      data.vendor_id || null,
      createdAt,
      updatedAt,
    ]
  )

  return {
    id,
    name: data.name,
    description: data.description || '',
    price: data.price,
    image_url: data.image_url || '',
    category,
    stock,
    vendor_id: data.vendor_id || undefined,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(', ')
  return await dbAll<Product>(`SELECT * FROM products WHERE id IN (${placeholders})`, ids)
}

export async function getCart(userId: string): Promise<CartItem[]> {
  const rows = await dbAll<any>(
    `SELECT
        ci.id as id,
        ci.user_id as user_id,
        ci.product_id as product_id,
        ci.quantity as quantity,
        p.id as product_id,
        p.name as name,
        p.description as description,
        p.price as price,
        p.image_url as image_url,
        p.category as category,
        p.stock as stock,
        p.vendor_id as vendor_id,
        p.created_at as created_at,
        p.updated_at as updated_at
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?`,
    [userId]
  )
  return rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    product_id: row.product_id,
    quantity: row.quantity,
    product: {
      id: row.product_id,
      name: row.name,
      description: row.description,
      price: row.price,
      image_url: row.image_url,
      category: row.category,
      stock: row.stock,
      vendor_id: row.vendor_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  }))
}

export async function getCartItemByUserAndProduct(userId: string, productId: string): Promise<CartItem | null> {
  return await dbGet<CartItem>('SELECT id, user_id, product_id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId])
}

export async function getCartItemById(id: string, userId: string): Promise<CartItem | null> {
  return await dbGet<CartItem>('SELECT id, user_id, product_id, quantity FROM cart_items WHERE id = ? AND user_id = ?', [id, userId])
}

export async function createCartItem(userId: string, productId: string, quantity: number): Promise<CartItem> {
  const id = crypto.randomUUID()
  await dbRun('INSERT INTO cart_items (id, user_id, product_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    userId,
    productId,
    quantity,
    now(),
  ])
  return { id, user_id: userId, product_id: productId, quantity }
}

export async function updateCartItemQuantity(id: string, userId: string, quantity: number): Promise<CartItem | null> {
  const result = await dbRun('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, id, userId])
  if (result.changes === 0) return null
  return await getCartItemById(id, userId)
}

export async function deleteCartItem(id: string, userId: string): Promise<boolean> {
  const result = await dbRun('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [id, userId])
  return result.changes > 0
}

export async function clearCart(userId: string): Promise<void> {
  await dbRun('DELETE FROM cart_items WHERE user_id = ?', [userId])
}

export async function getOrders(userId: string): Promise<Order[]> {
  const orders = await dbAll<Order>('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId])
  return orders
}

export async function getOrder(userId: string, orderId: string): Promise<(Order & { order_items: OrderItem[] }) | null> {
  const order = await dbGet<Order>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId])
  if (!order) return null

  const items = await dbAll<any>(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price,
            p.name as product_name, p.image_url as product_image
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
    [orderId]
  )

  return {
    ...order,
    order_items: items.map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  }
}

export async function createOrder(
  userId: string,
  items: { product_id: string; quantity: number }[]
): Promise<{ order: Order; order_items: OrderItem[] }> {
  const productIds = Array.from(new Set(items.map((item) => item.product_id)))
  const products = await getProductsByIds(productIds)

  if (products.length !== productIds.length) {
    throw new Error('One or more products were not found')
  }

  const orderItems: { product_id: string; quantity: number; unit_price: number }[] = []
  let totalAmount = 0

  for (const item of items) {
    const product = products.find((product) => product.id === item.product_id)
    if (!product) {
      throw new Error(`Product ${item.product_id} not found`)
    }

    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`)
    }

    totalAmount += product.price * item.quantity
    orderItems.push({
      product_id: product.id,
      quantity: item.quantity,
      unit_price: product.price,
    })
  }

  let savedItems: OrderItem[] = []
  const orderId = crypto.randomUUID()
  await dbRun('INSERT INTO orders (id, user_id, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?)', [
    orderId,
    userId,
    totalAmount,
    'pending',
    now(),
  ])

  for (const item of orderItems) {
    const itemId = crypto.randomUUID()
    await dbRun('INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)', [
      itemId,
      orderId,
      item.product_id,
      item.quantity,
      item.unit_price,
    ])
    await dbRun('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id])
    savedItems.push({
      id: itemId,
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })
  }

  await dbRun('DELETE FROM cart_items WHERE user_id = ?', [userId])

  const order: Order = {
    id: orderId,
    user_id: userId,
    total_amount: totalAmount,
    status: 'pending',
    created_at: now(),
  }

  return { order, order_items: savedItems }
}
