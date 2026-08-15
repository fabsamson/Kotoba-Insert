import type { DictionaryForm } from "./types";

export function formContainsQuery(form: DictionaryForm, query: string): boolean {
	return form.written.includes(query) || form.reading.includes(query);
}
