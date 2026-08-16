import { Component, MarkdownRenderer, Modal, Notice, TFile, type App, type Editor } from "obsidian";

import type { AiService } from "../ai/service";
import type { DictionaryService } from "../dictionary/service";
import type { SearchResult } from "../dictionary/types";
import { renderFuriganaInElement } from "../furigana";
import { getPromptFiles, getTemplateFiles } from "../settings";
import { renderTemplate } from "../template";
import { paginate, RESULTS_PER_PAGE } from "./pagination";

type LookupTab = "dictionary" | "ai";

export class LookupModal extends Modal {
	private query = "";
	private activeTab: LookupTab;
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
	private prompts: TFile[] = [];
	private selectedPromptPath: string | null = null;
	private aiResult: string | null = null;
	private aiError: string | null = null;
	private aiLoading = false;
	private aiPreviewEl: HTMLElement | null = null;
	private aiPreviewComponent: Component | null = null;
	private aiPreviewVersion = 0;
	private aiInsertButton: HTMLButtonElement | null = null;
	private aiRequestVersion = 0;

	public constructor(
		app: App,
		private readonly editor: Editor,
		private readonly dictionary: DictionaryService,
		private readonly ai: AiService,
		private readonly templateFolder: () => string,
		private readonly promptFolder: () => string,
		initialTab: LookupTab = "dictionary",
	) {
		super(app);
		this.activeTab = initialTab;
	}

	public async onOpen(): Promise<void> {
		this.modalEl.addClass("kotoba-insert-modal");
		this.templates = getTemplateFiles(this.app, this.templateFolder());
		this.selectedTemplatePath = this.templates[0]?.path ?? null;
		this.prompts = getPromptFiles(this.app, this.promptFolder());
		this.selectedPromptPath = this.prompts[0]?.path ?? null;
		this.render();
	}

	public onClose(): void {
		this.aiRequestVersion += 1;
		this.clearPreview();
		this.clearAiPreview();
		this.contentEl.empty();
	}

