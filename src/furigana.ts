export interface FuriganaToken {
	word: string;
	reading: string;
}

const FURIGANA_PATTERN = /\{([^{}|\n]+)\|([^{}|\n]+)\}/g;

export function splitFuriganaText(text: string): Array<string | FuriganaToken> {
	const parts: Array<string | FuriganaToken> = [];
	let cursor = 0;
	for (const match of text.matchAll(FURIGANA_PATTERN)) {
		const index = match.index ?? 0;
		if (index > cursor) parts.push(text.slice(cursor, index));
		parts.push({ word: match[1], reading: match[2] });
		cursor = index + match[0].length;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts.length > 0 ? parts : [text];
}

export function renderFuriganaInElement(root: HTMLElement): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	for (let current = walker.nextNode(); current; current = walker.nextNode()) {
		if (current.parentElement?.closest("code, pre, .frontmatter")) continue;
		if (FURIGANA_PATTERN.test(current.textContent ?? "")) textNodes.push(current as Text);
		FURIGANA_PATTERN.lastIndex = 0;
	}

	for (const node of textNodes) {
		const fragment = document.createDocumentFragment();
		for (const part of splitFuriganaText(node.textContent ?? "")) {
			if (typeof part === "string") fragment.appendText(part);
			else {
				const ruby = document.createElement("ruby");
				ruby.className = "kotoba-insert-furigana";
				ruby.textContent = part.word;
				const rt = document.createElement("rt");
				rt.textContent = part.reading;
				ruby.append(rt);
				fragment.append(ruby);
			}
		}
		node.replaceWith(fragment);
	}
}
