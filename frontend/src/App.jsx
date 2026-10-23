
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const initialNodes = [
  {
    id: "sensor-1",
    type: "custom",
    position: { x: 80, y: 130 },
    data: {
      title: "IoT Sensor",
      subtitle: "Incoming telemetry",
      icon: "◉",
      color: "blue",
      detail: "CPU / Memory / Temperature",
    },
  },
  {
    id: "condition-1",
    type: "custom",
    position: { x: 390, y: 130 },
    data: {
      title: "Condition",
      subtitle: "Evaluate a threshold",
      icon: "◇",
      color: "purple",
      detail: "Rule execution not enabled",
    },
  },
  {
    id: "alert-1",
    type: "custom",
    position: { x: 700, y: 130 },
    data: {
      title: "Alert",
      subtitle: "Future action node",
      icon: "↗",
      color: "orange",
      detail: "Alert delivery not enabled",
    },
  },
];

const initialEdges = [
  {
    id: "edge-1",
    source: "sensor-1",
    target: "condition-1",
    animated: true,
  },
  {
    id: "edge-2",
    source: "condition-1",
    target: "alert-1",
    animated: true,
  },
];

function CustomNode({ data, selected }) {
  return (
    <div className={`flow-node ${selected ? "flow-node-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />

      <div className={`node-icon ${data.color}`}>{data.icon}</div>

      <div className="node-content">
        <strong>{data.title}</strong>
        <span>{data.subtitle}</span>
        <small>{data.detail}</small>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function MetricCard({ label, value, unit, color, description }) {
  return (
    <div className="metric-card">
      <div className="metric-card-top">
        <span>{label}</span>
        <span className={`metric-dot ${color}`} />
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{description}</p>
    </div>
  );
}

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [backendStatus, setBackendStatus] = useState("Checking");
  const [databaseStatus, setDatabaseStatus] = useState("Checking");
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryCount, setTelemetryCount] = useState(0);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [sendingTelemetry, setSendingTelemetry] = useState(false);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("Workspace");
  const [lastUpdated, setLastUpdated] = useState(null);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, animated: true }, currentEdges)
      );
    },
    [setEdges]
  );

  const checkBackend = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/health`, {
        timeout: 5000,
      });

      setBackendStatus(
        response.data.status === "OK" ? "Connected" : "Unavailable"
      );
      setDatabaseStatus(response.data.database || "Unknown");
    } catch {
      setBackendStatus("Offline");
      setDatabaseStatus("Unavailable");
    }
  }, []);

  const loadTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    setError("");

    try {
      const response = await axios.get(
        `${API_URL}/api/telemetry/server-01`,
        { timeout: 7000 }
      );

      const readings = response.data.readings || [];
      setTelemetryCount(response.data.count ?? readings.length);
      setTelemetry(readings.length > 0 ? readings[0] : null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load readings. Check the backend and MongoDB."
      );
    } finally {
      setLoadingTelemetry(false);
    }
  }, []);

  const sendTestTelemetry = useCallback(async () => {
    setSendingTelemetry(true);
    setError("");

    try {
      await axios.post(
        `${API_URL}/api/telemetry`,
        {
          deviceId: "server-01",
          deviceType: "server",
          cpuUsage: Number((20 + Math.random() * 70).toFixed(1)),
          memoryUsage: Number((30 + Math.random() * 60).toFixed(1)),
          temperature: Number((35 + Math.random() * 35).toFixed(1)),
        },
        { timeout: 7000 }
      );

      await loadTelemetry();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not send test reading. Check the backend."
      );
    } finally {
      setSendingTelemetry(false);
    }
  }, [loadTelemetry]);

  useEffect(() => {
    checkBackend();
    loadTelemetry();

    const healthInterval = setInterval(checkBackend, 10000);
    const telemetryInterval = setInterval(loadTelemetry, 15000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(telemetryInterval);
    };
  }, [checkBackend, loadTelemetry]);

  const addNode = (kind) => {
    const definitions = {
      sensor: {
        title: "IoT Sensor",
        subtitle: "Incoming telemetry",
        icon: "◉",
        color: "blue",
        detail: "Device readings",
      },
      condition: {
        title: "Condition",
        subtitle: "Evaluate a threshold",
        icon: "◇",
        color: "purple",
        detail: "Rule configuration pending",
      },
      alert: {
        title: "Alert",
        subtitle: "Future action",
        icon: "↗",
        color: "orange",
        detail: "Execution not enabled",
      },
    };

    const definition = definitions[kind];
    const id = `${kind}-${Date.now()}`;

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: "custom",
        position: {
          x: 100 + Math.random() * 300,
          y: 280 + Math.random() * 150,
        },
        data: { ...definition },
      },
    ]);
  };

  const resetCanvas = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  };

  const cpu = telemetry?.cpuUsage;
  const memory = telemetry?.memoryUsage;
  const temperature = telemetry?.temperature;

  const formattedTimestamp = telemetry?.timestamp
    ? new Date(telemetry.timestamp).toLocaleString()
    : "No reading available";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <h1>NexusFlow</h1>
            <span>IOT RULE ENGINE</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="side-nav">
          {[
            ["Workspace", "▦"],
            ["Telemetry", "⌁"],
            ["Rules", "◇"],
            ["Alerts", "♧"],
          ].map(([page, icon]) => (
            <button
              key={page}
              className={`nav-item ${activePage === page ? "active" : ""}`}
              onClick={() => {
                setActivePage(page);
                if (page === "Telemetry") loadTelemetry();
              }}
            >
              <span>{icon}</span>
              {page}
              {["Rules", "Alerts"].includes(page) && (
                <span className="coming-soon">SOON</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-card">
            <span
              className={`connection-dot ${
                backendStatus === "Connected" ? "" : "offline-dot"
              }`}
            />
            <div>
              <strong>API Status</strong>
              <p>{backendStatus}</p>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="avatar">NF</div>
            <div>
              <strong>Developer</strong>
              <span>Local environment</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <span className="environment-pill">
              <span className="environment-dot" />
              DEVELOPMENT
            </span>
            <button
              className="icon-button"
              title="Refresh dashboard"
              onClick={() => {
                checkBackend();
                loadTelemetry();
              }}
            >
              ↻
            </button>
            <div className="avatar">NF</div>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow">IOT AUTOMATION PLATFORM</p>
            <h2>
              {activePage === "Workspace" ? "Visual Rule Engine" : activePage}
            </h2>
            <p className="page-description">
              Build and explore a visual flow for your IoT telemetry.
            </p>
          </div>

          <div className="heading-actions">
            <button className="button-secondary" onClick={resetCanvas}>
              ↺ Reset canvas
            </button>
            <button
              className="button-primary"
              onClick={() =>
                window.alert(
                  "Saving and executing rules will be implemented in a future phase."
                )
              }
            >
              + Save flow
            </button>
          </div>
        </section>

        <section className="status-strip">
          <div className="status-item">
            <span
              className={`status-indicator ${
                backendStatus === "Connected" ? "online" : "offline"
              }`}
            />
            <span>Backend</span>
            <strong>{backendStatus}</strong>
          </div>

          <div className="status-separator" />

          <div className="status-item">
            <span
              className={`status-indicator ${
                databaseStatus === "connected" ? "online" : "offline"
              }`}
            />
            <span>MongoDB</span>
            <strong>{databaseStatus}</strong>
          </div>

          <div className="status-separator" />

          <div className="status-item">
            <span className="status-indicator neutral" />
            <span>Device</span>
            <strong>server-01</strong>
          </div>
        </section>

        <section className="metrics-grid">
          <MetricCard
            label="CPU Usage"
            value={cpu ?? "—"}
            unit={cpu == null ? "" : "%"}
            color="blue"
            description="Latest device reading"
          />
          <MetricCard
            label="Memory Usage"
            value={memory ?? "—"}
            unit={memory == null ? "" : "%"}
            color="purple"
            description="Latest device reading"
          />
          <MetricCard
            label="Temperature"
            value={temperature ?? "—"}
            unit={temperature == null ? "" : "°C"}
            color="orange"
            description="Latest device reading"
          />
          <MetricCard
            label="Saved Readings"
            value={telemetryCount}
            unit=""
            color="green"
            description="Readings returned by API"
          />
        </section>

        {error && (
          <div className="error-banner">
            <span>!</span>
            {error}
            <button onClick={loadTelemetry}>Retry</button>
          </div>
        )}

        <section className="builder-layout">
          <aside className="node-library">
            <div className="panel-heading">
              <div>
                <h3>Node Library</h3>
                <p>Add blocks to your flow</p>
              </div>
              <span className="library-icon">＋</span>
            </div>

            <p className="library-section-label">INPUT</p>
            <button className="library-node" onClick={() => addNode("sensor")}>
              <span className="library-node-icon blue">◉</span>
              <span>
                <strong>IoT Sensor</strong>
                <small>Device telemetry</small>
              </span>
              <span className="add-sign">＋</span>
            </button>

            <p className="library-section-label">LOGIC</p>
            <button
              className="library-node"
              onClick={() => addNode("condition")}
            >
              <span className="library-node-icon purple">◇</span>
              <span>
                <strong>Condition</strong>
                <small>Threshold evaluation</small>
              </span>
              <span className="add-sign">＋</span>
            </button>

            <p className="library-section-label">OUTPUT</p>
            <button className="library-node" onClick={() => addNode("alert")}>
              <span className="library-node-icon orange">↗</span>
              <span>
                <strong>Alert</strong>
                <small>Future action</small>
              </span>
              <span className="add-sign">＋</span>
            </button>

            <div className="library-note">
              <span>ⓘ</span>
              <p>
                Drag from one handle to another to connect nodes. Rule
                execution is not enabled yet.
              </p>
            </div>
          </aside>

          <div className="canvas-panel">
            <div className="canvas-toolbar">
              <div>
                <h3>Flow Builder</h3>
                <p>
                  {nodes.length} nodes <span>·</span> {edges.length} connections
                </p>
              </div>
              <div className="canvas-actions">
                <span className="draft-label">DRAFT</span>
                <button
                  className="canvas-refresh"
                  title="Reset canvas"
                  onClick={resetCanvas}
                >
                  ↺
                </button>
              </div>
            </div>

            <div className="flow-canvas">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.3}
                maxZoom={1.5}
              >
                <Background color="#dfe5ef" gap={20} size={1} />
                <Controls />
                <MiniMap
                  nodeColor={(node) => {
                    if (node.data?.color === "blue") return "#4f83f1";
                    if (node.data?.color === "purple") return "#9270e8";
                    if (node.data?.color === "orange") return "#f0a44b";
                    return "#94a3b8";
                  }}
                />
              </ReactFlow>
            </div>

            <div className="canvas-footer">
              <span>
                <span className="canvas-footer-dot" />
                Canvas ready
              </span>
              <span>Drag nodes · Connect handles · Add nodes</span>
            </div>
          </div>
        </section>

        <section className="telemetry-panel">
          <div className="telemetry-header">
            <div>
              <h3>Latest Telemetry</h3>
              <p>Readings from device server-01</p>
            </div>

            <div className="telemetry-actions">
              <button
                className="button-primary small-button"
                onClick={sendTestTelemetry}
                disabled={sendingTelemetry}
              >
                {sendingTelemetry ? "Sending…" : "+ Send test reading"}
              </button>

              <button
                className="button-secondary small-button"
                onClick={loadTelemetry}
                disabled={loadingTelemetry || sendingTelemetry}
              >
                {loadingTelemetry ? "Loading…" : "↻ Refresh readings"}
              </button>
            </div>
          </div>

          {telemetry ? (
            <div className="reading-details">
              <div>
                <span>Device ID</span>
                <strong>{telemetry.deviceId}</strong>
              </div>
              <div>
                <span>Device type</span>
                <strong>{telemetry.deviceType || telemetry.metadata?.deviceType || "server"}</strong>
              </div>
              <div>
                <span>CPU</span>
                <strong>{telemetry.cpuUsage}%</strong>
              </div>
              <div>
                <span>Memory</span>
                <strong>{telemetry.memoryUsage}%</strong>
              </div>
              <div>
                <span>Temperature</span>
                <strong>{telemetry.temperature}°C</strong>
              </div>
              <div>
                <span>Timestamp</span>
                <strong>{formattedTimestamp}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">⌁</div>
              <strong>No telemetry reading loaded</strong>
              <p>
                Click Send test reading to create a reading, or refresh to
                retrieve saved data.
              </p>
            </div>
          )}

          <div className="telemetry-footer">
            <span>
              API endpoint: <code>POST /api/telemetry</code>
            </span>
            <span>
              {lastUpdated
                ? `Last checked ${lastUpdated.toLocaleTimeString()}`
                : "Waiting for first check"}
            </span>
          </div>
        </section>

        <footer className="app-footer">
          <span>© 2026 NexusFlow · Week 1 development</span>
          <span>React · Express · MongoDB</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
