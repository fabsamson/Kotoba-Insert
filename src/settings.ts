import { App, Notice, PluginSettingTab, Setting, type TFile } from "obsidian";

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

export class KotobaSettingTab extends PluginSettingTab {
	public constructor(private readonly plugin: KotobaInsertPlugin) {
		super(plugin.app, plugin);
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Kotoba Insert" });

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
