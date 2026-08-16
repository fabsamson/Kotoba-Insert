import { describe, expect, it } from "vitest";

import { cursorAfterText } from "../src/editor-insertion";

describe("cursorAfterText", () => {
	it("places the cursor at the end of a single-line insertion", () => {
		expect(cursorAfterText({ line: 4, ch: 3 }, "{食|た}べる - to eat")).toEqual({ line: 4, ch: 19 });
	});

	it("places the cursor at the end of a multi-line insertion", () => {
		expect(cursorAfterText({ line: 4, ch: 3 }, "first\nsecond")).toEqual({ line: 5, ch: 6 });
	});
});
