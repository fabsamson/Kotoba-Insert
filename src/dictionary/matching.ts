import type { DictionaryEntry, DictionaryForm, SearchResult } from "./types";

export function formContainsQuery(form: DictionaryForm, query: string): boolean {
	return form.written.includes(query) || form.reading.includes(query);
}

export function selectMatchedForm(forms: DictionaryForm[], query: string): DictionaryForm | null {
	const matches = forms.filter((form) => formContainsQuery(form, query));
	return matches.find((form) => form.written === query || form.reading === query) ?? matches[0] ?? null;
}

export function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
	return [...results].sort((left, right) => {
		const exact = exactMatchRank(left.matchedForm, query) - exactMatchRank(right.matchedForm, query);
		if (exact !== 0) return exact;
		const commonness = commonnessRank(left.entry) - commonnessRank(right.entry);
		if (commonness !== 0) return commonness;
		return newsFrequencyRank(left.entry) - newsFrequencyRank(right.entry);
	});
}

function exactMatchRank(form: DictionaryForm, query: string): number {
	return form.written === query || form.reading === query ? 0 : 1;
}

function commonnessRank(entry: DictionaryEntry): number {
	return entry.forms.some((form) => form.commonness?.some((tag) => tag === "spec" || tag === "gai")) ? 0 : 1;
}

function newsFrequencyRank(entry: DictionaryEntry): number {
	const bands = entry.forms.flatMap((form) => form.newsFrequencyBand === undefined ? [] : [form.newsFrequencyBand]);
	return bands.length > 0 ? Math.min(...bands) : Number.POSITIVE_INFINITY;
}
