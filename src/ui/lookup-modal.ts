import { Modal, Notice, type App, type Editor, type TFile } from "obsidian";

import type { DictionaryService } from "../dictionary/service";
import type { SearchResult } from "../dictionary/types";
import { getTemplateFiles } from "../settings";
import { renderTemplate } from "../template";

export class LookupModal extends Modal {
	private query = "";
	private results: SearchResult[] = [];
	private selectedResult: SearchResult | null = null;
	private selectedSenses = new Set<number>();
	private templates: TFile[] = [];
	private selectedTemplatePath: string | null = null;

	public constructor(
		app: App,
		private readonly editor: Editor,
		private readonly dictionary: DictionaryService,
		private readonly templateFolder: () => string,
	) {
		super(app);
	}

	public async onOpen(): Promise<void> {
		this.modalEl.addClass("kotoba-insert-modal");
		this.templates = getTemplateFiles(this.app, this.templateFolder());
		this.selectedTemplatePath = this.templates[0]?.path ?? null;
		this.render();
	}

	public onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Kotoba Insert" });
		contentEl.createEl("p", { text: "Search any part of a Japanese word or reading." });

		const searchRow = contentEl.createDiv({ cls: "kotoba-search-row" });
		const input = searchRow.createEl("input", { type: "text", placeholder: "e.g. 食べる" });
		input.value = this.query;
		input.addEventListener("input", () => { this.query = input.value; });
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") void this.search();
		});
		const button = searchRow.createEl("button", { text: "Search", cls: "mod-cta" });
		button.addEventListener("click", () => void this.search());

		const resultsEl = contentEl.createDiv({ cls: "kotoba-results" });
		if (this.results.length === 0 && this.query.trim()) resultsEl.createEl("p", { text: "No matches found.", cls: "kotoba-muted" });
		if (this.results.length > 0) this.renderResultsTable(resultsEl);
		if (this.selectedResult) this.renderSelection(contentEl);
		window.setTimeout(() => input.focus(), 0);
	}

	private renderResultsTable(container: HTMLElement): void {
		const table = container.createEl("table", { cls: "kotoba-results-table" });
		const header = table.createEl("thead").createEl("tr");
		header.createEl("th", { text: "Word" });
		header.createEl("th", { text: "Reading" });
		header.createEl("th", { text: "Definitions" });
		const body = table.createEl("tbody");
		for (const result of this.results) this.renderResult(body, result);
	}

	private renderResult(container: HTMLElement, result: SearchResult): void {
		const row = container.createEl("tr", { cls: "kotoba-result" });
		if (result === this.selectedResult) row.addClass("is-selected");
		const word = row.createEl("td");
		const choice = word.createEl("button", { text: result.matchedForm.written, cls: "kotoba-result-button" });
		choice.addEventListener("click", () => {
			this.selectedResult = result;
			this.selectedSenses = new Set(result.entry.senses.length > 0 ? [0] : []);
			this.render();
		});
		row.createEl("td", { text: result.matchedForm.reading });
		const firstDefinition = result.entry.senses[0]?.definitions.join("; ");
		row.createEl("td", { text: firstDefinition || "No English definition", cls: "kotoba-muted" });
	}

	private renderSelection(container: HTMLElement): void {
		const result = this.selectedResult;
		if (!result) return;
		container.createEl("h3", { text: "Select meanings" });
		result.entry.senses.forEach((sense, index) => {
			const card = container.createDiv({ cls: "kotoba-sense" });
			const label = card.createEl("label");
			const checkbox = label.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedSenses.has(index);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) this.selectedSenses.add(index);
				else this.selectedSenses.delete(index);
			});
			label.createSpan({ text: sense.definitions.join("; ") || "No English definition" });
			const tags = [...sense.partOfSpeech, ...sense.fieldTags, ...sense.usageTags];
			if (tags.length > 0) card.createEl("div", { text: tags.join("; "), cls: "kotoba-muted" });
		});

		container.createEl("h3", { text: "Template" });
		if (this.templates.length === 0) {
			container.createEl("p", { text: `No Markdown templates found in ${this.templateFolder()}. Create Default.md from Kotoba Insert settings.`, cls: "kotoba-muted" });
			return;
		}
		const select = container.createEl("select");
		for (const template of this.templates) {
			const option = select.createEl("option", { text: template.path, value: template.path });
			option.selected = template.path === this.selectedTemplatePath;
		}
		select.addEventListener("change", () => { this.selectedTemplatePath = select.value; });

		const actions = container.createDiv({ cls: "kotoba-actions" });
		const insert = actions.createEl("button", { text: "Insert", cls: "mod-cta" });
		insert.disabled = this.selectedSenses.size === 0;
		insert.addEventListener("click", () => void this.insert());
	}

	private async search(): Promise<void> {
		try {
			this.results = await this.dictionary.search(this.query);
			this.selectedResult = null;
			this.selectedSenses.clear();
			this.render();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async insert(): Promise<void> {
		const result = this.selectedResult;
		const path = this.selectedTemplatePath;
		if (!result || !path || this.selectedSenses.size === 0) return;
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !("extension" in file)) {
			new Notice("The selected template is no longer available.");
			return;
		}
		const template = await this.app.vault.read(file as TFile);
		const senses = [...this.selectedSenses].map((index) => result.entry.senses[index]).filter(Boolean);
		const rendered = renderTemplate(template, { form: result.matchedForm, allForms: result.entry.forms, senses });
		this.editor.replaceRange(rendered, this.editor.getCursor());
		this.close();
	}
}
