require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const app = express();
const PORT = process.env.PORT || 5000;
const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nexusflow";
app.use(cors());
app.use(express.json({ limit: "2mb" }));
let telemetry, flows, db;

app.get("/api/health", (_req,res) => res.json({status:"OK", database:db ? "connected" : "unavailable"}));

app.post("/api/telemetry", async (req,res) => {
  try {
    const {deviceId, deviceType="server"} = req.body || {};
    const cpuUsage=Number(req.body?.cpuUsage), memoryUsage=Number(req.body?.memoryUsage), temperature=Number(req.body?.temperature);
    if (!String(deviceId||"").trim() || !Number.isFinite(cpuUsage) || !Number.isFinite(memoryUsage) ||
        !Number.isFinite(temperature) || cpuUsage<0 || cpuUsage>100 || memoryUsage<0 || memoryUsage>100)
      return res.status(400).json({error:"Provide deviceId and valid telemetry values."});
    const timestamp=req.body.timestamp ? new Date(req.body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) return res.status(400).json({error:"Invalid timestamp."});
    const result=await telemetry.insertOne({timestamp,metadata:{deviceId:String(deviceId).trim(),deviceType},deviceId:String(deviceId).trim(),deviceType,cpuUsage,memoryUsage,temperature});
    res.status(201).json({message:"Telemetry ingested successfully",insertedId:result.insertedId});
  } catch(e) { console.error(e); res.status(500).json({error:"Failed to ingest telemetry."}); }
});

app.get("/api/telemetry/:deviceId", async (req,res) => {
  try {
    const n=Number.parseInt(req.query.limit,10), limit=Math.min(Math.max(Number.isFinite(n)?n:50,1),500);
    const readings=await telemetry.find({"metadata.deviceId":req.params.deviceId}).sort({timestamp:-1}).limit(limit).toArray();
    res.json({count:readings.length,readings});
  } catch(e) { console.error(e); res.status(500).json({error:"Failed to retrieve telemetry."}); }
});

app.post("/api/flows", async (req,res) => {
  try {
    const {id="main",nodes,edges}=req.body||{};
    if (!Array.isArray(nodes)||!Array.isArray(edges)) return res.status(400).json({error:"Flow must contain nodes and edges arrays."});
    await flows.replaceOne({id:String(id)},{id:String(id),nodes,edges,updatedAt:new Date()},{upsert:true});
    res.json({message:"Flow saved successfully",id:String(id)});
  } catch(e) { console.error(e); res.status(500).json({error:"Failed to save flow."}); }
});

app.get("/api/flows/:id", async (req,res) => {
  try {
    const flow=await flows.findOne({id:req.params.id},{projection:{_id:0}});
    if (!flow) return res.status(404).json({error:"Saved flow not found."});
    res.json(flow);
  } catch(e) { console.error(e); res.status(500).json({error:"Failed to load flow."}); }
});

async function start() {
  const client=new MongoClient(URI);
  await client.connect();
  db=client.db();
  const existing=await db.listCollections({name:"telemetry"}).toArray();
  if (!existing.length) await db.createCollection("telemetry",{timeseries:{timeField:"timestamp",metaField:"metadata",granularity:"seconds"}});
  telemetry=db.collection("telemetry"); flows=db.collection("flows");
  app.listen(PORT,()=>console.log(`NexusFlow API running at http://localhost:${PORT}`));
}
start().catch(e=>{console.error("Backend startup failed:",e);process.exit(1);});
