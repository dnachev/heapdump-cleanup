#!/usr/bin/env node
import minimist from "minimist";
import { parse, stringify } from "./json-stream.js";
import Snapshot from "./snapshot.js";

function processSnapshot(snapshot, { debug }) {
  let nextEdgeIndex = 0;
  let totalObjects = 0;
  let weakMaps = 0;
  snapshot.traverseNodes((type, name, id, _, ownedEdgeCount, __, nodeIndex) => {
    const start = nextEdgeIndex;
    // TODO this requires the callback to understand how the heapsnapshots are structured
    nextEdgeIndex = nextEdgeIndex + ownedEdgeCount * snapshot.edgeFieldsCount;
    totalObjects++;
    if (!snapshot.isNodeObjectTypeEqual("WeakMap", nodeIndex)) {
      return;
    }
    if (debug) {
      console.log(`Found WeakMap at ${nodeIndex}`);
    }

    weakMaps++;

    snapshot.traverseEdges(
      (type, name, toNode, edgeIndex) => {
        snapshot.skipEdge(nodeIndex, edgeIndex);
      },
      start,
      nextEdgeIndex
    );
  });

  console.log(
    `Found WeakMap objects: ${weakMaps} of ${totalObjects} total traversed.`
  );
}

function usage() {
  console.error(
    `Usage:
  ${process.argv0} [--debug] <input> <output>
  Options:
    --debug   print additional information, which is only useful for development and debugging
`
  );
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: "debug"
  });

  if (argv._.length < 2) {
    usage();
    process.exit(1);
  }

  const [input, output] = argv._;

  const { debug } = argv;

  console.log(`Loading ${input}...`);

  const snapshot = await parse(input);

  console.log(`Processing the snapshot...`);

  processSnapshot(new Snapshot(snapshot, { debug }), { debug });

  console.log(`Writing snapshot to ${output}...`);

  await stringify(snapshot, output);
}

main().then(
  () => {
    console.log(`Done!`);
  },
  err => {
    console.error(err);
    process.exit(1);
  }
);
