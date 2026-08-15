import { Component, MarkdownRenderer, Modal, Notice, TFile, type App, type Editor } from "obsidian";

import type { DictionaryService } from "../dictionary/service";
import type { SearchResult } from "../dictionary/types";
import { renderFuriganaInElement } from "../furigana";
import { getTemplateFiles } from "../settings";
import { renderTemplate } from "../template";
import { paginate, RESULTS_PER_PAGE } from "./pagination";

export class LookupModal extends Modal {
	private query = "";
	private results: SearchResult[] = [];
	private resultsPage = 0;
	private selectedResult: SearchResult | null = null;
	private selectedSenses = new Set<number>();
	private templates: TFile[] = [];
	private selectedTemplatePath: string | null = null;
	private previewEl: HTMLElement | null = null;
	private previewComponent: Component | null = null;
	private previewVersion = 0;
	private insertButton: HTMLButtonElement | null = null;

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
		this.clearPreview();
		this.contentEl.empty();
	}

	private render(options: { focusSearch?: boolean; scrollToSelection?: boolean } = {}): void {
		this.clearPreview();
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
		if (options.focusSearch ?? true) window.setTimeout(() => input.focus(), 0);
		if (options.scrollToSelection) {
			window.setTimeout(() => contentEl.querySelector<HTMLElement>("[data-kotoba-selection]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
		}
	}

	private renderResultsTable(container: HTMLElement): void {
		const table = container.createEl("table", { cls: "kotoba-results-table" });
		const header = table.createEl("thead").createEl("tr");
		header.createEl("th", { text: "Word" });
		header.createEl("th", { text: "Reading" });
		header.createEl("th", { text: "Definitions" });
		const page = paginate(this.results, this.resultsPage, RESULTS_PER_PAGE);
		this.resultsPage = page.page;
		const body = table.createEl("tbody");
		for (const result of page.items) this.renderResult(body, result);
		if (page.pageCount > 1) this.renderPagination(container, page.page, page.pageCount);
	}

	private renderPagination(container: HTMLElement, page: number, pageCount: number): void {
		const navigation = container.createDiv({ cls: "kotoba-pagination" });
		navigation.setAttr("aria-label", "Search result pages");
		const previous = navigation.createEl("button", { text: "Previous" });
		previous.disabled = page === 0;
		previous.addEventListener("click", () => {
			this.resultsPage = page - 1;
			this.render({ focusSearch: false });
		});
		navigation.createSpan({ text: `Page ${page + 1} of ${pageCount}`, cls: "kotoba-muted" });
		const next = navigation.createEl("button", { text: "Next" });
		next.disabled = page === pageCount - 1;
		next.addEventListener("click", () => {
			this.resultsPage = page + 1;
			this.render({ focusSearch: false });
		});
	}

	private renderResult(container: HTMLElement, result: SearchResult): void {
		const row = container.createEl("tr", { cls: "kotoba-result" });
		if (result === this.selectedResult) row.addClass("is-selected");
		const word = row.createEl("td");
		const choice = word.createEl("button", { text: result.matchedForm.written, cls: "kotoba-result-button" });
		choice.addEventListener("click", () => {
			this.selectedResult = result;
			this.selectedSenses = new Set(result.entry.senses.length > 0 ? [0] : []);
			this.render({ focusSearch: false, scrollToSelection: true });
		});
		row.createEl("td", { text: result.matchedForm.reading });
		const firstDefinition = result.entry.senses[0]?.definitions.join("; ");
		row.createEl("td", { text: firstDefinition || "No English definition", cls: "kotoba-muted" });
	}

	private renderSelection(container: HTMLElement): void {
		const result = this.selectedResult;
		if (!result) return;
		const selection = container.createDiv({ cls: "kotoba-selection" });
		selection.setAttr("data-kotoba-selection", "");
		selection.createEl("h3", { text: "Select meanings" });
		result.entry.senses.forEach((sense, index) => {
			const card = selection.createDiv({ cls: "kotoba-sense" });
			const label = card.createEl("label");
			const checkbox = label.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedSenses.has(index);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) this.selectedSenses.add(index);
				else this.selectedSenses.delete(index);
				if (this.insertButton) this.insertButton.disabled = this.selectedSenses.size === 0;
				void this.updatePreview();
			});
			label.createSpan({ text: sense.definitions.join("; ") || "No English definition" });
			const tags = [...sense.partOfSpeech, ...sense.fieldTags, ...sense.usageTags];
			if (tags.length > 0) card.createDiv({ text: tags.join("; "), cls: "kotoba-muted" });
		});

		selection.createEl("h3", { text: "Template" });
		if (this.templates.length === 0) {
			selection.createEl("p", { text: `No Markdown templates found in ${this.templateFolder()}. Create Default.md from Kotoba Insert settings.`, cls: "kotoba-muted" });
			return;
		}
		const select = selection.createEl("select");
		select.setAttr("aria-label", "Template");
		for (const template of this.templates) {
			const option = select.createEl("option", { text: template.path, value: template.path });
			option.selected = template.path === this.selectedTemplatePath;
		}
		select.addEventListener("change", () => {
			this.selectedTemplatePath = select.value;
			void this.updatePreview();
		});

		const preview = selection.createDiv({ cls: "kotoba-insertion-preview" });
		preview.createEl("h4", { text: "Preview" });
		this.previewEl = preview.createDiv({ cls: "kotoba-insertion-preview-content" });
		void this.updatePreview();

		const actions = selection.createDiv({ cls: "kotoba-actions" });
		this.insertButton = actions.createEl("button", { text: "Insert", cls: "mod-cta" });
		this.insertButton.disabled = this.selectedSenses.size === 0;
		this.insertButton.addEventListener("click", () => void this.insert());
	}

	private async updatePreview(): Promise<void> {
		const preview = this.previewEl;
		const result = this.selectedResult;
		const path = this.selectedTemplatePath;
		const version = ++this.previewVersion;
		this.previewComponent?.unload();
		this.previewComponent = null;
		if (!preview || !result || !path) return;

		preview.empty();
		const senses = this.selectedSensesFor(result);
		if (senses.length === 0) {
			preview.createEl("p", { text: "Select at least one meaning to preview the insertion.", cls: "kotoba-muted" });
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			preview.createEl("p", { text: "The selected template is no longer available.", cls: "kotoba-muted" });
			return;
		}

		preview.createEl("p", { text: "Updating preview…", cls: "kotoba-muted" });
		try {
			const template = await this.app.vault.read(file);
			if (version !== this.previewVersion || preview !== this.previewEl) return;
			const rendered = renderTemplate(template, { form: result.matchedForm, allForms: result.entry.forms, senses });
			preview.empty();
			const component = new Component();
			component.load();
			this.previewComponent = component;
			await MarkdownRenderer.render(this.app, rendered, preview, "", component);
			if (version !== this.previewVersion || preview !== this.previewEl) return;
			renderFuriganaInElement(preview);
		} catch (error) {
			if (version !== this.previewVersion || preview !== this.previewEl) return;
			preview.empty();
			preview.createEl("p", { text: `Unable to render preview: ${error instanceof Error ? error.message : String(error)}`, cls: "kotoba-muted" });
		}
	}

	private selectedSensesFor(result: SearchResult): SearchResult["entry"]["senses"] {
		return [...this.selectedSenses]
			.sort((left, right) => left - right)
			.map((index) => result.entry.senses[index])
			.filter((sense): sense is SearchResult["entry"]["senses"][number] => Boolean(sense));
	}

	private clearPreview(): void {
		this.previewVersion += 1;
		this.previewComponent?.unload();
		this.previewComponent = null;
		this.previewEl = null;
		this.insertButton = null;
	}

	private async search(): Promise<void> {
		try {
			this.results = await this.dictionary.search(this.query);
			this.resultsPage = 0;
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
		if (!(file instanceof TFile)) {
			new Notice("The selected template is no longer available.");
			return;
		}
		const template = await this.app.vault.read(file);
		const senses = this.selectedSensesFor(result);
		const rendered = renderTemplate(template, { form: result.matchedForm, allForms: result.entry.forms, senses });
		this.editor.replaceRange(rendered, this.editor.getCursor());
		this.close();
	}
}
