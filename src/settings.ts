import { AbstractInputSuggest, App, normalizePath, Notice, PluginSettingTab, Setting, type SettingDefinitionItem, TFile, TFolder } from "obsidian";

import { renderFuriganaInElement } from "./furigana";
import type KotobaInsertPlugin from "./main";
import { DEFAULT_TEMPLATE } from "./template";

export interface KotobaSettings {
	templateFolder: string;
	dictionaryMetadataUrl: string;
	installedDictionaryVersion: string | null;
	installedDictionaryBuiltAt: string | null;
}

export const DEFAULT_SETTINGS: KotobaSettings = {
	templateFolder: "kotoba-insert-templates",
	dictionaryMetadataUrl: "https://github.com/fabsamson/kotoba-insert-data/releases/latest/download/kotoba-dictionary.metadata.json",
	installedDictionaryVersion: null,
	installedDictionaryBuiltAt: null,
};

type SettingsPage = "settings" | "guide";

interface TemplateFieldGuide {
	placeholder: string;
	description: string;
	example: string;
}

const TEMPLATE_FIELD_GUIDE: TemplateFieldGuide[] = [
	{ placeholder: "{{word}}", description: "Selected written form.", example: "\u4e0b\u304c\u308a" },
	{ placeholder: "{{reading}}", description: "Selected reading.", example: "\u3055\u304c\u308a" },
	{ placeholder: "{{word_with_furigana}}", description: "Verified per-segment furigana when available; otherwise Kotoba Insert whole-word syntax.", example: "{\u4e0b|\u3055}\u304c\u308a" },
	{ placeholder: "{{english_definitions}}", description: "Definitions from every selected sense.", example: "fall; decline; lowering; hanging down; drooping; slanting (downward); string apron; food offering to the gods; leftovers; hand-me-downs; leaving (one's master's place for home); a little after ...; sagari; \u4e0b\u304c\u308a\uff08\u2605\uff09; \u30b5\u30ac\u30ea" },
	{ placeholder: "{{english_definition_1}}", description: "First English definition from the selected senses.", example: "fall" },
	{ placeholder: "{{part_of_speech}}", description: "Part-of-speech labels from the selected senses.", example: "noun (common) (futsuumeishi); noun, used as a suffix" },
	{ placeholder: "{{alternate_forms}}", description: "Other written or reading forms in the entry.", example: "\u30b5\u30ac\u30ea" },
	{ placeholder: "{{priority}}", description: "Frequency or commonness labels for the selected form.", example: "included in Ichimango Goi Bunruishuu (\uff11\u4e07\u8a9e\u8a9e\u5f59\u5206\u985e\u96c6); ranked between the top 12,000 and 13,000 words in a frequency analysis of the Mainichi Shimbun (1990s)" },
	{ placeholder: "{{commonness}}", description: "Raw commonness and news-frequency tags for the selected form.", example: "spec; news18k (\u304a\u4f7f\u3044 example)" },
	{ placeholder: "{{cross_references}}", description: "Related entries referenced by the selected senses.", example: "\u304a\u4e0b\u304c\u308asee: \u304a\u4e0b\u304c\u308a" },
	{ placeholder: "{{antonyms}}", description: "Antonyms from the selected senses.", example: "\u4e0a\u304c\u308a" },
	{ placeholder: "{{field_tags}}", description: "Subject-field labels from the selected senses.", example: "sumo" },
	{ placeholder: "{{usage_tags}}", description: "Usage labels from the selected senses.", example: "go (game); word usually written using kana alone; other surface forms and readings" },
	{ placeholder: "{{sense_notes}}", description: "Notes attached to the selected senses.", example: "ornamental cords hanging from the front of a sumo wrestler's belt; usu. as \u304a\u4e0b\u304c\u308a; usu. \u30b5\u30ac\u30ea; to extend a group of stones towards the edge of the board" },
];

export class KotobaSettingTab extends PluginSettingTab {
	private activePage: SettingsPage = "settings";

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
						render: (setting) => this.addDictionaryInstallButton(setting, () => this.update()),
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

	public display(): void {
		this.renderLegacySettings();
	}