	private render(options: { focusSearch?: boolean; scrollToSelection?: boolean } = {}): void {
		this.clearPreview();
		this.clearAiPreview();
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Kotoba Insert" });
		this.renderTabs(contentEl);
		const modeEl = contentEl.createDiv({ cls: "kotoba-lookup-mode" });
		modeEl.setAttr("role", "tabpanel");
		modeEl.setAttr("aria-labelledby", `kotoba-tab-${this.activeTab}`);
		const input = this.activeTab === "dictionary"
			? this.renderDictionaryMode(modeEl)
			: this.renderAiMode(modeEl);
		if (options.focusSearch ?? true) window.setTimeout(() => input.focus(), 0);
		if (options.scrollToSelection) {
			window.setTimeout(() => contentEl.querySelector<HTMLElement>("[data-kotoba-selection]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
		}
	}

	private renderTabs(container: HTMLElement): void {
		const tabs = container.createDiv({ cls: "kotoba-lookup-tabs" });
		tabs.setAttr("role", "tablist");
		tabs.setAttr("aria-label", "Lookup mode");
		for (const tab of ["dictionary", "ai"] as const) {
			const label = tab === "dictionary" ? "Dictionary" : "AI";
			const button = tabs.createEl("button", { text: label, cls: "kotoba-lookup-tab" });
			button.setAttr("id", `kotoba-tab-${tab}`);
			button.setAttr("role", "tab");
			button.setAttr("aria-selected", String(tab === this.activeTab));
			button.setAttr("aria-controls", `kotoba-panel-${tab}`);
			if (tab === this.activeTab) button.addClass("is-active");
			button.addEventListener("click", () => {
				this.activeTab = tab;
				this.render();
			});
		}
	}

	private renderDictionaryMode(container: HTMLElement): HTMLInputElement {
		container.setAttr("id", "kotoba-panel-dictionary");
		container.createEl("p", { text: "Search any part of a Japanese word or reading." });
		const input = this.createSearchRow(container, "e.g. 食べる", "Search", () => void this.searchDictionary());
		const resultsEl = container.createDiv({ cls: "kotoba-results" });
		if (this.results.length === 0 && this.query.trim()) resultsEl.createEl("p", { text: "No matches found.", cls: "kotoba-muted" });
		if (this.results.length > 0) this.renderResultsTable(resultsEl);
		if (this.query.trim()) this.renderAiFallback(resultsEl);
		if (this.selectedResult) this.renderSelection(container);
		return input;
	}

	private renderAiMode(container: HTMLElement): HTMLInputElement {
		container.setAttr("id", "kotoba-panel-ai");
		container.createEl("p", { text: "Use your selected prompt to generate a Japanese study note." });
		const input = this.createSearchRow(container, "e.g. 食べる", this.aiLoading ? "Asking AI…" : "Ask AI", () => void this.askAi(), this.aiLoading);
		const promptSetting = container.createDiv({ cls: "kotoba-ai-prompt" });
		promptSetting.createEl("label", { text: "Prompt", attr: { for: "kotoba-ai-prompt" } });
		if (this.prompts.length === 0) {
			promptSetting.createEl("p", { text: `No Markdown prompts found in ${this.promptFolder()}. Create Default.md from Kotoba Insert settings.`, cls: "kotoba-muted" });
		} else {
			const select = promptSetting.createEl("select", { attr: { id: "kotoba-ai-prompt" } });
			select.setAttr("aria-label", "AI prompt");
			for (const prompt of this.prompts) {
				const option = select.createEl("option", { text: prompt.path, value: prompt.path });
				option.selected = prompt.path === this.selectedPromptPath;
			}
			select.addEventListener("change", () => {
				this.selectedPromptPath = select.value;
				this.aiResult = null;
				this.aiError = null;
				this.render({ focusSearch: false });
			});
		}

		if (this.aiLoading) {
			container.createEl("p", { text: "Asking AI…", cls: "kotoba-muted kotoba-ai-message" });
		} else if (this.aiError) {
			container.createEl("p", { text: this.aiError, cls: "kotoba-muted kotoba-ai-message" });
		} else if (this.aiResult) {
			const preview = container.createDiv({ cls: "kotoba-insertion-preview kotoba-ai-preview" });
			preview.createEl("h3", { text: "Preview" });
			this.aiPreviewEl = preview.createDiv({ cls: "kotoba-insertion-preview-content" });
			void this.updateAiPreview();

			const actions = container.createDiv({ cls: "kotoba-actions" });
			this.aiInsertButton = actions.createEl("button", { text: "Insert at cursor", cls: "mod-cta" });
			this.aiInsertButton.addEventListener("click", () => this.insertAiResult());
		}
		this.renderAiDisclaimer(container);
		return input;
	}

	private renderAiDisclaimer(container: HTMLElement): void {
		const disclaimer = container.createEl("ul", { cls: "kotoba-ai-disclaimer" });
		disclaimer.createEl("li", { text: "External AI calls may incur charges billed to you by your provider." });
		disclaimer.createEl("li", { text: "AI answers can vary, are not reviewed by the developer, and may be inaccurate. The developer is not responsible for incorrect AI output." });
		disclaimer.createEl("li", { text: "For information only: August 2026 tests with the standard prompt and OpenAI API GPT-5.6 Luna cost less than US$0.01 per request. Your costs may differ." });
	}

	private createSearchRow(container: HTMLElement, placeholder: string, buttonText: string, onSubmit: () => void, disabled = false): HTMLInputElement {
		const searchRow = container.createDiv({ cls: "kotoba-search-row" });
		const input = searchRow.createEl("input", { type: "text", placeholder });
		input.value = this.query;
		input.addEventListener("input", () => {
			this.query = input.value;
			if (this.activeTab === "ai") this.invalidateAiResult();
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !disabled) onSubmit();
		});
		const button = searchRow.createEl("button", { text: buttonText, cls: "mod-cta" });
		button.disabled = disabled;
		button.addEventListener("click", onSubmit);
		return input;
	}

	private renderAiFallback(container: HTMLElement): void {
		const fallback = container.createDiv({ cls: "kotoba-ai-fallback" });
		fallback.createSpan({ text: "Not the result you need?" });
		const button = fallback.createEl("button", { text: `Ask AI about “${this.query.trim()}”` });
		button.addEventListener("click", () => {
			this.activeTab = "ai";
			this.render({ focusSearch: false });
		});
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
		this.insertButton.addEventListener("click", () => void this.insertDictionaryResult());
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
			await this.renderMarkdownPreview(rendered, preview, (component) => { this.previewComponent = component; });
		} catch (error) {
			if (version !== this.previewVersion || preview !== this.previewEl) return;
			preview.empty();
			preview.createEl("p", { text: `Unable to render preview: ${message(error)}`, cls: "kotoba-muted" });
		}
	}

