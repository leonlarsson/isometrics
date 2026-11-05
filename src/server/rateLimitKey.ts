/**
 * Who a rate limit counts a request against (ADR-0145): an IPv4 address on its
 * own, but an IPv6 address by its /64, the block one home or one server is
 * normally given, so changing the last 64 bits (which anyone with a /64 can do
 * at will) doesn't make a new sender. An IPv4 address written as IPv6
 * (`::ffff:192.0.2.1`) counts as the IPv4 one. Anything else (no address, one
 * that doesn't parse) shares one key, "unknown". No Cloudflare imports here.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** An IPv4 address as written, or null when it isn't one. */
const ipv4Of = (text: string) => {
	const match = IPV4.exec(text);
	if (!match) {
		return null;
	}
	const parts = match.slice(1).map(Number);
	return parts.every((part) => part <= 255) ? parts.join(".") : null;
};

/** An IPv6 address's eight groups as numbers, or null when it isn't one. */
const ipv6GroupsOf = (text: string): number[] | null => {
	// A zone ("%eth0") says nothing about who sent it.
	const address = text.split("%")[0].toLowerCase();
	if (!/^[0-9a-f:.]+$/.test(address) || address.split("::").length > 2) {
		return null;
	}
	const groupsOf = (part: string): number[] | null => {
		if (part === "") {
			return [];
		}
		const groups: number[] = [];
		const pieces = part.split(":");
		for (const [index, piece] of pieces.entries()) {
			// An IPv4 address may end it, as its last two groups.
			const ipv4 = index === pieces.length - 1 ? ipv4Of(piece) : null;
			if (ipv4) {
				const [a, b, c, d] = ipv4.split(".").map(Number);
				groups.push(a * 256 + b, c * 256 + d);
			} else if (/^[0-9a-f]{1,4}$/.test(piece)) {
				groups.push(Number.parseInt(piece, 16));
			} else {
				return null;
			}
		}
		return groups;
	};
	const [head, tail] = address.split("::");
	const before = groupsOf(head);
	const after = tail === undefined ? [] : groupsOf(tail);
	if (!before || !after) {
		return null;
	}
	if (tail === undefined) {
		return before.length === 8 ? before : null;
	}
	const missing = 8 - before.length - after.length;
	return missing >= 1 ? [...before, ...new Array<number>(missing).fill(0), ...after] : null;
};

/** The key a rate limit counts `address` (the request's `cf-connecting-ip`) against. */
export const rateLimitKeyOf = (address: string | null | undefined): string => {
	const text = (address ?? "").trim();
	const ipv4 = ipv4Of(text);
	if (ipv4) {
		return ipv4;
	}
	const groups = ipv6GroupsOf(text);
	if (!groups) {
		return "unknown";
	}
	// An IPv4-mapped address (::ffff:a.b.c.d) is that IPv4 address.
	if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
		return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join(".");
	}
	return `${groups
		.slice(0, 4)
		.map((group) => group.toString(16))
		.join(":")}::/64`;
};
