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

/**
 * Whether a host is this computer or its own network (ADR-0119): localhost,
 * loopback, private and link-local addresses, `.local` names. A world from
 * anyone mustn't make a browser on the web reach into the network it sits on.
 */
export const isLocalHost = (hostname: string) => {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
		return true;
	}
	if (
		host === "::1" ||
		host === "::" ||
		/^f[cd][0-9a-f]{2}:/.test(host) ||
		/^fe[89ab][0-9a-f]:/.test(host)
	) {
		return true;
	}
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!ipv4) {
		return false;
	}
	const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
};