	private async updateAiPreview(): Promise<void> {
		const preview = this.aiPreviewEl;
		const result = this.aiResult;
		const version = ++this.aiPreviewVersion;
		this.aiPreviewComponent?.unload();
		this.aiPreviewComponent = null;
		if (!preview || !result) return;
		try {
			await this.renderMarkdownPreview(result, preview, (component) => { this.aiPreviewComponent = component; });
			if (version !== this.aiPreviewVersion || preview !== this.aiPreviewEl) return;
		} catch (error) {
			if (version !== this.aiPreviewVersion || preview !== this.aiPreviewEl) return;
			preview.empty();
			preview.createEl("p", { text: `Unable to render preview: ${message(error)}`, cls: "kotoba-muted" });
		}
	}

	private async renderMarkdownPreview(markdown: string, preview: HTMLElement, setComponent: (component: Component) => void): Promise<void> {
		preview.empty();
		const component = new Component();
		component.load();
		setComponent(component);
		await MarkdownRenderer.render(this.app, markdown, preview, "", component);
		renderFuriganaInElement(preview);
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

	private clearAiPreview(): void {
		this.aiPreviewVersion += 1;
		this.aiPreviewComponent?.unload();
		this.aiPreviewComponent = null;
		this.aiPreviewEl = null;
		this.aiInsertButton = null;
	}

	private invalidateAiResult(): void {
		this.aiResult = null;
		this.aiError = null;
		this.aiPreviewVersion += 1;
		this.aiPreviewComponent?.unload();
		this.aiPreviewComponent = null;
		this.aiPreviewEl?.closest(".kotoba-ai-preview")?.remove();
		this.aiInsertButton?.closest(".kotoba-actions")?.remove();
		this.aiPreviewEl = null;
		this.aiInsertButton = null;
	}

	private async searchDictionary(): Promise<void> {
		try {
			this.results = await this.dictionary.search(this.query);
			this.resultsPage = 0;
			this.selectedResult = null;
			this.selectedSenses.clear();
			this.render();
		} catch (error) {
			new Notice(message(error));
		}
	}

	private async askAi(): Promise<void> {
		const path = this.selectedPromptPath;
		if (!path) {
			this.aiError = `No Markdown prompts found in ${this.promptFolder()}. Create Default.md from Kotoba Insert settings.`;
			this.render({ focusSearch: false });
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			this.aiError = "The selected prompt is no longer available.";
			this.render({ focusSearch: false });
			return;
		}

		const version = ++this.aiRequestVersion;
		this.aiLoading = true;
		this.aiResult = null;
		this.aiError = null;
		this.render({ focusSearch: false });
		try {
			const prompt = await this.app.vault.read(file);
			const result = await this.ai.lookup(this.query, prompt);
			if (version !== this.aiRequestVersion) return;
			this.aiResult = result;
		} catch (error) {
			if (version !== this.aiRequestVersion) return;
			this.aiError = message(error);
		} finally {
			if (version === this.aiRequestVersion) {
				this.aiLoading = false;
				this.render({ focusSearch: false });
			}
		}
	}

	private async insertDictionaryResult(): Promise<void> {
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

	private insertAiResult(): void {
		if (!this.aiResult) return;
		this.editor.replaceRange(this.aiResult, this.editor.getCursor());
		this.close();
	}
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
