# heapdump-cleanup

Postprocess a Node heap snapshot to remove all `WeakMap` strong edges
to make it easier to trace the path from a suspected leaked object to the GC root.

## Usage
```
npx heapdump-cleanup <input> <output>
```

## Limitations
The script reads the entire heapdump in memory for processing. The read and write
are streamed and it works on top of the raw snapshot structure, so it only requires
enough memory to keep the raw snapshot data in memory, but it may still choke on
larger heapdumps.