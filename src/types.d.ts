interface Token {
  name: string;
  value?: string;
}

interface TokenAssembler {
  current: any;
  consume(token: Token): void;
  readonly done: boolean;
}

interface HeapSnapshotMeta {
  node_fields: string[];
  node_types: Array<string | string[]>;
  edge_fields: string[];
  edge_types: Array<string | string[]>;
  [key: string]: unknown;
}

interface HeapSnapshotHeader {
  meta: HeapSnapshotMeta;
  node_count: number;
  edge_count: number;
  [key: string]: unknown;
}

interface HeapSnapshot {
  snapshot: HeapSnapshotHeader;
  nodes: number[];
  edges: number[];
  strings: string[];
  [key: string]: unknown;
}
