// TODO These should be read dynamically from the snapshot metadata
const NODE_OFFSETS = {
  type: 0,
  name: 1,
  id: 2,
  edge_count: 4,
};

export default class Snapshot {
  constructor(source, { debug }) {
    this.source = source;
    this.nodes = source.nodes;
    this.strings = source.strings;
    this.edges = source.edges;
    this.nodeTypes = source.snapshot.meta.node_types;
    this.nodeFields = source.snapshot.meta.node_fields;
    this.edgeTypes = source.snapshot.meta.edge_types;
    this.edgeFields = source.snapshot.meta.edge_fields;

    this.debug = debug;
  }

  get edgeFieldsCount() {
    return this.edgeFields.length;
  }

  skipEdge(nodeIndex, edgeIndex) {
    const edgeFieldsCount = this.edgeFields.length;
    if (this.debug) {
      console.log(
        `Skipping edge: from ${edgeIndex} to ${edgeIndex + edgeFieldsCount}`
      );
    }

    // nullify the edge
    for (let i = edgeIndex; i < edgeIndex + edgeFieldsCount; i++) {
      this.edges[i] = null;
    }
    this.source.snapshot.meta.edge_count--;

    this.nodes[nodeIndex + NODE_OFFSETS.edge_count]--;
  }

  isNodeObjectTypeEqual(expectedName, nodeIndex) {
    // if the node represents an object, its name will be the type (constructor name really)
    const type =
      this.nodeTypes[NODE_OFFSETS.type][
        this.nodes[nodeIndex + NODE_OFFSETS.type]
      ];
    if (type !== "object") {
      return false;
    }
    const name = this.strings[this.nodes[nodeIndex + NODE_OFFSETS.name]];
    if (name !== expectedName) {
      return false;
    }
    return true;
  }

  traverseNodes(callback, start, end) {
    this._traverseObjects(
      this.nodes,
      this.nodeFields.length,
      callback,
      start,
      end
    );
  }

  traverseEdges(callback, start, end) {
    this._traverseObjects(
      this.edges,
      this.edgeFields.length,
      callback,
      start,
      end
    );
  }

  _traverseObjects(
    objects,
    fieldsCount,
    callback,
    start = 0,
    end = objects.length
  ) {
    for (let i = start; i < end; i += fieldsCount) {
      const objectFields = objects.slice(i, i + fieldsCount);
      callback.apply(null, [...objectFields, i]);
    }
  }
}
