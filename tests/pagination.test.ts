import { describe, expect, it } from "vitest";

import { paginate } from "../src/ui/pagination";

describe("paginate", () => {
	it("returns at most ten items and preserves their ranked order", () => {
		const items = Array.from({ length: 23 }, (_value, index) => index + 1);
		expect(paginate(items, 1)).toEqual({
			items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
			page: 1,
			pageCount: 3,
		});
	});

	it("clamps a stale page when a new result set is shorter", () => {
		expect(paginate(["a"], 3)).toEqual({ items: ["a"], page: 0, pageCount: 1 });
	});
});
