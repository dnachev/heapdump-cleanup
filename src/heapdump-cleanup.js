#!/usr/bin/env node
import minimist from 'minimist';
import Snapshot from './snapshot.js';

/**
 * @param {Snapshot} snapshot
 * @param {object} options
 * @param {boolean} options.debug
 */
function processSnapshot(snapshot, { debug }) {
  let nextEdgeIndex = 0;
  let totalObjects = 0;
  let weakMaps = 0;
  snapshot.traverseNodes((fields, nodeIndex) => {
    const start = nextEdgeIndex;
    const ownedEdgeCount = fields[snapshot.nodeOffsets.edge_count];
    // TODO this requires the callback to understand how the heapsnapshots are structured
    nextEdgeIndex = nextEdgeIndex + ownedEdgeCount * snapshot.edgeFieldsCount;
    totalObjects++;
    if (!snapshot.isNodeObjectTypeEqual('WeakMap', nodeIndex)) {
      return;
    }
    if (debug) {
      console.log(`Found WeakMap at ${nodeIndex}`);
    }

    weakMaps++;

    snapshot.traverseEdges(
      (_fields, edgeIndex) => {
        snapshot.skipEdge(nodeIndex, edgeIndex);
      },
      start,
      nextEdgeIndex
    );
  });

  console.log(`Found WeakMap objects: ${weakMaps} of ${totalObjects} total traversed.`);
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
    boolean: 'debug',
  });

  if (argv._.length < 2) {
    usage();
    process.exit(1);
  }

  const [input, output] = argv._;

  const { debug } = argv;

  console.log(`Loading ${input}...`);

  const snapshot = await Snapshot.parse(input, { debug });

  console.log(`Processing the snapshot...`);

  processSnapshot(snapshot, { debug });

  console.log(`Writing snapshot to ${output}...`);

  await snapshot.save(output);
}

main().then(
  () => {
    console.log(`Done!`);
  },
  (err) => {
    console.error('%O', err);
    process.exitCode = 1;
  }
);
