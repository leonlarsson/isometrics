/**
 * An address from untrusted data (a world someone sent, an AI's answer) as a
 * link, only if it's a web address (ADR-0119): `https:` or `http:`, never
 * `javascript:`, `data:` or anything else. Null otherwise.
 */
export const webAddress = (address: string | null | undefined): string | null => {
	if (!address) {
		return null;
	}
	try {
		const { protocol } = new URL(address);
		return protocol === "https:" || protocol === "http:" ? address : null;
	} catch {
		return null;
	}
};
