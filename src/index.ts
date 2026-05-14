import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import path from 'path'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'

import authRoutes    from './routes/auth'
import productRoutes from './routes/products'
import cartRoutes    from './routes/cart'
import orderRoutes   from './routes/orders'
import { errorHandler, notFound } from './middleware/errorHandler'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 5000

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Whazzonline API',
      version: '1.0.0',
      description: 'Whazzonline backend API documentation',
    },
    servers: [
      {
        url: 'https://whazzonline-backend-m49z.onrender.com',
        description: 'Production (Render)',
      },
      {
        url: `http://localhost:${PORT}`,
        description: 'Local Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [path.join(__dirname, 'routes', '*.ts')],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec))

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/cart',     cartRoutes)
app.use('/api/orders',   orderRoutes)

// ── 404 + Global error handler ────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Whazzonline API running on http://localhost:${PORT}`)
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   CORS: ${process.env.ALLOWED_ORIGIN || 'http://localhost:3000'}\n`)
})

export default app
