import type { DictionaryForm, DictionarySense } from "./dictionary/types";

export const DEFAULT_TEMPLATE = "{{word_with_furigana}} — {{english_definitions}}";

const FIELD_PATTERN = /\{\{([a-z_]+)\}\}/g;

export interface TemplateSelection {
	form: DictionaryForm;
	allForms: DictionaryForm[];
	senses: DictionarySense[];
}

export function renderTemplate(template: string, selection: TemplateSelection): string {
	const fields = createFields(selection);
	return template.replace(FIELD_PATTERN, (_match, field: string) => fields[field] ?? "");
}

export function createFields(selection: TemplateSelection): Record<string, string> {
	const definitions = unique(selection.senses.flatMap((sense) => sense.definitions));
	return {
		word: selection.form.written,
		reading: selection.form.reading,
		word_with_furigana: formatWordWithFurigana(selection.form),
		english_definitions: join(definitions),
		english_definition_1: definitions[0] ?? "",
		part_of_speech: join(selection.senses.flatMap((sense) => sense.partOfSpeech)),
		alternate_forms: join(selection.allForms
			.filter((form) => form.written !== selection.form.written)
			.map((form) => form.reading === form.written ? form.written : `${form.written} (${form.reading})`)),
		priority: join(selection.form.priority),
		commonness: join(selection.form.commonness ?? []),
		cross_references: join(selection.senses.flatMap((sense) => sense.crossReferences)),
		antonyms: join(selection.senses.flatMap((sense) => sense.antonyms)),
		field_tags: join(selection.senses.flatMap((sense) => sense.fieldTags)),
		usage_tags: join(selection.senses.flatMap((sense) => sense.usageTags)),
		sense_notes: join(selection.senses.flatMap((sense) => sense.senseNotes)),
	};
}

function formatWordWithFurigana(form: DictionaryForm): string {
	const segments = form.furigana;
	if (!segments || segments.length === 0 || !isVerifiedAlignment(segments, form)) {
		return `{${form.written}|${form.reading}}`;
	}
	return segments.map((segment) => segment.rt ? `{${segment.ruby}|${segment.rt}}` : segment.ruby).join("");
}

function isVerifiedAlignment(segments: NonNullable<DictionaryForm["furigana"]>, form: DictionaryForm): boolean {
	return segments.map((segment) => segment.ruby).join("") === form.written
		&& segments.map((segment) => segment.rt ?? segment.ruby).join("") === form.reading;
}

function join(values: string[]): string {
	return unique(values).join("; ");
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}
