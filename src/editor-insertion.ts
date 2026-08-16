import type { Editor, EditorPosition } from "obsidian";

export function replaceSelectionAndPlaceCursor(editor: Editor, text: string): void {
	const start = editor.getCursor("from");
	editor.replaceSelection(text);
	editor.setCursor(cursorAfterText(start, text));
}

export function cursorAfterText(start: EditorPosition, text: string): EditorPosition {
	const lines = text.split("\n");
	if (lines.length === 1) return { line: start.line, ch: start.ch + lines[0].length };
	return { line: start.line + lines.length - 1, ch: lines[lines.length - 1].length };
}
