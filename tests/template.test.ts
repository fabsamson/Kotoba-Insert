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
});
