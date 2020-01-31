import parser from "stream-json";
import Asm from "stream-json/Assembler.js";
import Chain from "stream-chain";
import fs from "fs";

export function parse(inputFile) {
  return new Promise(resolve => {
    const chain = new Chain([fs.createReadStream(inputFile), parser()]);

    const asm = Asm.connectTo(chain);

    asm.on("done", asm => resolve(asm.current));
  });
}

// everything is UTF-8 today, no?
const ENCODING = "utf-8";

export async function stringify(jsonValue, outputFile) {
  const outputStream = fs.createWriteStream(outputFile);

  await writeJsonValue(jsonValue, outputStream);

  return new Promise((resolve, reject) => {
    outputStream.on("error", err => reject(err));
    outputStream.end(() => resolve());
  });
}

async function writeJsonValue(value, stream) {
  if (value == null) {
    return;
  }
  if (Array.isArray(value)) {
    await writeJsonArray(value, stream);
    return;
  }
  if (typeof value === "object") {
    await writeJsonObject(value, stream);
    return;
  }
  if (!stream.write(JSON.stringify(value), ENCODING)) {
    await streamReady(stream);
  }
}

async function writeJsonArray(array, stream) {
  stream.write("[", ENCODING);
  for (let i = 0; i < array.length; i++) {
    if (array[i] == null) {
      continue;
    }
    if (i > 0) {
      stream.write(",", ENCODING);
    }
    await writeJsonValue(array[i], stream);
  }
  stream.write("]", ENCODING);
}

async function writeJsonObject(obj, stream) {
  stream.write("{", ENCODING);
  // this will duplicate the keys of the object, but the heapsnapshots
  // doesn't deal with big objects, only big arrays
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    if (obj[keys[i]] == null) {
      continue;
    }
    if (i > 0) {
      stream.write(",", ENCODING);
    }
    await writeJsonValue(keys[i], stream);
    stream.write(":", ENCODING);
    await writeJsonValue(obj[keys[i]], stream);
  }
  stream.write("}", ENCODING);
}

function streamReady(stream) {
  return new Promise(resolve => {
    stream.once("drain", resolve);
  });
}
