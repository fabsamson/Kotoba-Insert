import { describe, expect, it } from "vitest";

import { formContainsQuery } from "../src/dictionary/matching";

const form = { written: "\u98df\u3079\u308b", reading: "\u305f\u3079\u308b", priority: [] };

describe("formContainsQuery", () => {
	it("matches a partial written form", () => {
		expect(formContainsQuery(form, "\u98df\u3079")).toBe(true);
	});

	it("matches a partial reading", () => {
		expect(formContainsQuery(form, "\u305f\u3079")).toBe(true);
	});

	it("does not match unrelated text", () => {
		expect(formContainsQuery(form, "\u98aa")).toBe(false);
	});
});
