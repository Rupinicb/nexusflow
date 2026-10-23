
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "256kb" }));

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/nexusflow";

async function startServer() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected successfully");

  const db = mongoose.connection.db;
  const name = "telemetry";

  const existing = await db
    .listCollections({ name })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(name, {
      timeseries: {
        timeField: "timestamp",
        metaField: "metadata",
        granularity: "seconds"
      }
    });
    console.log("Telemetry time-series collection created");
  } else if (!existing[0].options?.timeseries) {
    throw new Error(
      "The telemetry collection exists but is not a time-series collection."
    );
  }

  const telemetry = db.collection(name);

  app.get("/", (req, res) => {
    res.json({ message: "NexusFlow API is running" });
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "OK",
      database: mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
    });
  });

  app.post("/api/telemetry", async (req, res) => {
    try {
      const items = Array.isArray(req.body)
        ? req.body
        : [req.body];

      if (items.length < 1 || items.length > 1000) {
        return res.status(400).json({
          error: "Send between 1 and 1000 readings."
        });
      }

      const documents = [];

      for (const item of items) {
        const { deviceId, deviceType, cpuUsage, memoryUsage, temperature } = item;

        if (
          typeof deviceId !== "string" ||
          !deviceId.trim() ||
          deviceId.length > 100 ||
          !Number.isFinite(cpuUsage) ||
          cpuUsage < 0 || cpuUsage > 100 ||
          !Number.isFinite(memoryUsage) ||
          memoryUsage < 0 || memoryUsage > 100 ||
          !Number.isFinite(temperature) ||
          temperature < -100 || temperature > 250
        ) {
          return res.status(400).json({
            error: "Invalid deviceId or telemetry values."
          });
        }

        const timestamp = item.timestamp === undefined
          ? new Date()
          : new Date(item.timestamp);

        if (Number.isNaN(timestamp.getTime())) {
          return res.status(400).json({
            error: "Invalid timestamp."
          });
        }

        documents.push({
          timestamp,
          metadata: {
            deviceId: deviceId.trim(),
            deviceType: deviceType || "server"
          },
          cpuUsage,
          memoryUsage,
          temperature
        });
      }

      const result = await telemetry.insertMany(documents, {
        ordered: true
      });

      res.status(201).json({
        message: "Telemetry ingested successfully",
        insertedCount: result.insertedCount
      });
    } catch (error) {
      console.error("Ingestion error:", error.message);
      res.status(500).json({
        error: "Failed to ingest telemetry."
      });
    }
  });

  app.get("/api/telemetry/:deviceId", async (req, res) => {
    try {
      const parsed = Number.parseInt(req.query.limit, 10);
      const limit = Math.min(
        Math.max(Number.isFinite(parsed) ? parsed : 50, 1),
        500
      );

      const readings = await telemetry
        .find({ "metadata.deviceId": req.params.deviceId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      res.json({
        count: readings.length,
        readings
      });
    } catch (error) {
      console.error("Query error:", error.message);
      res.status(500).json({
        error: "Failed to retrieve telemetry."
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`NexusFlow API running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
