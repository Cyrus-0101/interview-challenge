import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { Request, Response } from 'express';
import { DatabaseManager } from "./Database/DatabaseManager";
import { ElevatorService } from "./services/ElevatorService";
import { createElevatorRoutes } from "./routes/ElevatorRoutes";
import { ElevatorController } from "./controllers/ElevatorController";
dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();

// Configure express
app.use(express.json());
app.use(cors());

// Initialize database
const db = new DatabaseManager();
const elevatorService = new ElevatorService(db);
const elevatorController = new ElevatorController(elevatorService);

app.get("/", (req: Request, res: Response) => {
    res.json({
        message: "Elevator API System",
        version: "1.0.0",
        endpoints: {
            "POST /api/elevator/call": "Call elevator from one floor to another",
            "GET /api/elevator/status/:elevatorId?": "Get elevator status (all or specific)",
            "GET /api/elevator/logs/:elevatorId?": "Get elevator logs",
            "GET /api/elevator/query-logs": "Get SQL query logs",
            "PUT /api/elevator/config": "Update building configuration",
            "GET /api/elevator/config": "Get building configuration"
        }
    });
})

// Elevator API routes
app.use("/api/elevator", createElevatorRoutes(elevatorController));

app.listen(PORT, () => {
    console.log(`Elevator Server is running on port ${PORT}`);
})