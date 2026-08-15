import { describe, expect, it } from "vitest";

import { splitFuriganaText } from "../src/furigana";

describe("splitFuriganaText", () => {
	it("preserves regular text around whole-word furigana", () => {
		expect(splitFuriganaText("Learn {欠落|けつらく} today.")).toEqual([
			"Learn ",
			{ word: "欠落", reading: "けつらく" },
			" today.",
		]);
	});

	it("does not parse incomplete syntax", () => {
		expect(splitFuriganaText("{欠落|}")).toEqual(["{欠落|}"]);
	});
});
