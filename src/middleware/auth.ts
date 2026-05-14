import { Request, Response, NextFunction } from 'express'
import { getUserById, verifyAccessToken } from '../lib/sqliteDb'
import { AuthenticatedUser } from '../types'

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' })
    return
  }

  const token = authHeader.split(' ')[1]
  const payload = await verifyAccessToken(token)

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const user = await getUserById(payload.sub)
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  req.user = user
  next()
}

// Optional auth — attaches user if token present, but doesn't block
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const payload = await verifyAccessToken(token)
    if (payload) {
      const user = await getUserById(payload.sub)
      if (user) {
        req.user = user
      }
    }
  }

  next()
}
