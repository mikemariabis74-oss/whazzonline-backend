import { Router, Request, Response, NextFunction } from 'express'
import { body, param, validationResult } from 'express-validator'
import {
  clearCart,
  createCartItem,
  deleteCartItem,
  getCart,
  getCartItemById,
  getCartItemByUserAndProduct,
  getProductById,
  updateCartItemQuantity,
} from '../lib/sqliteDb'
import { requireAuth } from '../middleware/auth'

/**
 * @openapi
 * tags:
 *   - name: Cart
 *     description: Shopping cart operations
 */

/**
 * @openapi
 * /api/cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get current user's cart contents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart contents
 *   post:
 *     tags: [Cart]
 *     summary: Add item to cart or increment existing quantity
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, quantity]
 *             properties:
 *               product_id:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       201:
 *         description: Item added to cart
 *       400:
 *         description: Validation error
 */

/**
 * @openapi
 * /api/cart/{id}:
 *   patch:
 *     tags: [Cart]
 *     summary: Update cart item quantity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Quantity updated
 *       404:
 *         description: Cart item not found
 *   delete:
 *     tags: [Cart]
 *     summary: Remove a single item from the cart
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
 *         description: Item removed from cart
 *       404:
 *         description: Cart item not found
 */

/**
 * @openapi
 * /api/cart:
 *   delete:
 *     tags: [Cart]
 *     summary: Clear the entire cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 */

const router = Router()

// All cart routes require authentication
router.use(requireAuth)

// GET /api/cart — get current user's cart with product details
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await getCart(req.user!.id)
    res.json({ cart })
  } catch (err) {
    next(err)
  }
})

// POST /api/cart — add item to cart (or increment if exists)
router.post(
  '/',
  [
    body('product_id').isUUID().withMessage('Valid product_id required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const { product_id, quantity } = req.body
      const userId = req.user!.id

      const product = await getProductById(product_id)
      if (!product) {
        res.status(404).json({ error: 'Product not found' })
        return
      }

      if (product.stock === 0) {
        res.status(400).json({ error: 'Product is out of stock' })
        return
      }

      const existing = await getCartItemByUserAndProduct(userId, product_id)
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, product.stock)
        const updated = await updateCartItemQuantity(existing.id, userId, newQty)
        if (!updated) {
          res.status(400).json({ error: 'Unable to update cart item' })
          return
        }
        res.json({ message: 'Cart updated', item: updated })
      } else {
        const created = await createCartItem(userId, product_id, quantity)
        res.status(201).json({ message: 'Item added to cart', item: created })
      }
    } catch (err) {
      next(err)
    }
  }
)

// PATCH /api/cart/:id — update quantity of a cart item
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be 0 or greater'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const { id } = req.params
      const { quantity } = req.body

      if (quantity === 0) {
        const removed = await deleteCartItem(id, req.user!.id)
        if (!removed) {
          res.status(404).json({ error: 'Cart item not found' })
          return
        }
        res.json({ message: 'Item removed from cart' })
        return
      }

      const updated = await updateCartItemQuantity(id, req.user!.id, quantity)
      if (!updated) {
        res.status(404).json({ error: 'Cart item not found' })
        return
      }

      res.json({ message: 'Quantity updated', item: updated })
    } catch (err) {
      next(err)
    }
  }
)

// DELETE /api/cart/:id — remove a single item
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const removed = await deleteCartItem(req.params.id, req.user!.id)
    if (!removed) {
      res.status(404).json({ error: 'Cart item not found' })
      return
    }
    res.json({ message: 'Item removed from cart' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/cart — clear entire cart
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await clearCart(req.user!.id)
    res.json({ message: 'Cart cleared' })
  } catch (err) {
    next(err)
  }
})

export default router
