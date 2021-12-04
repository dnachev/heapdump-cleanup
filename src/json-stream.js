import Parser from 'stream-json/Parser.js';
import Assembler from 'stream-json/Assembler.js';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * @param {string} inputFile
 * @returns {Promise<HeapSnapshot>}
 */
export async function parse(inputFile) {
  const source = createReadStream(inputFile);
  const parser = new Parser({
    packValues: true,
    streamValues: false,
  });
  const assembler = new SnapshotAssembler();
  await pipeline(source, parser, async function assemble(tokens) {
    for await (const token of tokens) {
      assembler.consume(token);
    }
  });
  return assembler.current;
}

/**
 * @implements {TokenAssembler}
 */
class Consumer {
  constructor() {
    /** @type {any} */
    this.current = null;
    this.done = false;
  }

  /** @param {Token} token */
  consume(token) {
    /** @type {any} */
    const consumer = this;
    if (typeof consumer[token.name] === 'function') {
      consumer[token.name](token.value);
    } else {
      throw new Error(`unexpected token ${token.name}`);
    }
  }
}

/**
 * @implements {TokenAssembler}
 */
class SnapshotAssembler extends Consumer {
  constructor() {
    super();
    /** @type {[string, TokenAssembler] | null} */
    this.entry = null;
  }

  /** @param {Token} token */
  consume(token) {
    if (this.done) {
      throw new Error(`extra token ${token.name}`);
    }
    const entry = this.entry;
    if (entry !== null) {
      const [key, assembler] = entry;
      assembler.consume(token);
      if (assembler.done) {
        this.current[key] = assembler.current;
        this.entry = null;
      }
      return;
    }
    super.consume(token);
  }

  getSnapshotHeader() {
    const snapshot = /** @type {HeapSnapshotHeader | undefined} */ (this.current.snapshot);
    if (snapshot === undefined) {
      throw new Error('snapshot key should be first in heapsnapshot json');
    }
    return snapshot;
  }

  getNodesLength() {
    const snapshot = this.getSnapshotHeader();
    return snapshot.node_count * snapshot.meta.node_fields.length;
  }

  getEdgesLength() {
    const snapshot = this.getSnapshotHeader();
    return snapshot.edge_count * snapshot.meta.edge_fields.length;
  }

  startObject() {
    this.current = {};
  }

  /** @param {string} key */
  keyValue(key) {
    let assembler;
    if (key === 'nodes') {
      assembler = new IntArray(this.getNodesLength());
    } else if (key === 'edges') {
      assembler = new IntArray(this.getEdgesLength());
    } else {
      assembler = new Assembler();
    }
    this.entry = [key, assembler];
  }

  endObject() {
    this.done = true;
  }
}

class IntArray extends Consumer {
  /** @param {number} length */
  constructor(length) {
    super();
    this.length = length;
    this.index = 0;
  }
  startArray() {
    this.current = new Array(this.length);
  }
  /** @param {string} value */
  numberValue(value) {
    this.current[this.index++] = parseInt(value, 10);
  }
  endArray() {
    if (this.index !== this.current.length) {
      throw Error('length did not match snapshot header');
    }
    this.done = true;
  }
}

/**
 * @param {HeapSnapshot} snapshot
 * @param {string} outputFile
 * @returns {Promise<void>}
 */
export async function stringify(snapshot, outputFile) {
  const lines = stringifySnapshot(snapshot);
  await pipeline(zipWithLineEnd(lines), createWriteStream(outputFile));
}

/**
 * @param {Iterable<string>} lines
 */
function* zipWithLineEnd(lines) {
  for (const line of lines) {
    yield line + '\n';
  }
}

/**
 * @param {HeapSnapshot} snapshot
 */
function* stringifySnapshot(snapshot) {
  yield `{"snapshot":${JSON.stringify(snapshot.snapshot)},`;
  yield* stringifyIntArray('nodes', snapshot.nodes, snapshot.snapshot.meta.node_fields.length);
  yield* stringifyIntArray('edges', snapshot.edges, snapshot.snapshot.meta.edge_fields.length);
  const ignore = new Set(['snapshot', 'nodes', 'edges', 'strings']);
  yield* stringifyEntries(snapshot, ignore);
  yield* stringifyStrings(snapshot.strings);
}

/**
 * @param {string} key
 * @param {number[]} arr
 * @param {number} fieldLen
 */
function* stringifyIntArray(key, arr, fieldLen) {
  yield `${JSON.stringify(key)}:[`;
  let line = '';
  for (let i = 0; i < arr.length; i++) {
    let num = arr[i];
    if (num == null) continue;
    line += arr[i];
    if ((i + 1) % fieldLen === 0) {
      yield line;
      line = ',';
    } else {
      line += ',';
    }
  }
  yield `],`;
}

/**
 * @param {object} obj
 * @param {Set<string>} ignore
 */
function* stringifyEntries(obj, ignore) {
  for (const [key, value] of Object.entries(obj)) {
    if (ignore.has(key)) continue;
    yield `${JSON.stringify(key)}:${JSON.stringify(value)},`;
  }
}

/**
 * @param {string[]} strings
 */
function* stringifyStrings(strings) {
  yield `"strings":[`;
  let prefix = '';
  for (const str of strings) {
    yield prefix + JSON.stringify(str);
    prefix = ',';
  }
  yield `]}`;
}
