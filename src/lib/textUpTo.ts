/**
 * A body's text, read only up to `limit` bytes (ADR-0119): one that says it's
 * bigger is refused before reading, and one that doesn't say stops being read
 * once it passes the limit, so no one can fill memory by sending more. Null
 * when it's too big. For requests (the server) and responses (links) alike.
 */
export const textUpTo = async (
	message: Pick<Request, "body" | "headers" | "text">,
	limit: number,
): Promise<string | null> => {
	if (Number(message.headers.get("content-length") ?? 0) > limit) {
		return null;
	}
	if (!message.body) {
		return message.text();
	}
	const reader = message.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const all = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		all.set(chunk, at);
		at += chunk.byteLength;
	}
	return new TextDecoder().decode(all);
};
