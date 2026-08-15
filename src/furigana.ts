export interface FuriganaToken {
	word: string;
	reading: string;
}

export interface FuriganaMatch extends FuriganaToken {
	from: number;
	to: number;
}

const FURIGANA_PATTERN_SOURCE = "\\{([^{}|\\n]+)\\|([^{}|\\n]+)\\}";

export function findFuriganaTokens(text: string, offset = 0): FuriganaMatch[] {
	const matches: FuriganaMatch[] = [];
	const matcher = new RegExp(FURIGANA_PATTERN_SOURCE, "g");
	for (let match = matcher.exec(text); match; match = matcher.exec(text)) {
		const from = offset + match.index;
		matches.push({ word: match[1], reading: match[2], from, to: from + match[0].length });
	}
	return matches;
}

export function splitFuriganaText(text: string): Array<string | FuriganaToken> {
	const parts: Array<string | FuriganaToken> = [];
	let cursor = 0;
	for (const match of findFuriganaTokens(text)) {
		if (match.from > cursor) parts.push(text.slice(cursor, match.from));
		parts.push({ word: match.word, reading: match.reading });
		cursor = match.to;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts.length > 0 ? parts : [text];
}

export function renderFuriganaInElement(root: HTMLElement): void {
	const walker = root.doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	for (let current = walker.nextNode(); current; current = walker.nextNode()) {
		if (current.parentElement?.closest("code, pre, .frontmatter")) continue;
		if (findFuriganaTokens(current.textContent ?? "").length > 0) textNodes.push(current as Text);
	}

	for (const node of textNodes) {
		const fragment = createFragment();
		for (const part of splitFuriganaText(node.textContent ?? "")) {
			if (typeof part === "string") fragment.appendText(part);
			else {
				const ruby = createEl("ruby", { cls: "kotoba-insert-furigana", text: part.word });
				ruby.createEl("rt", { text: part.reading });
				fragment.append(ruby);
			}
		}
		node.replaceWith(fragment);
	}
}
