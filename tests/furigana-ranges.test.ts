import { describe, expect, it } from "vitest";

import { findFuriganaTokens } from "../src/furigana";

describe("findFuriganaTokens", () => {
	it("reports document positions for Live Preview decorations", () => {
		expect(findFuriganaTokens("A {\u98df\u3079\u308b|\u305f\u3079\u308b} B", 10)).toEqual([
			{ word: "\u98df\u3079\u308b", reading: "\u305f\u3079\u308b", from: 12, to: 21 },
		]);
	});
});
