/**
 * Minimal ZIP reader (stored + deflate) for SwissDock's results.zip.
 * Uses the central directory and Web Streams DecompressionStream (Workers + Node 22).
 */

export async function readZipEntry(
  data: Uint8Array,
  match: (name: string) => boolean,
): Promise<{ name: string; text: string } | null> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // End of central directory record (search backwards; comment ≤ 64 KiB).
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65_535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let n = 0; n < entries; n += 1) {
    if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!match(name)) continue;

    if (view.getUint32(localOffset, true) !== 0x04034b50) return null;
    const localName = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localName + localExtra;
    const compressed = data.slice(start, start + compressedSize);
    if (method === 0) return { name, text: decoder.decode(compressed) };
    if (method !== 8) return null;
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return { name, text: await new Response(stream).text() };
  }
  return null;
}
