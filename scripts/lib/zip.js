/**
 * Minimal zip writer — Node built-ins only (zlib), no dependencies.
 * Produces standard deflate-compressed archives readable everywhere.
 */

import { deflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync, statSync } from "node:fs";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS date/time from a Date (zip's native timestamp format). */
function dosDateTime(date) {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const day =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { time, day };
}

export class ZipWriter {
  constructor() {
    this.entries = [];
    this.chunks = [];
    this.offset = 0;
  }

  /** Add a file from an in-memory string/Buffer. */
  addString(name, content, { unixMode = 0o644 } = {}) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    // Store uncompressed if deflate doesn't help (tiny files).
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const { time, day } = dosDateTime(new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    this.entries.push({
      nameBuf,
      crc,
      compSize: payload.length,
      size: data.length,
      method,
      time,
      day,
      offset: this.offset,
      unixMode,
    });

    this.chunks.push(local, nameBuf, payload);
    this.offset += local.length + nameBuf.length + payload.length;
  }

  /** Add a file from disk. */
  addFile(name, path) {
    const mode = statSync(path).mode & 0o777;
    this.addString(name, readFileSync(path), { unixMode: mode || 0o644 });
  }

  /** Finish and write the archive to disk. */
  write(outPath) {
    const centralStart = this.offset;
    let centralSize = 0;

    for (const e of this.entries) {
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(0x031e, 4); // made by: unix, v3.0
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0800, 8);
      central.writeUInt16LE(e.method, 10);
      central.writeUInt16LE(e.time, 12);
      central.writeUInt16LE(e.day, 14);
      central.writeUInt32LE(e.crc, 16);
      central.writeUInt32LE(e.compSize, 20);
      central.writeUInt32LE(e.size, 24);
      central.writeUInt16LE(e.nameBuf.length, 28);
      central.writeUInt16LE(0, 30); // extra
      central.writeUInt16LE(0, 32); // comment
      central.writeUInt16LE(0, 34); // disk
      central.writeUInt16LE(0, 36); // internal attrs
      central.writeUInt32LE(((0o100000 | e.unixMode) << 16) >>> 0, 38); // external attrs
      central.writeUInt32LE(e.offset, 42);

      this.chunks.push(central, e.nameBuf);
      centralSize += central.length + e.nameBuf.length;
    }

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralStart, 16);
    end.writeUInt16LE(0, 20);
    this.chunks.push(end);

    writeFileSync(outPath, Buffer.concat(this.chunks));
    return outPath;
  }
}
