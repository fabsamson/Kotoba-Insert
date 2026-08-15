import { App, Notice, PluginSettingTab, Setting, type TFile } from "obsidian";

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
	templateFolder: "Kotoba Insert Templates",
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
	{ placeholder: "{{word_with_furigana}}", description: "Kotoba Insert furigana syntax.", example: "{\u4e0b\u304c\u308a|\u3055\u304c\u308a}" },
	{ placeholder: "{{english_definitions}}", description: "Definitions from every selected sense.", example: "fall; decline; lowering; hanging down; drooping; slanting (downward); string apron; food offering to the gods; leftovers; hand-me-downs; leaving (one's master's place for home); a little after ...; sagari; \u4e0b\u304c\u308a\uff08\u2605\uff09; \u30b5\u30ac\u30ea" },
	{ placeholder: "{{english_definition_1}}", description: "First English definition from the selected senses.", example: "fall" },
	{ placeholder: "{{part_of_speech}}", description: "Part-of-speech labels from the selected senses.", example: "noun (common) (futsuumeishi); noun, used as a suffix" },
	{ placeholder: "{{alternate_forms}}", description: "Other written or reading forms in the entry.", example: "\u30b5\u30ac\u30ea" },
	{ placeholder: "{{priority}}", description: "Frequency or commonness labels for the selected form.", example: "included in Ichimango Goi Bunruishuu (\uff11\u4e07\u8a9e\u8a9e\u5f59\u5206\u985e\u96c6); ranked between the top 12,000 and 13,000 words in a frequency analysis of the Mainichi Shimbun (1990s)" },
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

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Kotoba Insert" });
		this.renderTabs(containerEl);
		if (this.activePage === "guide") {
			this.renderGuide(containerEl);
			return;
		}

		new Setting(containerEl)
			.setName("Template folder")
			.setDesc("Markdown templates in this vault. Templates use {{field}} placeholders.")
			.addText((text) => text
				.setValue(this.plugin.settings.templateFolder)
				.onChange(async (value) => {
					this.plugin.settings.templateFolder = value.trim() || DEFAULT_SETTINGS.templateFolder;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Create default template")
			.setDesc("Creates Default.md in the configured template folder without overwriting an existing file.")
			.addButton((button) => button.setButtonText("Create template").onClick(async () => {
				try {
					const file = await createDefaultTemplate(this.app, this.plugin.settings.templateFolder);
					new Notice(file ? `Created ${file.path}` : "The default template already exists.");
				} catch (error) {
					new Notice(`Unable to create the default template: ${message(error)}`);
				}
			}));

		containerEl.createEl("h3", { text: "Offline dictionary" });
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
					this.display();
				} catch (error) {
					new Notice(`Dictionary update failed: ${message(error)}`);
				} finally {
					button.setDisabled(false).setButtonText("Install / update");
				}
			}));

		containerEl.createEl("h3", { text: "Sources and privacy" });
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
				this.display();
			});
		}
	}

	private renderGuide(container: HTMLElement): void {
		container.createEl("h3", { text: "Markdown templates" });
		container.createEl("p", {
			text: "A template is a Markdown file in the configured template folder. Kotoba Insert replaces each exact {{keyword}} with data from the selected entry and inserts the resulting Markdown at the cursor.",
		});
		container.createEl("p", {
			text: "Use double braces, lowercase field names, and no spaces inside the braces. Values from multiple selected senses are de-duplicated and separated with semicolons. A field with no available data becomes empty.",
		});

		container.createEl("h4", { text: "Example template" });
		this.createCodeBlock(container, "## {{word_with_furigana}}\n\n**Definitions:** {{english_definitions}}\n\n**Part of speech:** {{part_of_speech}}\n\n**Usage:** {{usage_tags}}\n\n**Notes:** {{sense_notes}}");
		container.createEl("p", {
			text: "For example, selecting all senses of \u4e0b\u304c\u308a produces a Markdown note with the stored furigana syntax {\u4e0b\u304c\u308a|\u3055\u304c\u308a}. Kotoba Insert renders this syntax itself, so no separate Furigana plugin is required.",
		});

		container.createEl("h4", { text: "Available keywords" });
		container.createEl("p", {
			text: "The examples below use \u4e0b\u304c\u308a (\u3055\u304c\u308a) with all of its senses selected. This entry has data for every currently supported field.",
		});
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

		container.createEl("h3", { text: "Dictionary data source" });
		container.createEl("p", {
			text: "Kotoba Insert uses an offline snapshot created from the regular English dictionary release of the JMdict for Yomitan project. The snapshot is downloaded only when you choose Install / update dictionary; after that, lookups run locally on your device.",
		});
		const links = container.createEl("p");
		links.createEl("a", { text: "JMdict for Yomitan", href: "https://github.com/yomidevs/jmdict-yomitan" });
		links.appendText(" \u00b7 ");
		links.createEl("a", { text: "Kotoba Insert data releases and attribution", href: "https://github.com/fabsamson/kotoba-insert-data" });
	}

	private createCodeBlock(container: HTMLElement, value: string): void {
		container.createEl("pre").createEl("code", { text: value });
	}
}

export function getTemplateFiles(app: App, folder: string): TFile[] {
	const normalized = folder.replace(/^\/+|\/+$/g, "");
	const prefix = normalized ? `${normalized}/` : "";
	return app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
}

export async function createDefaultTemplate(app: App, folder: string): Promise<TFile | null> {
	const normalized = folder.replace(/^\/+|\/+$/g, "") || DEFAULT_SETTINGS.templateFolder;
	const folderPath = normalized;
	if (!app.vault.getAbstractFileByPath(folderPath)) await app.vault.createFolder(folderPath);
	const path = `${folderPath}/Default.md`;
	if (app.vault.getAbstractFileByPath(path)) return null;
	return app.vault.create(path, `${DEFAULT_TEMPLATE}\n`);
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
