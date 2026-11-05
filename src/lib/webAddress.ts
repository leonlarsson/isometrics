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
 * A link's words when its name comes from untrusted data (ADR-0145): the
 * name with the link's host after it, "Statistics Sweden (scb.se)", so a
 * name can't pass a link off as another site's. Just the host when it has no
 * name, or the name is the host.
 */
export const linkWords = (name: string | null | undefined, address: string) => {
	let host: string;
	try {
		host = new URL(address).host;
	} catch {
		return name || address;
	}
	const named = (name ?? "").trim();
	return named && named.toLowerCase() !== host.toLowerCase() ? `${named} (${host})` : host;
};

/**
 * An IPv4 address written as IPv6 (`::ffff:127.0.0.1`, which URLs write
 * `::ffff:7f00:1`) as plain IPv4, so it's checked as the address it reaches.
 */
const ipv4Of = (host: string) => {
	const mapped =
		/^::ffff:(?:0:)?(?:(\d{1,3}(?:\.\d{1,3}){3})|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(host);
	if (!mapped) {
		return host;
	}
	if (mapped[1]) {
		return mapped[1];
	}
	const [high, low] = [Number.parseInt(mapped[2], 16), Number.parseInt(mapped[3], 16)];
	return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
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
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ipv4Of(host));
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
