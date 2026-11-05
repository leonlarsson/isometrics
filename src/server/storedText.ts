/**
 * What's shared is kept gzipped (ADR-0145): JSON of worlds shrinks about
 * thirteen times (Stockholm, 519 kB, keeps as about 40 kB), so a share costs
 * that much less to keep. Entries kept before were plain text and are still
 * read: gzip starts with the bytes 1f 8b, which no JSON text does, so each is
 * read as what it is whatever its metadata says. Only what we gzipped
 * ourselves is ever unzipped, so its size is known. No Cloudflare imports here
 * (`CompressionStream` is the web's, in Workers and Node alike).
 */

/** How kept entries say they're gzipped, in their metadata (older entries say nothing). */
export const GZIP = "gzip";

const readAll = async (stream: ReadableStream<Uint8Array>) =>
	new Uint8Array(await new Response(stream).arrayBuffer());

/** A text as gzip, for keeping. */
export const gzipText = async (text: string): Promise<Uint8Array> =>
	readAll(
		new Blob([new TextEncoder().encode(text)])
			.stream()
			.pipeThrough(new CompressionStream("gzip")) as ReadableStream<Uint8Array>,
	);

/** Whether kept bytes are gzip: they start with its magic bytes. */
export const isGzip = (bytes: Uint8Array) =>
	bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

/** A kept entry's text: unzipped when it's gzip, read as UTF-8 when it's plain text (kept before). */
export const textOfStored = async (stored: ArrayBuffer | Uint8Array): Promise<string> => {
	const bytes = stored instanceof Uint8Array ? stored : new Uint8Array(stored);
	if (!isGzip(bytes)) {
		return new TextDecoder().decode(bytes);
	}
	const unzipped = await readAll(
		new Blob([bytes])
			.stream()
			.pipeThrough(new DecompressionStream("gzip")) as ReadableStream<Uint8Array>,
	);
	return new TextDecoder().decode(unzipped);
};