	private renderLegacySettings(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.renderTabs(containerEl);
		if (this.activePage === "guide") {
			this.renderGuide(containerEl);
			return;
		}

		new Setting(containerEl)
			.setName("Template folder")
			.setDesc("Markdown templates in this vault. Type to choose an existing folder, or enter a new path. Templates use {{field}} placeholders.")
			.addText((text) => {
				text.setValue(this.plugin.settings.templateFolder)
					.onChange(async (value) => {
						this.plugin.settings.templateFolder = value.trim() || DEFAULT_SETTINGS.templateFolder;
						await this.plugin.saveSettings();
					});
				new VaultFolderSuggest(this.app, text.inputEl, async (folder) => {
					this.plugin.settings.templateFolder = folder;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Create default template")
			.setDesc("Creates Default.md in the configured template folder without overwriting an existing file.")
			.addButton((button) => button.setButtonText("Create template").onClick(() => void this.createDefaultTemplateFile()));

		new Setting(containerEl).setName("Offline dictionary").setHeading();
		new Setting(containerEl)
			.setName("Dictionary metadata URL")
			.setDesc("Only change this for a compatible Kotoba Insert data release.")
			.addText((text) => text
				.setValue(this.plugin.settings.dictionaryMetadataUrl)
				.onChange(async (value) => {
					this.plugin.settings.dictionaryMetadataUrl = value.trim() || DEFAULT_SETTINGS.dictionaryMetadataUrl;
					await this.plugin.saveSettings();
				}));

		const installed = this.plugin.settings.installedDictionaryVersion
			? `Installed: ${this.plugin.settings.installedDictionaryVersion} (${this.plugin.settings.installedDictionaryBuiltAt ?? "unknown build date"})`
			: "No dictionary installed.";
		new Setting(containerEl)
			.setName("Install or update dictionary")
			.setDesc(`${installed} Downloads occur only after you select this button.`)
			.addButton((button) => button.setButtonText("Install / update").setCta().onClick(async () => {
				button.setDisabled(true).setButtonText("Downloading…");
				try {
					const metadata = await this.plugin.dictionary.installFromMetadata(this.plugin.settings.dictionaryMetadataUrl);
					new Notice(`Installed dictionary ${metadata.snapshotVersion}.`);
					this.renderLegacySettings();
				} catch (error) {
					new Notice(`Dictionary update failed: ${message(error)}`);
				} finally {
					button.setDisabled(false).setButtonText("Install / update");
				}
			}));

		new Setting(containerEl).setName("Sources and privacy").setHeading();
		containerEl.createEl("p", {
			text: "Lookups run locally after installation. Kotoba Insert does not send notes or search terms over the network. Dictionary snapshots are derived from JMdict and released under CC BY-SA 4.0.",
		});
		const links = containerEl.createEl("p");
		links.createEl("a", { text: "JMdict / EDRDG", href: "https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project" });
		links.appendText(" · ");
		links.createEl("a", { text: "Kotoba Insert data", href: "https://github.com/fabsamson/kotoba-insert-data" });
	}

	private renderTabs(container: HTMLElement): void {
		const tabList = container.createDiv({ cls: "kotoba-insert-settings-tabs" });
		tabList.setAttr("role", "tablist");
		tabList.setAttr("aria-label", "Kotoba Insert settings pages");
		for (const [page, label] of [["settings", "Settings"], ["guide", "Guide"]] as const) {
			const tab = tabList.createEl("button", { text: label, cls: "kotoba-insert-settings-tab" });
			tab.setAttr("type", "button");
			tab.setAttr("role", "tab");
			tab.setAttr("aria-selected", String(this.activePage === page));
			if (this.activePage === page) tab.addClass("is-active");
			tab.addEventListener("click", () => {
				this.activePage = page;
				this.renderLegacySettings();
			});
		}
	}

	private renderGuide(container: HTMLElement): void {
		new Setting(container).setName("Markdown templates").setHeading();
		container.createEl("p", {
			text: "A template is a Markdown file in the configured template folder. Kotoba Insert replaces each exact {{keyword}} with data from the selected entry and inserts the resulting Markdown at the cursor.",
		});
		container.createEl("p", {
			text: "Use double braces, lowercase field names, and no spaces inside the braces. Values from multiple selected senses are de-duplicated and separated with semicolons. A field with no available data becomes empty.",
		});

		new Setting(container).setName("Example template").setHeading();
		this.createCodeBlock(container, "## {{word_with_furigana}}\n\n**Definitions:** {{english_definitions}}\n\n**Part of speech:** {{part_of_speech}}\n\n**Usage:** {{usage_tags}}\n\n**Notes:** {{sense_notes}}");
		container.createEl("p", {
			text: "For example, selecting all senses of \u4e0b\u304c\u308a can produce {\u4e0b|\u3055}\u304c\u308a when a verified alignment exists. If it does not, Kotoba Insert safely uses {\u4e0b\u304c\u308a|\u3055\u304c\u308a}. Kotoba Insert renders both forms itself, so no separate Furigana plugin is required.",
		});

		new Setting(container).setName("Available keywords").setHeading();
		container.createEl("p", {
			text: "The examples below use \u4e0b\u304c\u308a (\u3055\u304c\u308a) with all of its senses selected. The commonness example uses \u304a\u4f7f\u3044 because \u4e0b\u304c\u308a has no spec, gai, or news-frequency tag in JMdict.",
		});
		this.renderTemplateFieldTable(container);

		new Setting(container).setName("Dictionary data source").setHeading();
		container.createEl("p", {
			text: "Kotoba Insert uses an offline snapshot created from the regular English dictionary release of the JMdict for Yomitan project. Verified furigana alignment comes from JmdictFurigana and is used only when the written form and reading both match. The snapshot is downloaded only when you choose Install / update dictionary; after that, lookups run locally on your device.",
		});
		const links = container.createEl("p");
		links.createEl("a", { text: "JMdict for Yomitan", href: "https://github.com/yomidevs/jmdict-yomitan" });
		links.appendText(" \u00b7 ");
		links.createEl("a", { text: "JmdictFurigana", href: "https://github.com/Doublevil/JmdictFurigana" });
		links.appendText(" \u00b7 ");
		links.createEl("a", { text: "Kotoba Insert data releases and attribution", href: "https://github.com/fabsamson/kotoba-insert-data" });
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

	private async createDefaultTemplateFile(): Promise<void> {
		try {
			const file = await createDefaultTemplate(this.app, this.plugin.settings.templateFolder);
			new Notice(file ? `Created ${file.path}` : "The default template already exists.");
		} catch (error) {
			new Notice(`Unable to create the default template: ${message(error)}`);
		}
	}

	private addDictionaryInstallButton(setting: Setting, refresh: () => void): void {
		setting.addButton((button) => button.setButtonText("Install / update").setCta().onClick(async () => {
			button.setDisabled(true).setButtonText("Downloading…");
			try {
				const metadata = await this.plugin.dictionary.installFromMetadata(this.plugin.settings.dictionaryMetadataUrl);
				new Notice(`Installed dictionary ${metadata.snapshotVersion}.`);
				refresh();
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

class VaultFolderSuggest extends AbstractInputSuggest<TFolder> {
	public constructor(
		app: App,
		inputEl: HTMLInputElement,
		private readonly onFolderSelected: (folder: string) => Promise<void>,
	) {
		super(app, inputEl);
		this.limit = 25;
	}

	protected getSuggestions(query: string): TFolder[] {
		const normalizedQuery = normalizePath(query.trim()).toLocaleLowerCase();
		return this.app.vault.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && file.path.length > 0)
			.filter((folder) => folder.path.toLocaleLowerCase().includes(normalizedQuery))
			.sort((left, right) => folderMatchOrder(left.path, normalizedQuery) - folderMatchOrder(right.path, normalizedQuery)
				|| left.path.localeCompare(right.path));
	}

	public renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	public selectSuggestion(folder: TFolder, _event: MouseEvent | KeyboardEvent): void {
		this.setValue(folder.path);
		void this.onFolderSelected(folder.path);
	}
}

function folderMatchOrder(path: string, query: string): number {
	if (!query || path.toLocaleLowerCase().startsWith(query)) return 0;
	return 1;
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

function collectMarkdownFiles(folder: TFolder): TFile[] {
	return folder.children.flatMap((child) => {
		if (child instanceof TFile) return child.extension === "md" ? [child] : [];
		return child instanceof TFolder ? collectMarkdownFiles(child) : [];
	});
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
