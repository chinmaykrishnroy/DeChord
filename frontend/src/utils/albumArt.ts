function readAscii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function readSynchsafeInt(bytes: Uint8Array, start: number) {
  return (
    ((bytes[start] & 0x7f) << 21) |
    ((bytes[start + 1] & 0x7f) << 14) |
    ((bytes[start + 2] & 0x7f) << 7) |
    (bytes[start + 3] & 0x7f)
  );
}

function readBigEndianInt(bytes: Uint8Array, start: number) {
  return (
    (bytes[start] << 24) |
    (bytes[start + 1] << 16) |
    (bytes[start + 2] << 8) |
    bytes[start + 3]
  ) >>> 0;
}

function findTerminator(bytes: Uint8Array, start: number, encoding: number) {
  if (encoding === 1 || encoding === 2) {
    for (let index = start; index < bytes.length - 1; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) {
        return index + 2;
      }
    }
    return -1;
  }

  const index = bytes.indexOf(0, start);
  return index === -1 ? -1 : index + 1;
}

function parseApicFrame(frame: Uint8Array): string | null {
  if (frame.length < 8) {
    return null;
  }

  const encoding = frame[0];
  const mimeEnd = frame.indexOf(0, 1);
  if (mimeEnd === -1) {
    return null;
  }

  const mime = readAscii(frame, 1, mimeEnd - 1) || "image/jpeg";
  const descriptionStart = mimeEnd + 2;
  const imageStart = findTerminator(frame, descriptionStart, encoding);
  if (imageStart === -1 || imageStart >= frame.length) {
    return null;
  }

  const imageBytes = frame.slice(imageStart);
  const blob = new Blob([imageBytes], { type: mime });
  return URL.createObjectURL(blob);
}

export async function extractAlbumArtUrl(file: File): Promise<string | null> {
  if (!/\.mp3$/i.test(file.name) && file.type !== "audio/mpeg") {
    return null;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 20 || readAscii(bytes, 0, 3) !== "ID3") {
    return null;
  }

  const version = bytes[3];
  const tagSize = readSynchsafeInt(bytes, 6);
  const tagEnd = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;

  while (offset + 10 <= tagEnd) {
    const frameId = readAscii(bytes, offset, 4);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) {
      break;
    }

    const frameSize =
      version === 4 ? readSynchsafeInt(bytes, offset + 4) : readBigEndianInt(bytes, offset + 4);
    const frameStart = offset + 10;
    const frameEnd = Math.min(frameStart + frameSize, tagEnd);
    if (frameSize <= 0 || frameEnd <= frameStart) {
      break;
    }

    if (frameId === "APIC") {
      return parseApicFrame(bytes.slice(frameStart, frameEnd));
    }

    offset = frameEnd;
  }

  return null;
}
