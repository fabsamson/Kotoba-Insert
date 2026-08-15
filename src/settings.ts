import { App, normalizePath, Notice, PluginSettingTab, Setting, type SettingDefinitionItem, TFile, TFolder } from "obsidian";

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

function collectMarkdownFiles(folder: TFolder): TFile[] {
	return folder.children.flatMap((child) => {
		if (child instanceof TFile) return child.extension === "md" ? [child] : [];
		return child instanceof TFolder ? collectMarkdownFiles(child) : [];
	});
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
