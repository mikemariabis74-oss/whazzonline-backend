import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { createProduct, countProducts, getProductById, getProducts } from '../lib/sqliteDb'

/**
 * @openapi
 * tags:
 *   - name: Products
 *     description: Product catalog and lookup
 */

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List available products with optional search, category, and sorting
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for product name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category filter
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price-asc, price-desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of products
 */

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get details for a single product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */

const router = Router()

// GET /api/products
// Query params: q (search), category, sort (newest|price-asc|price-desc)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, category, sort, page, limit } = req.query
    const pageNumber = Number(page) >= 1 ? Number(page) : 1
    const limitNumber = Number(limit) >= 1 ? Number(limit) : 10

    const products = await getProducts({
      q: typeof q === 'string' ? q : undefined,
      category: typeof category === 'string' ? category : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
      page: pageNumber,
      limit: limitNumber,
    })
    const total = await countProducts({
      q: typeof q === 'string' ? q : undefined,
      category: typeof category === 'string' ? category : undefined,
    })

    res.json({ products, page: pageNumber, limit: limitNumber, total })
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const product = await getProductById(id)

    if (!product) {
      res.status(404).json({ error: 'Product not found' })
      return
    }

    res.json({ product })
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               image_url:
 *                 type: string
 *               category:
 *                 type: string
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('price').isNumeric().custom((value) => value >= 0),
    body('image_url').optional().isString(),
    body('category').optional().isString(),
    body('stock').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { name, description, price, image_url, category, stock } = req.body
      const product = await createProduct({
        name,
        description,
        price: Number(price),
        image_url,
        category,
        stock: stock !== undefined ? Number(stock) : undefined,
      })

      res.status(201).json({ product })
    } catch (err) {
      next(err)
    }
  }
)

export default router
