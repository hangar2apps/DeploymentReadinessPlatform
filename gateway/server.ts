import express from 'express'
  import cors from 'cors'
  import dotenv from 'dotenv'

  dotenv.config({ path: '../.env' }) // shared root .env

  const app = express()
  const PORT = process.env.PORT || 3000

  app.use(cors({ origin: 'http://localhost:5173' }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'drp-gateway' })
  })

  app.listen(PORT, () => {
    console.log(`DRP gateway listening on http://localhost:${PORT}`)
  })