import { parse, stringify } from './json-stream.js';

export default class Snapshot {
  /**
   * @param {string} headsnapshotFile
   * @param {Object} options
   * @param {boolean=} options.debug
   */
  static async parse(headsnapshotFile, options) {
    const snapshot = await parse(headsnapshotFile);
    return new this(snapshot, options);
  }

  /**
   * @param {HeapSnapshot} source
   * @param {Object} options
   * @param {boolean=} options.debug
   */
  constructor(source, { debug }) {
    this.source = source;
    const {
      snapshot: {
        meta: {
          node_fields: nodeFields,
          node_types: nodeTypes,
          edge_fields: edgeFields,
          edge_types: edgeTypes,
        },
      },
      nodes,
      edges,
      strings,
    } = source;
    const nodeOffsets = fieldOffsets(nodeFields);
    const edgeOffsets = fieldOffsets(edgeFields);
    this.nodes = nodes;
    this.strings = strings;
    this.edges = edges;
    this.nodeFields = nodeFields;
    this.nodeOffsets = nodeOffsets;
    this.edgeFields = edgeFields;
    this.edgeOffsets = edgeOffsets;
    this.nodeTypeEnum = /** @type {string[]} */ (nodeTypes[nodeOffsets.type]);
    this.edgeTypeEnum = /** @type {string[]} */ (edgeTypes[edgeOffsets.type]);
    this.debug = debug;
  }

  get edgeFieldsCount() {
    return this.edgeFields.length;
  }

  /**
   * @param {number} nodeIndex
   * @param {number} edgeIndex
   */
  skipEdge(nodeIndex, edgeIndex) {
    const edgeFieldsCount = this.edgeFields.length;
    if (this.debug) {
      console.log(`Skipping edge: from ${edgeIndex} to ${edgeIndex + edgeFieldsCount}`);
    }

    // nullify the edge
    for (let i = edgeIndex; i < edgeIndex + edgeFieldsCount; i++) {
      this.edges[i] = /** @type {any} **/ (null);
    }

    this.source.snapshot.edge_count--;
    this.nodes[nodeIndex + this.nodeOffsets.edge_count]--;
  }

  /**
   * @param {string} expectedName
   * @param {number} nodeIndex
   * @returns
   */
  isNodeObjectTypeEqual(expectedName, nodeIndex) {
    // if the node represents an object, its name will be the type (constructor name really)
    const type = this.nodeTypeEnum[this.nodes[nodeIndex + this.nodeOffsets.type]];
    if (type !== 'object') {
      return false;
    }
    const name = this.strings[this.nodes[nodeIndex + this.nodeOffsets.name]];
    if (name !== expectedName) {
      return false;
    }
    return true;
  }

  /**
   * @param {(fields: number[], i: number) => void} callback
   * @param {number=} start
   * @param {number=} end
   */
  traverseNodes(callback, start, end) {
    this._traverseObjects(this.nodes, this.nodeFields.length, callback, start, end);
  }

  /**
   * @param {(fields: number[], i: number) => void} callback
   * @param {number=} start
   * @param {number=} end
   */
  traverseEdges(callback, start, end) {
    this._traverseObjects(this.edges, this.edgeFields.length, callback, start, end);
  }

  /**
   * @param {number[]} objects
   * @param {number} fieldsCount
   * @param {(fields: number[], i: number) => void} callback
   * @param {number=} start
   * @param {number=} end
   */
  _traverseObjects(objects, fieldsCount, callback, start = 0, end = objects.length) {
    for (let i = start; i < end; i += fieldsCount) {
      const objectFields = objects.slice(i, i + fieldsCount);
      callback(objectFields, i);
    }
  }

  /**
   * @param {string} outputFile
   */
  async save(outputFile) {
    await stringify(this.source, outputFile);
  }
}

/**
 * @param {string[]} fields
 * @returns {{[field: string]: number}}
 */
function fieldOffsets(fields) {
  return Object.fromEntries(fields.map((field, offset) => [field, offset]));
}
