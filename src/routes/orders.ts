import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import {
  createOrder,
  getOrder,
  getOrders,
} from '../lib/sqliteDb'
import { requireAuth } from '../middleware/auth'

/**
 * @openapi
 * tags:
 *   - name: Orders
 *     description: Order processing and history
 */

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get current user's orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders
 *   post:
 *     tags: [Orders]
 *     summary: Create a new order from the current cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Validation or stock error
 */

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get a single order for the current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */

const router = Router()

router.use(requireAuth)

// GET /api/orders — get current user's orders
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await getOrders(req.user!.id)
    res.json({ orders })
  } catch (err) {
    next(err)
  }
})

// GET /api/orders/:id — get a single order
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrder(req.user!.id, req.params.id)

    if (!order) {
      res.status(404).json({ error: 'Order not found' })
      return
    }

    res.json({ order })
  } catch (err) {
    next(err)
  }
})

// POST /api/orders — create order from current cart
// This simulates checkout — in production, call payment gateway first
router.post(
  '/',
  [body('items').isArray({ min: 1 }).withMessage('At least one item required')],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const { items } = req.body
      const userId = req.user!.id

      const order = await createOrder(userId, items)
      res.status(201).json({
        message: 'Order placed successfully',
        order: {
          ...order.order,
          order_items: order.order_items,
        },
      })
    } catch (err) {
      if (err instanceof Error) {
        res.status(400).json({ error: err.message })
        return
      }
      next(err)
    }
  }
)

export default router
