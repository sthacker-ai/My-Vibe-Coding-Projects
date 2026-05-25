"use client";

import dynamic from "next/dynamic";
import type { GraphData } from "../components/KnowledgeGraph";

// Load KnowledgeGraph only on client side (d3 requires browser APIs)
const KnowledgeGraph = dynamic(() => import("../components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "560px",
      background: "var(--bg)",
      borderRadius: "12px",
      border: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--muted)",
      fontSize: "0.85rem",
    }}>
      Loading graph…
    </div>
  ),
});

export default function GraphClient({ data }: { data: GraphData }) {
  return <KnowledgeGraph data={data} width={900} height={560} />;
}
