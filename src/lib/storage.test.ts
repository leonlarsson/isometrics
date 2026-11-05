import { afterEach, describe, expect, it, vi } from "vitest";

import { storageAvailable } from "./storage";

describe("whether the browser keeps anything (ADR-0145)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("says no where there's no storage, or touching it throws", () => {
		vi.stubGlobal("localStorage", undefined);
		expect(storageAvailable()).toBe(false);
		const blocked = {
			getItem: () => {
				throw new DOMException("The operation is insecure.", "SecurityError");
			},
		};
		vi.stubGlobal("sessionStorage", blocked);
		expect(storageAvailable("sessionStorage")).toBe(false);
	});

	it("says no when even looking at it throws, as blocked site data does", () => {
		const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			get() {
				throw new DOMException("The operation is insecure.", "SecurityError");
			},
		});
		try {
			expect(storageAvailable()).toBe(false);
		} finally {
			if (original) {
				Object.defineProperty(globalThis, "localStorage", original);
			} else {
				Reflect.deleteProperty(globalThis, "localStorage");
			}
		}
	});

	it("says yes when it can be read", () => {
		const kept = new Map<string, string>();
		vi.stubGlobal("localStorage", { getItem: (key: string) => kept.get(key) ?? null });
		expect(storageAvailable()).toBe(true);
	});
});
