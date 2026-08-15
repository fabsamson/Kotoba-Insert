import { describe, expect, it } from "vitest";

import { formContainsQuery, rankSearchResults, selectMatchedForm } from "../src/dictionary/matching";
import type { DictionaryForm } from "../src/dictionary/types";

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

	it("returns an entry only once by selecting its primary partial match", () => {
		const alternate = { written: "\u98df\u3079\u3059\u304e", reading: "\u305f\u3079\u3059\u304e", priority: [] };
		expect(selectMatchedForm([form, alternate], "\u305f\u3079")).toBe(form);
	});

	it("prefers an exact alternate form over the primary partial match", () => {
		const alternate = { written: "\u98df\u3079\u3059\u304e", reading: "\u305f\u3079\u3059\u304e", priority: [] };
		expect(selectMatchedForm([form, alternate], "\u98df\u3079\u3059\u304e")).toBe(alternate);
	});

	it("ranks exact matches, common entries, frequency bands, then other partial matches", () => {
		const results = [
			result("other", { written: "\u98df\u3079\u7269", reading: "\u305f\u3079\u3082\u306e", priority: [] }),
			result("frequency", { written: "\u98df\u3079\u65b9", reading: "\u305f\u3079\u304b\u305f", priority: [], newsFrequencyBand: 3 }),
			result("common", { written: "\u98df\u3079\u904e\u304e", reading: "\u305f\u3079\u3059\u304e", priority: [], commonness: ["spec", "news24k"], newsFrequencyBand: 24 }),
			result("exact", { written: "\u98df\u3079\u308b", reading: "\u305f\u3079\u308b", priority: [] }),
		];

		expect(rankSearchResults(results, "\u98df\u3079\u308b").map((searchResult) => searchResult.entry.id)).toEqual(["exact", "common", "frequency", "other"]);
	});
});

function result(id: string, matchedForm: DictionaryForm) {
	return {
		entry: {
			id,
			forms: [matchedForm],
			senses: [],
		},
		matchedForm,
	};
}
