import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

import { findFuriganaTokens } from "./furigana";

class FuriganaWidget extends WidgetType {
	public constructor(
		private readonly word: string,
		private readonly reading: string,
	) {
		super();
	}

	public eq(other: FuriganaWidget): boolean {
		return this.word === other.word && this.reading === other.reading;
	}

	public toDOM(_view: EditorView): HTMLElement {
		const ruby = createEl("ruby", { cls: "kotoba-insert-furigana kotoba-insert-live-preview-furigana", text: this.word });
		ruby.createEl("rt", { text: this.reading });
		return ruby;
	}

	public ignoreEvent(): boolean {
		return false;
	}
}

class FuriganaLivePreviewPlugin {
	public decorations: DecorationSet;

	public constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	public update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	private buildDecorations(view: EditorView): DecorationSet {
		if (!view.state.field(editorLivePreviewField, false)) return Decoration.none;
		const builder = new RangeSetBuilder<Decoration>();
		for (const { from, to } of view.visibleRanges) {
			const text = view.state.doc.sliceString(from, to);
			for (const token of findFuriganaTokens(text, from)) {
				if (selectionTouchesToken(view, token.from, token.to)) continue;
				builder.add(token.from, token.to, Decoration.replace({ widget: new FuriganaWidget(token.word, token.reading) }));
			}
		}
		return builder.finish();
	}
}

function selectionTouchesToken(view: EditorView, from: number, to: number): boolean {
	return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

export const furiganaLivePreview = ViewPlugin.fromClass(FuriganaLivePreviewPlugin, {
	decorations: (value) => value.decorations,
});
