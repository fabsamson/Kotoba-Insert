import { App, normalizePath, Notice, PluginSettingTab, SecretComponent, Setting, type SettingDefinitionItem, TFile, TFolder } from "obsidian";

import { renderFuriganaInElement } from "./furigana";
import type KotobaInsertPlugin from "./main";
import { DEFAULT_TEMPLATE } from "./template";

export interface KotobaSettings {
	templateFolder: string;
	promptFolder: string;
	aiApiBaseUrl: string;
	aiModel: string;
	aiApiKeySecret: string;
	dictionaryMetadataUrl: string;
	installedDictionaryVersion: string | null;
	installedDictionaryBuiltAt: string | null;
}

export const DEFAULT_SETTINGS: KotobaSettings = {
	templateFolder: "kotoba-insert-templates",
	promptFolder: "kotoba-insert-prompt",
	aiApiBaseUrl: "https://api.openai.com/v1",
	aiModel: "gpt-5.6-luna",
	aiApiKeySecret: "",
	dictionaryMetadataUrl: "https://github.com/fabsamson/kotoba-insert-data/releases/latest/download/kotoba-dictionary.metadata.json",
	installedDictionaryVersion: null,
	installedDictionaryBuiltAt: null,
};

interface TemplateFieldGuide {
	placeholder: string;
	description: string;
	example: string;
}

const TEMPLATE_FIELD_GUIDE: TemplateFieldGuide[] = [
	{ placeholder: "{{word}}", description: "Selected written form.", example: "下がり" },
	{ placeholder: "{{reading}}", description: "Selected reading.", example: "さがり" },
	{ placeholder: "{{word_with_furigana}}", description: "Verified per-segment furigana when available; otherwise Kotoba Insert whole-word syntax.", example: "{下|さ}がり" },
	{ placeholder: "{{english_definitions}}", description: "Definitions from every selected sense.", example: "fall; decline; lowering; hanging down; drooping; slanting (downward); string apron; food offering to the gods; leftovers; hand-me-downs; leaving (one's master's place for home); a little after ...; sagari; 下がり（★）; サガリ" },
	{ placeholder: "{{english_definition_1}}", description: "First English definition from the selected senses.", example: "fall" },
	{ placeholder: "{{part_of_speech}}", description: "Part-of-speech labels from the selected senses.", example: "noun (common) (futsuumeishi); noun, used as a suffix" },
	{ placeholder: "{{alternate_forms}}", description: "Other written or reading forms in the entry.", example: "サガリ" },
	{ placeholder: "{{priority}}", description: "Frequency or commonness labels for the selected form.", example: "included in Ichimango Goi Bunruishuu (１万語語彙分類集); ranked between the top 12,000 and 13,000 words in a frequency analysis of the Mainichi Shimbun (1990s)" },
	{ placeholder: "{{commonness}}", description: "Raw commonness and news-frequency tags for the selected form.", example: "spec; news18k (お使い example)" },
	{ placeholder: "{{cross_references}}", description: "Related entries referenced by the selected senses.", example: "お下がりsee: お下がり" },
	{ placeholder: "{{antonyms}}", description: "Antonyms from the selected senses.", example: "上がり" },
	{ placeholder: "{{field_tags}}", description: "Subject-field labels from the selected senses.", example: "sumo" },
	{ placeholder: "{{usage_tags}}", description: "Usage labels from the selected senses.", example: "go (game); word usually written using kana alone; other surface forms and readings" },
	{ placeholder: "{{sense_notes}}", description: "Notes attached to the selected senses.", example: "ornamental cords hanging from the front of a sumo wrestler's belt; usu. as お下がり; usu. サガリ; to extend a group of stones towards the edge of the board" },
];

export class KotobaSettingTab extends PluginSettingTab {
	public constructor(private readonly plugin: KotobaInsertPlugin) {
		super(plugin.app, plugin);
	}

