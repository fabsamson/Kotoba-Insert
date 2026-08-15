import { describe, expect, it } from "vitest";

import { renderTemplate } from "../src/template";

describe("renderTemplate", () => {
	it("renders selected multi-sense definitions with semicolons", () => {
		const rendered = renderTemplate("{{word_with_furigana}} — {{english_definitions}} / {{part_of_speech}}", {
			form: { written: "欠落", reading: "けつらく", priority: [] },
			allForms: [],
			senses: [{
				definitions: ["lack", "absence"],
				partOfSpeech: ["noun"],
				fieldTags: [], usageTags: [], senseNotes: [], crossReferences: [], antonyms: [],
			}, {
				definitions: ["omission"],
				partOfSpeech: ["noun"],
				fieldTags: [], usageTags: [], senseNotes: [], crossReferences: [], antonyms: [],
			}],
		});
		expect(rendered).toBe("{欠落|けつらく} — lack; absence; omission / noun");
	});

	it("renders commonness labels from the selected form", () => {
		const rendered = renderTemplate("{{commonness}}", {
			form: { written: "\u304a\u4f7f\u3044", reading: "\u304a\u3064\u304b\u3044", priority: [], commonness: ["spec", "news18k"] },
			allForms: [],
			senses: [],
		});
		expect(rendered).toBe("spec; news18k");
	});

	it("uses verified per-segment furigana alignment when present", () => {
		const rendered = renderTemplate("{{word_with_furigana}}", {
			form: {
				written: "食べる",
				reading: "たべる",
				priority: [],
				furigana: [{ ruby: "食", rt: "た" }, { ruby: "べる" }],
			},
			allForms: [],
			senses: [],
		});
		expect(rendered).toBe("{食|た}べる");
	});

	it("falls back to whole-word furigana when alignment does not match the selected reading", () => {
		const rendered = renderTemplate("{{word_with_furigana}}", {
			form: {
				written: "食べる",
				reading: "たべる",
				priority: [],
				furigana: [{ ruby: "食", rt: "しょく" }, { ruby: "べる" }],
			},
			allForms: [],
			senses: [],
		});
		expect(rendered).toBe("{食べる|たべる}");
	});
});
