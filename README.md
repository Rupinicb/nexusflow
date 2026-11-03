# NexusFlow – Complete Starter Project

## Requirements
- Node.js 20+
- MongoDB running locally

## Backend
```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```
Runs at http://localhost:5000.

## Frontend (second terminal)
```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```
Open http://localhost:5173.

Features: React Flow visual canvas, add/connect nodes, save/load graph in MongoDB, telemetry ingestion and dashboard. Rule compilation, live rule execution, WebSockets and real alert delivery are future work.
