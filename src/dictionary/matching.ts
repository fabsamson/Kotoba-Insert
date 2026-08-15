import type { DictionaryForm } from "./types";

export function formContainsQuery(form: DictionaryForm, query: string): boolean {
	return form.written.includes(query) || form.reading.includes(query);
}

export function selectMatchedForm(forms: DictionaryForm[], query: string): DictionaryForm | null {
	const matches = forms.filter((form) => formContainsQuery(form, query));
	return matches.find((form) => form.written === query || form.reading === query) ?? matches[0] ?? null;
}
