export const RESULTS_PER_PAGE = 10;

export interface Page<T> {
	items: T[];
	page: number;
	pageCount: number;
}

export function paginate<T>(items: T[], requestedPage: number, pageSize = RESULTS_PER_PAGE): Page<T> {
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
	const start = page * pageSize;
	return { items: items.slice(start, start + pageSize), page, pageCount };
}
