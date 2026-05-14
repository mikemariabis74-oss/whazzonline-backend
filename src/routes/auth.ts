import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import {
  authenticateUser,
  createSessionTokens,
  createUser,
  consumeRefreshToken,
  deleteRefreshTokensByUserId,
  getUserById,
} from '../lib/sqliteDb'
import { requireAuth } from '../middleware/auth'

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication and session management
 */

/**
 * @openapi
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, full_name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               full_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation or creation error
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login existing user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh JWT access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Unauthorized
 */

const router = Router()

// POST /api/auth/signup
router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').trim().notEmpty().withMessage('Full name required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const { email, password, full_name } = req.body

      const user = await createUser(email, password, full_name)
      if (!user) {
        res.status(400).json({ error: 'Email is already registered' })
        return
      }

      res.status(201).json({
        message: 'Account created successfully.',
        user: {
          id: user.id,
          email: user.email,
          full_name,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const { email, password } = req.body
      const user = await authenticateUser(email, password)

      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' })
        return
      }

      const tokens = await createSessionTokens(user)
      res.json({
        message: 'Login successful',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          id: user.id,
          email: user.email,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// POST /api/auth/logout — invalidates the session token
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteRefreshTokensByUserId(req.user!.id)
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/refresh — refresh access token
router.post(
  '/refresh',
  [body('refresh_token').notEmpty().withMessage('Refresh token required')],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() })
      return
    }

    try {
      const { refresh_token } = req.body
      const userId = await consumeRefreshToken(refresh_token)

      if (!userId) {
        res.status(401).json({ error: 'Invalid or expired refresh token' })
        return
      }

      const user = await getUserById(userId)
      if (!user) {
        res.status(401).json({ error: 'Invalid refresh token' })
        return
      }

      const tokens = await createSessionTokens(user)
      res.json({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/auth/me — get current authenticated user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
    },
  })
})

export default router
