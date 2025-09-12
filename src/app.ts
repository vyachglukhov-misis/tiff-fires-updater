import express from "express"
import type { Application } from "express"
import cors from "cors"
import morgan from "morgan"

const app: Application = express()

app.use(cors())
app.use(express.json())
app.use(morgan("dev"))

// routes
// app.use()

// error handler

export default app
