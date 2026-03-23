"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  ConnectionLineType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Undo2,
  Redo2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Network,
  GitBranch,
  List,
  PanelRightOpen,
  PanelRightClose,
  Palette,
  Trash2,
  PlusCircle,
  X,
} from "lucide-react";
import MindMapNodeComponent from "@/components/MindMapNode";
import {
  layoutMindMap,
  layoutConceptMap,
  layoutLinear,
  assignBranchColors,
  BRANCH_COLORS,
  type RawNode,
  type RawEdge,
} from "@/lib/mindmap-layouts";

// ─── Types ──────────────────────────────────────────────────────────

type SchemaStyle = "mindmap" | "concept" | "linear";

type HistoryEntry = {
  nodes: RawNode[];
  edges: RawEdge[];
};

type Doc = {
  id: number;
  title: string;
};

// ─── Constants ──────────────────────────────────────────────────────

const MAX_HISTORY = 50;

const nodeTypes = { mindmapNode: MindMapNodeComponent };

// ─── Helpers ────────────────────────────────────────────────────────

function rawToFlow(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  style: SchemaStyle,
  collapsedSet: Set<string>,
  callbacks: {
    onToggleCollapse: (id: string) => void;
    onEditLabel: (id: string, label: string) => void;
    onAddChild: (id: string) => void;
    onDeleteNode: (id: string) => void;
  }
): { nodes: Node[]; edges: Edge[] } {
  // Layout
  let positioned;
  if (style === "mindmap") positioned = layoutMindMap(rawNodes, rawEdges);
  else if (style === "concept") positioned = layoutConceptMap(rawNodes, rawEdges);
  else positioned = layoutLinear(rawNodes, rawEdges);

  const colorMap = assignBranchColors(rawNodes, rawEdges);

  // Build children map
  const childrenMap = new Map<string, string[]>();
  for (const n of rawNodes) childrenMap.set(n.id, []);
  for (const e of rawEdges) {
    const list = childrenMap.get(e.source);
    if (list) list.push(e.target);
  }

  // Determine hidden nodes (descendants of collapsed)
  const hidden = new Set<string>();
  function hideDescendants(id: string) {
    for (const kid of childrenMap.get(id) || []) {
      hidden.add(kid);
      hideDescendants(kid);
    }
  }
  for (const cid of collapsedSet) hideDescendants(cid);

  // Count hidden children for badge
  function countDescendants(id: string): number {
    let count = 0;
    for (const kid of childrenMap.get(id) || []) {
      count += 1 + countDescendants(kid);
    }
    return count;
  }

  const nodes: Node[] = positioned
    .filter((n) => !hidden.has(n.id))
    .map((n) => {
      const colorIdx = colorMap.get(n.id) ?? 0;
      const branchColor = colorIdx === -1 ? "var(--accent)" : BRANCH_COLORS[colorIdx];
      const isLeaf = (childrenMap.get(n.id) || []).length === 0;
      const isCollapsed = collapsedSet.has(n.id);

      return {
        id: n.id,
        type: "mindmapNode",
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          level: n.level,
          branchColor,
          collapsed: isCollapsed,
          hiddenChildren: isCollapsed ? countDescendants(n.id) : 0,
          schemaStyle: style,
          isLeaf,
          ...callbacks,
        },
      };
    });

  // Edge style per schema
  const edges: Edge[] = rawEdges
    .filter((e) => !hidden.has(e.source) && !hidden.has(e.target))
    .map((e) => {
      const colorIdx = colorMap.get(e.target) ?? 0;
      const edgeColor = colorIdx === -1 ? "var(--accent)" : BRANCH_COLORS[colorIdx];

      const base: Edge = {
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: style === "concept" ? { type: MarkerType.ArrowClosed, color: edgeColor } : undefined,
      };

      if (style === "mindmap") {
        base.type = "default"; // bezier
      } else if (style === "concept") {
        base.type = "default";
        if (e.label) base.label = e.label;
        base.labelStyle = { fill: "var(--text-secondary)", fontSize: 11 };
        base.labelBgStyle = { fill: "var(--bg-card)", fillOpacity: 0.9 };
        base.labelBgPadding = [4, 8] as [number, number];
        base.labelBgBorderRadius = 4;
      } else {
        base.type = "smoothstep";
      }

      return base;
    });

  return { nodes, edges };
}

