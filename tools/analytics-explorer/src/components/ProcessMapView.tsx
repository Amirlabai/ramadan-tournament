import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { fetchProcessMap } from '../api';
import type { ExplorerFilters, ProcessMap, ProcessMapNode } from '../types';
import { formatMedShort } from '../utils/format';

type Props = {
  filters: ExplorerFilters;
  refreshKey: number;
  onNodeClick?: (label: string) => void;
};

type Mode = 'count' | 'time';

type NodeData = {
  label: string;
  sessionCount: number;
  eventCount: number;
  dwellMs: ProcessMapNode['dwellMs'];
  scale: number;
};

function ActivityNode({ data }: { data: NodeData }) {
  const size = Math.max(80, Math.min(160, 70 + data.scale * 12));
  return (
    <div className="activity-node" style={{ width: size }}>
      <Handle type="target" position={Position.Left} />
      <div className="title">{data.label}</div>
      <div className="counts">
        {data.sessionCount} sessions / {data.eventCount} events
      </div>
      {data.dwellMs.sampleCount > 0 && (
        <div className="dwell">{formatMedShort(data.dwellMs)}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { activity: ActivityNode };

function layoutGraph(map: ProcessMap, mode: Mode): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 });

  const maxSessions = Math.max(...map.nodes.map((n) => n.sessionCount), 1);
  const maxTransitions = Math.max(...map.edges.map((e) => e.transitionCount), 1);
  const maxDwell = Math.max(...map.edges.map((e) => e.dwellMs.median), 1);

  for (const node of map.nodes) {
    const scale = node.sessionCount / maxSessions;
    g.setNode(node.id, { width: 120, height: 70 + scale * 30 });
  }

  for (const edge of map.edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const nodes: Node[] = map.nodes.map((node) => {
    const pos = g.node(node.id);
    const scale = node.sessionCount / maxSessions;
    return {
      id: node.id,
      type: 'activity',
      position: { x: pos.x - 60, y: pos.y - 40 },
      data: {
        label: node.label,
        sessionCount: node.sessionCount,
        eventCount: node.eventCount,
        dwellMs: node.dwellMs,
        scale,
      } satisfies NodeData,
    };
  });

  const edges: Edge[] = map.edges.map((edge) => {
    const thickness =
      mode === 'count'
        ? 1 + (edge.transitionCount / maxTransitions) * 8
        : 1 + (edge.dwellMs.median / maxDwell) * 8;
    const dwellLabel =
      edge.dwellMs.sampleCount > 0 ? ` · ${formatMedShort(edge.dwellMs)}` : '';
    return {
      id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: `${edge.sessionCount} → ${edge.transitionCount}${dwellLabel}`,
      style: { strokeWidth: thickness, stroke: '#5b8def' },
      labelStyle: { fill: '#c8d4e8', fontSize: 10 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#5b8def' },
    };
  });

  return { nodes, edges };
}

export default function ProcessMapView({ filters, refreshKey, onNodeClick }: Props) {
  const [map, setMap] = useState<ProcessMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('count');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchProcessMap(filters)
      .then((res) => {
        if (!cancelled) setMap(res);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filters, refreshKey]);

  const { nodes, edges } = useMemo(
    () => (map ? layoutGraph(map, mode) : { nodes: [], edges: [] }),
    [map, mode]
  );

  const onNodeClickHandler = useCallback(
    (_: unknown, node: Node) => {
      const data = node.data as NodeData;
      onNodeClick?.(data.label);
    },
    [onNodeClick]
  );

  if (error) return <div className="error-banner">{error}</div>;
  if (!map) return <div className="loading">Loading process map…</div>;
  if (map.nodes.length === 0) {
    return (
      <div className="loading">
        No session traces in range. Ensure DATABASE_URL points to Postgres with analytics_events.
      </div>
    );
  }

  return (
    <div>
      <div className="process-map-toolbar">
        <label>
          <input
            type="radio"
            name="map-mode"
            checked={mode === 'count'}
            onChange={() => setMode('count')}
          />
          Count mode (edge thickness = transitions)
        </label>
        <label>
          <input
            type="radio"
            name="map-mode"
            checked={mode === 'time'}
            onChange={() => setMode('time')}
          />
          Time mode (edge thickness = median dwell)
        </label>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          {map.nodes.length} activities · {map.edges.length} pathways
        </span>
      </div>
      <div className="process-map-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={onNodeClickHandler}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#2d3a4f" gap={16} />
          <Controls />
          <MiniMap nodeColor="#243044" maskColor="rgba(0,0,0,0.6)" />
        </ReactFlow>
      </div>
    </div>
  );
}
