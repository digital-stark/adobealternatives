// PNG pHYs and JPEG JFIF density are written locally; existing image data stays intact.
const encoder = new TextEncoder();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function join(parts) {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    result.set(p, at);
    at += p.length;
  }
  return result;
}
function densityChunk(ppi) {
  const out = new Uint8Array(21),
    view = new DataView(out.buffer);
  view.setUint32(0, 9);
  out.set(encoder.encode("pHYs"), 4);
  view.setUint32(8, Math.round(ppi / 0.0254));
  view.setUint32(12, Math.round(ppi / 0.0254));
  out[16] = 1;
  view.setUint32(17, crc32(out.slice(4, 17)));
  return out;
}
export function setDensity(bytes, type, ppi) {
  if (!Number.isFinite(ppi) || ppi < 1 || ppi > 2400)
    throw new Error("Invalid export print resolution");
  if (type === "png") {
    if (
      bytes.length < 33 ||
      bytes[0] !== 137 ||
      String.fromCharCode(...bytes.slice(1, 4)) !== "PNG"
    )
      throw new Error("Invalid PNG");
    const chunks = [bytes.slice(0, 8)],
      view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8,
      written = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset),
        end = offset + 12 + length;
      if (end > bytes.length) throw new Error("Invalid PNG chunk");
      const name = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (name !== "pHYs") chunks.push(bytes.slice(offset, end));
      if (name === "IHDR") {
        chunks.push(densityChunk(ppi));
        written = true;
      }
      offset = end;
    }
    if (!written || offset !== bytes.length)
      throw new Error("Invalid PNG structure");
    return join(chunks);
  }
  if (type === "jpeg") {
    if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error("Invalid JPEG");
    const result = new Uint8Array(bytes);
    let pos = 2;
    while (pos + 4 < result.length) {
      if (result[pos] !== 255) break;
      const marker = result[pos + 1];
      if (marker === 218 || marker === 217) break;
      const length = (result[pos + 2] << 8) | result[pos + 3];
      if (length < 2 || pos + 2 + length > result.length)
        throw new Error("Invalid JPEG segment");
      const payload = pos + 4;
      if (
        marker === 224 &&
        length >= 16 &&
        String.fromCharCode(...result.slice(payload, payload + 5)) === "JFIF\0"
      ) {
        result[payload + 7] = 1;
        result[payload + 8] = (Math.round(ppi) >> 8) & 255;
        result[payload + 9] = Math.round(ppi) & 255;
        result[payload + 10] = result[payload + 8];
        result[payload + 11] = result[payload + 9];
        return result;
      }
      pos += 2 + length;
    }
    const app = new Uint8Array([
      255,
      224,
      0,
      16,
      74,
      70,
      73,
      70,
      0,
      1,
      1,
      1,
      (Math.round(ppi) >> 8) & 255,
      Math.round(ppi) & 255,
      (Math.round(ppi) >> 8) & 255,
      Math.round(ppi) & 255,
      0,
      0,
    ]);
    return join([bytes.slice(0, 2), app, bytes.slice(2)]);
  }
  return new Uint8Array(bytes);
}
export function imageDensityDataURL(url, type, ppi) {
  if (!["png", "jpeg"].includes(type)) return url;
  const binary = atob(url.split(",")[1]),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    out = setDensity(bytes, type, ppi);
  let text = "";
  for (let i = 0; i < out.length; i += 16384)
    text += String.fromCharCode(...out.subarray(i, i + 16384));
  return `data:image/${type};base64,${btoa(text)}`;
}

export function readDensity(bytes) {
  if (
    bytes.length > 33 &&
    bytes[0] === 137 &&
    String.fromCharCode(...bytes.slice(1, 4)) === "PNG"
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let pos = 8; pos + 12 <= bytes.length; ) {
      const length = view.getUint32(pos);
      if (pos + 12 + length > bytes.length) break;
      const name = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
      if (name === "pHYs" && length === 9 && bytes[pos + 16] === 1) {
        const ppi = view.getUint32(pos + 8) * 0.0254;
        return ppi >= 1 && ppi <= 2400 ? Math.round(ppi) : null;
      }
      pos += 12 + length;
    }
  }
  if (bytes[0] === 255 && bytes[1] === 216)
    for (let pos = 2; pos + 18 <= bytes.length; ) {
      if (bytes[pos] !== 255) break;
      const marker = bytes[pos + 1],
        length = (bytes[pos + 2] << 8) | bytes[pos + 3];
      if (marker === 218 || length < 2 || pos + 2 + length > bytes.length)
        break;
      const start = pos + 4;
      if (
        marker === 224 &&
        length >= 16 &&
        String.fromCharCode(...bytes.slice(start, start + 5)) === "JFIF\0"
      ) {
        const density = (bytes[start + 8] << 8) | bytes[start + 9],
          ppi =
            bytes[start + 7] === 1
              ? density
              : bytes[start + 7] === 2
                ? density * 2.54
                : null;
        return ppi >= 1 && ppi <= 2400 ? Math.round(ppi) : null;
      }
      pos += 2 + length;
    }
  return null;
}