// ─── Page Component ─────────────────────────────────────────────────

export default function MindMapPage() {
  // Raw data from AI
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // UI state
  const [schemaStyle, setSchemaStyle] = useState<SchemaStyle>("mindmap");
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // History for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const skipHistoryRef = useRef(false);

  // ─── Fetch documents ──────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDocuments(data);
      })
      .catch(() => {});
  }, []);

  // ─── Node callbacks (stable refs) ─────────────────────────────────

  const onToggleCollapse = useCallback((id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onEditLabel = useCallback(
    (id: string, newLabel: string) => {
      setRawNodes((prev) => prev.map((n) => (n.id === id ? { ...n, label: newLabel } : n)));
      pushHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onAddChild = useCallback(
    (parentId: string) => {
      const newId = `n_${Date.now()}`;
      const parent = rawNodes.find((n) => n.id === parentId);
      const newLevel = parent ? parent.level + 1 : 1;

      setRawNodes((prev) => [...prev, { id: newId, label: "Nuovo nodo", level: newLevel }]);
      setRawEdges((prev) => [...prev, { source: parentId, target: newId }]);
      pushHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawNodes]
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      // Also delete all descendants
      const toDelete = new Set<string>();
      function collectDescendants(nid: string) {
        toDelete.add(nid);
        for (const e of rawEdges) {
          if (e.source === nid) collectDescendants(e.target);
        }
      }
      collectDescendants(id);

      setRawNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
      setRawEdges((prev) => prev.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
      setSelectedNodeId(null);
      pushHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawEdges]
  );

  // ─── Rebuild ReactFlow nodes/edges when raw data or style changes ─

  useEffect(() => {
    if (rawNodes.length === 0) return;

    const { nodes: flowNodes, edges: flowEdges } = rawToFlow(
      rawNodes,
      rawEdges,
      schemaStyle,
      collapsedNodes,
      { onToggleCollapse, onEditLabel, onAddChild, onDeleteNode }
    );
    skipHistoryRef.current = true;
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [rawNodes, rawEdges, schemaStyle, collapsedNodes, onToggleCollapse, onEditLabel, onAddChild, onDeleteNode, setNodes, setEdges]);

  // ─── History management ───────────────────────────────────────────

  const pushHistory = useCallback(() => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      const entry: HistoryEntry = {
        nodes: JSON.parse(JSON.stringify(rawNodes)),
        edges: JSON.parse(JSON.stringify(rawEdges)),
      };
      const next = [...truncated, entry];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawEdges, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const entry = history[historyIndex - 1];
    if (!entry) return;
    skipHistoryRef.current = true;
    setRawNodes(entry.nodes);
    setRawEdges(entry.edges);
    setHistoryIndex((i) => i - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    if (!entry) return;
    skipHistoryRef.current = true;
    setRawNodes(entry.nodes);
    setRawEdges(entry.edges);
    setHistoryIndex((i) => i + 1);
  }, [history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // ─── Generate mind map ────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!selectedDoc) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: selectedDoc }),
      });
      if (!res.ok) throw new Error("Errore generazione");
      const data = await res.json();

      const newNodes: RawNode[] = data.nodes || [];
      const newEdges: RawEdge[] = data.edges || [];

      setRawNodes(newNodes);
      setRawEdges(newEdges);
      setCollapsedNodes(new Set());
      setSelectedNodeId(null);

      // Initialize history
      setHistory([{ nodes: JSON.parse(JSON.stringify(newNodes)), edges: JSON.parse(JSON.stringify(newEdges)) }]);
      setHistoryIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDoc]);

  // ─── Collapse/Expand All ──────────────────────────────────────────

  const collapseAll = useCallback(() => {
    const nonLeafIds = new Set<string>();
    const childrenOf = new Map<string, string[]>();
    for (const n of rawNodes) childrenOf.set(n.id, []);
    for (const e of rawEdges) {
      const list = childrenOf.get(e.source);
      if (list) list.push(e.target);
    }
    for (const [id, kids] of childrenOf) {
      if (kids.length > 0) nonLeafIds.add(id);
    }
    // Don't collapse root
    const root = rawNodes.find((n) => n.level === 0);
    if (root) nonLeafIds.delete(root.id);
    setCollapsedNodes(nonLeafIds);
  }, [rawNodes, rawEdges]);

  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  // ─── Node click → sidebar ─────────────────────────────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSidebarOpen(true);
  }, []);

  // Selected node info for sidebar
  const selectedNode = useMemo(
    () => rawNodes.find((n) => n.id === selectedNodeId),
    [rawNodes, selectedNodeId]
  );

  // Node drag end → push history
  const onNodeDragStop = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  // ─── Sidebar: change color ────────────────────────────────────────

  const changeNodeColor = useCallback(
    (colorIdx: number) => {
      // We'd need to override branch colors per-node. For simplicity, let's just
      // reassign by changing the node's level-1 ancestor color. Instead, we note this
      // is a UI nicety – the branchColor system works by ancestry.
      // For now this is a placeholder.
    },
    []
  );

  // ─── Sidebar label edit ───────────────────────────────────────────

  const [sidebarLabel, setSidebarLabel] = useState("");
  useEffect(() => {
    if (selectedNode) setSidebarLabel(selectedNode.label);
  }, [selectedNode]);

  const commitSidebarLabel = useCallback(() => {
    if (selectedNodeId && sidebarLabel.trim()) {
      onEditLabel(selectedNodeId, sidebarLabel.trim());
    }
  }, [selectedNodeId, sidebarLabel, onEditLabel]);

  // ─── Styles ───────────────────────────────────────────────────────

  const toolbarBtnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? "var(--accent)" : "var(--bg-hover)",
    color: active ? "#1a1814" : "var(--text-secondary)",
    border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    transition: "all 0.15s",
  });

  const iconBtnStyle: React.CSSProperties = {
    background: "var(--bg-hover)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "6px 8px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  };

  const hasMap = rawNodes.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", gap: 0 }}>
      {/* ─── TOOLBAR ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {/* Document selector */}
        <select
          value={selectedDoc ?? ""}
          onChange={(e) => setSelectedDoc(e.target.value ? Number(e.target.value) : null)}
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 13,
            maxWidth: 220,
          }}
        >
          <option value="">Seleziona documento...</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>

        {/* Generate */}
        <button
          onClick={generate}
          disabled={!selectedDoc || loading}
          style={{
            ...toolbarBtnStyle(),
            background: selectedDoc && !loading ? "linear-gradient(135deg, var(--accent), #b8912e)" : "var(--bg-hover)",
            color: selectedDoc && !loading ? "#1a1814" : "var(--text-secondary)",
            opacity: !selectedDoc || loading ? 0.5 : 1,
          }}
        >
          {loading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
          Genera Mappa
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

        {/* Schema style toggle */}
        <button onClick={() => setSchemaStyle("mindmap")} style={toolbarBtnStyle(schemaStyle === "mindmap")}>
          <Network style={{ width: 14, height: 14 }} />
          Mappa Mentale
        </button>
        <button onClick={() => setSchemaStyle("concept")} style={toolbarBtnStyle(schemaStyle === "concept")}>
          <GitBranch style={{ width: 14, height: 14 }} />
          Mappa Concettuale
        </button>
        <button onClick={() => setSchemaStyle("linear")} style={toolbarBtnStyle(schemaStyle === "linear")}>
          <List style={{ width: 14, height: 14 }} />
          Schema Lineare
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={historyIndex <= 0}
          style={{ ...iconBtnStyle, opacity: historyIndex <= 0 ? 0.3 : 1 }}
          title="Annulla (Ctrl+Z)"
        >
          <Undo2 style={{ width: 15, height: 15 }} />
        </button>
        <button
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          style={{ ...iconBtnStyle, opacity: historyIndex >= history.length - 1 ? 0.3 : 1 }}
          title="Ripristina (Ctrl+Shift+Z)"
        >
          <Redo2 style={{ width: 15, height: 15 }} />
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

        {/* Collapse / Expand */}
        <button onClick={collapseAll} style={iconBtnStyle} title="Comprimi tutto" disabled={!hasMap}>
          <ChevronUp style={{ width: 15, height: 15 }} />
        </button>
        <button onClick={expandAll} style={iconBtnStyle} title="Espandi tutto" disabled={!hasMap}>
          <ChevronDown style={{ width: 15, height: 15 }} />
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Sidebar toggle */}
        <button onClick={() => setSidebarOpen((v) => !v)} style={iconBtnStyle} title="Pannello nodo">
          {sidebarOpen ? <PanelRightClose style={{ width: 15, height: 15 }} /> : <PanelRightOpen style={{ width: 15, height: 15 }} />}
        </button>
      </div>

      {/* ─── MAIN AREA ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {/* ReactFlow canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          {!hasMap ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                color: "var(--text-secondary)",
              }}
            >
              <Network style={{ width: 64, height: 64, opacity: 0.2 }} />
              <p style={{ fontSize: 18, fontFamily: "'Playfair Display', serif", color: "var(--text-primary)" }}>
                Schemi e Mappe Mentali
              </p>
              <p style={{ fontSize: 13, maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
                Seleziona un documento e premi &quot;Genera Mappa&quot; per creare automaticamente una mappa concettuale interattiva.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              connectionLineType={
                schemaStyle === "linear"
                  ? ConnectionLineType.SmoothStep
                  : ConnectionLineType.Bezier
              }
              style={{ background: "var(--bg-primary)" }}
              minZoom={0.1}
              maxZoom={2}
              defaultEdgeOptions={{
                style: { strokeWidth: 2 },
              }}
            >
              <Background
                color="var(--border)"
                gap={24}
                size={1}
                style={{ opacity: 0.4 }}
              />
              <Controls
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as any;
                  return data?.branchColor || "var(--accent)";
                }}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
                maskColor="rgba(26, 24, 20, 0.7)"
              />
            </ReactFlow>
          )}
        </div>

        {/* ─── RIGHT SIDEBAR ───────────────────────────────────── */}
        {sidebarOpen && (
          <div
            style={{
              width: 280,
              background: "var(--bg-secondary)",
              borderLeft: "1px solid var(--border)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                Proprietà Nodo
              </h3>
              <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {selectedNode ? (
              <>
                {/* Label edit */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Etichetta
                  </label>
                  <input
                    value={sidebarLabel}
                    onChange={(e) => setSidebarLabel(e.target.value)}
                    onBlur={commitSidebarLabel}
                    onKeyDown={(e) => e.key === "Enter" && commitSidebarLabel()}
                    style={{
                      width: "100%",
                      background: "var(--bg-card)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Info */}
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <p>Livello: {selectedNode.level}</p>
                  <p>ID: {selectedNode.id}</p>
                </div>

                {/* Color picker */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    <Palette style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                    Colore ramo
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {BRANCH_COLORS.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => changeNodeColor(i)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: c,
                          border: "2px solid var(--border)",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => onAddChild(selectedNodeId!)}
                    style={{
                      ...iconBtnStyle,
                      width: "100%",
                      gap: 8,
                      color: "var(--success)",
                      justifyContent: "flex-start",
                      padding: "8px 12px",
                    }}
                  >
                    <PlusCircle style={{ width: 14, height: 14 }} />
                    Aggiungi figlio
                  </button>

                  <button
                    onClick={() => onToggleCollapse(selectedNodeId!)}
                    style={{
                      ...iconBtnStyle,
                      width: "100%",
                      gap: 8,
                      justifyContent: "flex-start",
                      padding: "8px 12px",
                    }}
                  >
                    {collapsedNodes.has(selectedNodeId!) ? (
                      <>
                        <ChevronDown style={{ width: 14, height: 14 }} /> Espandi
                      </>
                    ) : (
                      <>
                        <ChevronUp style={{ width: 14, height: 14 }} /> Comprimi
                      </>
                    )}
                  </button>

                  {selectedNode.level !== 0 && (
                    <button
                      onClick={() => onDeleteNode(selectedNodeId!)}
                      style={{
                        ...iconBtnStyle,
                        width: "100%",
                        gap: 8,
                        color: "var(--danger)",
                        justifyContent: "flex-start",
                        padding: "8px 12px",
                      }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                      Elimina nodo
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Clicca su un nodo per modificarne le proprietà.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .react-flow__attribution {
          display: none !important;
        }
        .react-flow__controls button {
          background: var(--bg-card) !important;
          color: var(--text-primary) !important;
          border-color: var(--border) !important;
        }
        .react-flow__controls button:hover {
          background: var(--bg-hover) !important;
        }
        .react-flow__minimap {
          border-radius: 10px !important;
        }
      `}</style>
    </div>
  );
}
