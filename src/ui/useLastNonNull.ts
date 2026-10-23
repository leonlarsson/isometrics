import { useRef } from "react";

/**
 * `value`, or the last one that wasn't null. For popups whose content comes
 * from state cleared on close: they keep their place and content while they
 * animate closed, instead of jumping to the top-left corner empty.
 */
export const useLastNonNull = <T>(value: T | null): T | null => {
	const last = useRef(value);
	if (value !== null) {
		last.current = value;
	}
	return value ?? last.current;
};