	public getSettingDefinitions(): SettingDefinitionItem[] {
		const installed = this.plugin.settings.installedDictionaryVersion
			? `Installed: ${this.plugin.settings.installedDictionaryVersion} (${this.plugin.settings.installedDictionaryBuiltAt ?? "unknown build date"})`
			: "No dictionary installed.";
		return [
			{
				type: "group",
				heading: "Templates",
				items: [
					{
						name: "Template folder",
						desc: "Markdown templates in this vault. Type to choose an existing folder, or enter a new path. Templates use {{field}} placeholders.",
						control: {
							type: "folder",
							key: "templateFolder",
							placeholder: DEFAULT_SETTINGS.templateFolder,
							validate: (value) => value.trim() ? undefined : "Enter a template folder path.",
						},
					},
					{
						name: "Create default template",
						desc: "Creates Default.md in the configured template folder without overwriting an existing file.",
						render: (setting) => this.addCreateTemplateButton(setting),
					},
				],
			},
			{
				type: "group",
				heading: "AI lookup",
				items: [
					{
						name: "AI API base URL",
						desc: "OpenAI-compatible Chat Completions base URL. HTTPS is required, except for a local server.",
						control: {
							type: "text",
							key: "aiApiBaseUrl",
							placeholder: DEFAULT_SETTINGS.aiApiBaseUrl,
							validate: validateAiApiBaseUrl,
						},
					},
					{
						name: "AI model",
						desc: "Model identifier supplied by your AI provider.",
						control: {
							type: "text",
							key: "aiModel",
							placeholder: DEFAULT_SETTINGS.aiModel,
							validate: (value) => value.trim() ? undefined : "Enter an AI model identifier.",
						},
					},
					{
						name: "AI API key secret",
						desc: "Choose or create the named secret that Kotoba Insert uses for AI requests. The API key itself is not saved in plugin settings.",
						render: (setting) => this.addAiApiKeySecretPicker(setting),
					},
					{
						name: "Prompt folder",
						desc: "Markdown prompts in this vault. Select one for every AI lookup.",
						control: {
							type: "folder",
							key: "promptFolder",
							placeholder: DEFAULT_SETTINGS.promptFolder,
							validate: (value) => value.trim() ? undefined : "Enter a prompt folder path.",
						},
					},
					{
						name: "Create default prompt",
						desc: "Creates Default.md in the configured prompt folder without overwriting an existing file.",
						render: (setting) => this.addCreatePromptButton(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Offline dictionary",
				items: [
					{
						name: "Dictionary metadata URL",
						desc: "Only change this for a compatible Kotoba Insert data release.",
						control: {
							type: "text",
							key: "dictionaryMetadataUrl",
							validate: (value) => value.trim() ? undefined : "Enter a dictionary metadata URL.",
						},
					},
					{
						name: "Install or update dictionary",
						desc: `${installed} Downloads occur only after you select this button.`,
						render: (setting) => this.addDictionaryInstallButton(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Sources and privacy",
				items: [{
					name: "Local lookups",
					desc: "Lookups run locally after installation. Kotoba Insert does not send notes or search terms over the network. Dictionary snapshots are derived from JMdict and released under CC BY-SA 4.0.",
					render: (setting) => this.addSourceLinks(setting.descEl),
				}],
			},
			{
				type: "page",
				name: "Guide",
				desc: "Markdown template fields and dictionary data sources.",
				items: [
					{
						type: "group",
						heading: "Markdown templates",
						items: [
							{
								name: "Template format",
								desc: "A template is a Markdown file in the configured template folder. Kotoba Insert replaces each exact {{keyword}} with data from the selected entry and inserts the resulting Markdown at the cursor. Use double braces, lowercase field names, and no spaces inside the braces. Values from multiple selected senses are de-duplicated and separated with semicolons. A field with no available data becomes empty.",
							},
							{
								name: "Example template",
								desc: "For example, selecting all senses of 下がり can produce {下|さ}がり when a verified alignment exists. If it does not, Kotoba Insert safely uses {下がり|さがり}. Kotoba Insert renders both forms itself, so no separate Furigana plugin is required.",
								render: (setting) => this.createCodeBlock(setting.settingEl, "## {{word_with_furigana}}\n\n**Definitions:** {{english_definitions}}\n\n**Part of speech:** {{part_of_speech}}\n\n**Usage:** {{usage_tags}}\n\n**Notes:** {{sense_notes}}"),
							},
							{
								name: "Available keywords",
								desc: "The examples below use 下がり (さがり) with all of its senses selected. The commonness example uses お使い because 下がり has no spec, gai, or news-frequency tag in JMdict.",
								render: (setting) => this.renderTemplateFieldTable(setting.settingEl),
							},
						],
					},
					{
						type: "group",
						heading: "Dictionary data source",
						items: [{
							name: "Offline dictionary data",
							desc: "Kotoba Insert uses an offline snapshot created from the regular English dictionary release of the JMdict for Yomitan project. Verified furigana alignment comes from JmdictFurigana and is used only when the written form and reading both match. The snapshot is downloaded only when you choose Install / update dictionary; after that, lookups run locally on your device.",
							render: (setting) => this.addGuideSourceLinks(setting.descEl),
						}],
					},
				],
			},
		];
	}

	private renderTemplateFieldTable(container: HTMLElement): void {
		const table = container.createEl("table", { cls: "kotoba-insert-template-guide" });
		const header = table.createEl("thead").createEl("tr");
		header.createEl("th", { text: "Keyword" });
		header.createEl("th", { text: "Provides" });
		header.createEl("th", { text: "Example value" });
		const body = table.createEl("tbody");
		for (const field of TEMPLATE_FIELD_GUIDE) {
			const row = body.createEl("tr");
			row.createEl("td").createEl("code", { text: field.placeholder });
			row.createEl("td", { text: field.description });
			const example = row.createEl("td");
			if (field.placeholder === "{{word_with_furigana}}") {
				example.createSpan({ text: field.example });
				renderFuriganaInElement(example);
			} else {
				example.createEl("code", { text: field.example });
			}
		}
	}

	private addCreateTemplateButton(setting: Setting): void {
		setting.addButton((button) => button.setButtonText("Create template").onClick(() => void this.createDefaultTemplateFile()));
	}

	private addAiApiKeySecretPicker(setting: Setting): void {
		setting.addComponent((container) => new SecretComponent(this.app, container)
			.setValue(this.plugin.settings.aiApiKeySecret)
			.onChange(async (value) => {
				this.plugin.settings.aiApiKeySecret = value;
				await this.plugin.saveSettings();
			}));
	}

	private addCreatePromptButton(setting: Setting): void {
		setting.addButton((button) => button.setButtonText("Create prompt").onClick(() => void this.createDefaultPromptFile()));
	}

	private async createDefaultPromptFile(): Promise<void> {
		try {
			const file = await createDefaultPrompt(this.app, this.plugin.settings.promptFolder);
			new Notice(file ? `Created ${file.path}` : "The default prompt already exists.");
		} catch (error) {
			new Notice(`Unable to create the default prompt: ${message(error)}`);
		}
	}

	private async createDefaultTemplateFile(): Promise<void> {
		try {
			const file = await createDefaultTemplate(this.app, this.plugin.settings.templateFolder);
			new Notice(file ? `Created ${file.path}` : "The default template already exists.");
		} catch (error) {
			new Notice(`Unable to create the default template: ${message(error)}`);
		}
	}

	private addDictionaryInstallButton(setting: Setting): void {
		setting.addButton((button) => button.setButtonText("Install / update").setCta().onClick(async () => {
			button.setDisabled(true).setButtonText("Downloading…");
			try {
				const metadata = await this.plugin.dictionary.installFromMetadata(this.plugin.settings.dictionaryMetadataUrl);
				new Notice(`Installed dictionary ${metadata.snapshotVersion}.`);
				this.update();
			} catch (error) {
				new Notice(`Dictionary update failed: ${message(error)}`);
			} finally {
				button.setDisabled(false).setButtonText("Install / update");
			}
		}));
	}

	private addSourceLinks(container: HTMLElement): void {
		container.createEl("a", { text: "JMdict / EDRDG", href: "https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project" });
		container.appendText(" · ");
		container.createEl("a", { text: "Kotoba Insert data", href: "https://github.com/fabsamson/kotoba-insert-data" });
	}

	private addGuideSourceLinks(container: HTMLElement): void {
		container.createEl("a", { text: "JMdict for Yomitan", href: "https://github.com/yomidevs/jmdict-yomitan" });
		container.appendText(" · ");
		container.createEl("a", { text: "JmdictFurigana", href: "https://github.com/Doublevil/JmdictFurigana" });
		container.appendText(" · ");
		container.createEl("a", { text: "Kotoba Insert data releases and attribution", href: "https://github.com/fabsamson/kotoba-insert-data" });
	}

	private createCodeBlock(container: HTMLElement, value: string): void {
		container.createEl("pre").createEl("code", { text: value });
	}
}

export function getTemplateFiles(app: App, folder: string): TFile[] {
	const normalized = normalizePath(folder.trim());
	const root = app.vault.getAbstractFileByPath(normalized);
	if (root instanceof TFile) return root.extension === "md" ? [root] : [];
	if (!(root instanceof TFolder)) return [];
	return collectMarkdownFiles(root);
}

export async function createDefaultTemplate(app: App, folder: string): Promise<TFile | null> {
	const folderPath = normalizePath(folder.trim()) || DEFAULT_SETTINGS.templateFolder;
	const existing = app.vault.getAbstractFileByPath(folderPath);
	if (!existing) await app.vault.createFolder(folderPath);
	else if (!(existing instanceof TFolder)) throw new Error(`${folderPath} exists and is not a folder.`);
	const path = `${folderPath}/Default.md`;
	if (app.vault.getAbstractFileByPath(path)) return null;
	return app.vault.create(path, `${DEFAULT_TEMPLATE}\n`);
}

export const DEFAULT_AI_PROMPT = `Act as a fast Japanese-to-English study assistant. For every input, respond ONLY in this exact format:

{words_with_furigana} - {english_translation}, {easy_japanese_definition}

Rules:
- Answer in English.
- Be concise: maximum 30 words for vocabulary, 60 words for grammar point.
- words_with_furigana use this {kanji|furigana} syntax. Align kanji with furigana by repeating this syntax and splitting the words as many times necessary.
- Do not invent information.
- If ambiguous, mention the two possible meanings briefly.
- No introduction or conclusion`;

export async function createDefaultPrompt(app: App, folder: string): Promise<TFile | null> {
	const folderPath = normalizePath(folder.trim()) || DEFAULT_SETTINGS.promptFolder;
	const existing = app.vault.getAbstractFileByPath(folderPath);
	if (!existing) await app.vault.createFolder(folderPath);
	else if (!(existing instanceof TFolder)) throw new Error(`${folderPath} exists and is not a folder.`);
	const path = `${folderPath}/Default.md`;
	if (app.vault.getAbstractFileByPath(path)) return null;
	return app.vault.create(path, `${DEFAULT_AI_PROMPT}\n`);
}

export function getPromptFiles(app: App, folder: string): TFile[] {
	return getTemplateFiles(app, folder);
}

function collectMarkdownFiles(folder: TFolder): TFile[] {
	return folder.children.flatMap((child) => {
		if (child instanceof TFile) return child.extension === "md" ? [child] : [];
		return child instanceof TFolder ? collectMarkdownFiles(child) : [];
	});
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function validateAiApiBaseUrl(value: string): string | undefined {
	try {
		const url = new URL(value.trim());
		const isLocal = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
		if (url.username || url.password || url.search || url.hash) return "Do not include credentials, a query, or a fragment.";
		return url.protocol === "https:" || isLocal ? undefined : "Use HTTPS, except for a local server.";
	} catch {
		return "Enter a valid API base URL.";
	}
}
