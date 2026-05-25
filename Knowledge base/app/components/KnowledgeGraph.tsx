"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types (match data/indexes/graph.json schema)
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: "topic" | "source" | "course";
  label?: string;
  slug?: string;
  topic_slug?: string;
  source_count?: number;
  tweet_url?: string;
  // D3 adds these at runtime:
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  node_count?: number;
  edge_count?: number;
}

interface Props {
  data: GraphData;
  width?: number;
  height?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NODE_COLOR: Record<string, string> = {
  topic:  "#8b5cf6",
  source: "#1d9bf0",
  course: "#f59e0b",
};

const LINK_COLOR: Record<string, string> = {
  belongs_to: "#4b5563",
  tagged:     "#374151",
  wiki_link:  "#8b5cf6",
  cites:      "#22c55e",
};

function nodeRadius(node: GraphNode): number {
  if (node.type === "topic") return 10 + Math.min((node.source_count ?? 0) * 1.5, 18);
  return 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function KnowledgeGraph({ data, width = 900, height = 600 }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const router  = useRouter();

  const navigate = useCallback((node: GraphNode) => {
    if (node.type === "topic" && node.slug) {
      router.push(`/wiki/${node.slug}`);
    } else if (node.type === "source" && node.tweet_url) {
      window.open(node.tweet_url, "_blank", "noopener,noreferrer");
    }
  }, [router]);

  useEffect(() => {
    if (!svgRef.current || !data?.nodes?.length) return;

    // Deep clone nodes/links so D3 can mutate them safely
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = data.links.map((l) => ({
      source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
      target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
      type: l.type,
    }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Zoom container
    const container = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
          container.attr("transform", event.transform);
        })
    );

    // ── Simulation ────────────────────────────────────────────────────────
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance((l) => (l.type === "wiki_link" ? 80 : 120))
        .strength(0.6)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d) + 6));

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = container.append("g")
      .attr("stroke-opacity", 0.45)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => LINK_COLOR[d.type] ?? "#4b5563")
      .attr("stroke-width", (d) => d.type === "wiki_link" ? 1.5 : 1);

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = container.append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d) => NODE_COLOR[d.type] ?? "#6b7280")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", (d) => d.type === "topic" || d.tweet_url ? "pointer" : "default")
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on("click", (_event, d) => navigate(d));

    // ── Labels (only for topic nodes) ─────────────────────────────────────
    const labelSel = container.append("g")
      .selectAll<SVGTextElement, GraphNode>("text")
      .data(nodes.filter((n) => n.type === "topic"))
      .join("text")
      .text((d) => d.label ?? d.slug ?? d.id)
      .attr("font-size", "11px")
      .attr("fill", "#e5e7eb")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -(nodeRadius(d) + 4));

    // ── Tooltips ──────────────────────────────────────────────────────────
    nodeSel.append("title").text((d) => {
      const parts = [d.label ?? d.id, `Type: ${d.type}`];
      if (d.source_count) parts.push(`Sources: ${d.source_count}`);
      return parts.join("\n");
    });

    // ── Tick ──────────────────────────────────────────────────────────────
    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      nodeSel
        .attr("cx", (d) => d.x ?? 0)
        .attr("cy", (d) => d.y ?? 0);

      labelSel
        .attr("x", (d) => d.x ?? 0)
        .attr("y", (d) => d.y ?? 0);
    });

    return () => { simulation.stop(); };
  }, [data, width, height, navigate]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        background: "var(--bg, #0d1117)",
        borderRadius: "12px",
        border: "1px solid var(--border, #21262d)",
        display: "block",
        width: "100%",
      }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
