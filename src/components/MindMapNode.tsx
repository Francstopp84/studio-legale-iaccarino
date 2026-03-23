"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Plus, Minus, Trash2, Edit3, PlusCircle } from "lucide-react";

export type MindMapNodeData = {
  label: string;
  level: number;
  branchColor: string;
  collapsed: boolean;
  hiddenChildren: number;
  schemaStyle: "mindmap" | "concept" | "linear";
  isLeaf: boolean;
  onToggleCollapse: (id: string) => void;
  onEditLabel: (id: string, newLabel: string) => void;
  onAddChild: (id: string) => void;
  onDeleteNode: (id: string) => void;
};

function MindMapNodeComponent({ id, data, selected }: NodeProps<MindMapNodeData>) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback(() => {
    setEditValue(data.label);
    setEditing(true);
  }, [data.label]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (editValue.trim() && editValue.trim() !== data.label) {
      data.onEditLabel(id, editValue.trim());
    }
  }, [editValue, data, id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") {
        setEditing(false);
        setEditValue(data.label);
      }
    },
    [commitEdit, data.label]
  );

  // Style based on schema type and level
  const isRoot = data.level === 0;
  const style = data.schemaStyle;

  let nodeStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    border: selected ? "2px solid var(--accent)" : "1px solid var(--border)",
    borderRadius: "12px",
    padding: "10px 16px",
    minWidth: isRoot ? 180 : 140,
    maxWidth: 260,
    fontSize: isRoot ? 15 : 13,
    fontWeight: isRoot ? 700 : 500,
    cursor: "grab",
    transition: "border-color 0.15s, box-shadow 0.15s",
    position: "relative",
    boxShadow: selected ? "0 0 12px var(--accent-glow)" : "none",
  };

  if (style === "mindmap") {
    if (isRoot) {
      nodeStyle.background = "linear-gradient(135deg, var(--accent), #b8912e)";
      nodeStyle.color = "#1a1814";
      nodeStyle.borderRadius = "16px";
      nodeStyle.padding = "14px 22px";
      nodeStyle.border = "none";
      nodeStyle.fontFamily = "'Playfair Display', serif";
    } else {
      nodeStyle.borderLeft = `4px solid ${data.branchColor}`;
    }
  } else if (style === "concept") {
    nodeStyle.borderRadius = "24px";
    nodeStyle.textAlign = "center";
    if (isRoot) {
      nodeStyle.background = "linear-gradient(135deg, var(--accent), #b8912e)";
      nodeStyle.color = "#1a1814";
      nodeStyle.border = "none";
      nodeStyle.fontFamily = "'Playfair Display', serif";
      nodeStyle.padding = "14px 24px";
    }
  } else if (style === "linear") {
    nodeStyle.borderRadius = "8px";
    nodeStyle.borderLeft = `3px solid ${isRoot ? "var(--accent)" : data.branchColor}`;
    if (isRoot) {
      nodeStyle.fontFamily = "'Playfair Display', serif";
      nodeStyle.fontSize = 16;
    }
  }

  // Determine handle positions based on style
  const sourcePos = style === "linear" ? Position.Right : style === "concept" ? Position.Bottom : Position.Right;
  const targetPos = style === "linear" ? Position.Left : style === "concept" ? Position.Top : Position.Left;

  return (
    <div
      style={nodeStyle}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowActions(true);
      }}
    >
      {/* Target handle */}
      {!isRoot && (
        <Handle
          type="target"
          position={targetPos}
          style={{
            background: data.branchColor || "var(--border)",
            border: "none",
            width: 8,
            height: 8,
          }}
        />
      )}

      {/* Label or edit input */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "inherit",
            fontSize: "inherit",
            fontWeight: "inherit",
            fontFamily: "inherit",
            width: "100%",
          }}
        />
      ) : (
        <span style={{ lineHeight: 1.4, display: "block" }}>{data.label}</span>
      )}

      {/* Collapse/Expand button */}
      {!data.isLeaf && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse(id);
          }}
          style={{
            position: "absolute",
            right: -10,
            top: "50%",
            transform: "translateY(-50%)",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: data.branchColor || "var(--accent)",
            color: "#1a1814",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            zIndex: 10,
          }}
          title={data.collapsed ? "Espandi" : "Comprimi"}
        >
          {data.collapsed ? (
            <Plus style={{ width: 12, height: 12 }} />
          ) : (
            <Minus style={{ width: 12, height: 12 }} />
          )}
        </button>
      )}

      {/* Collapsed badge */}
      {data.collapsed && data.hiddenChildren > 0 && (
        <span
          style={{
            position: "absolute",
            right: -28,
            top: -8,
            background: data.branchColor || "var(--accent)",
            color: "#1a1814",
            borderRadius: "10px",
            padding: "1px 6px",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {data.hiddenChildren}
        </span>
      )}

      {/* Hover actions */}
      {showActions && !editing && (
        <div
          style={{
            position: "absolute",
            top: -32,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "3px 6px",
            zIndex: 20,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDoubleClick();
            }}
            title="Modifica"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 2 }}
          >
            <Edit3 style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onAddChild(id);
            }}
            title="Aggiungi figlio"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)", padding: 2 }}
          >
            <PlusCircle style={{ width: 14, height: 14 }} />
          </button>
          {!isRoot && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteNode(id);
              }}
              title="Elimina"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 2 }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      )}

      {/* Source handle */}
      <Handle
        type="source"
        position={sourcePos}
        style={{
          background: data.branchColor || "var(--accent)",
          border: "none",
          width: 8,
          height: 8,
        }}
      />
    </div>
  );
}

export default memo(MindMapNodeComponent);
