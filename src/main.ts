import { Plugin, type Editor } from "obsidian";

import { DictionaryService } from "./dictionary/service";
import { renderFuriganaInElement } from "./furigana";
import { furiganaLivePreview } from "./live-preview";
import { DEFAULT_SETTINGS, KotobaSettingTab, type KotobaSettings } from "./settings";
import { LookupModal } from "./ui/lookup-modal";

export default class KotobaInsertPlugin extends Plugin {
	public settings: KotobaSettings = DEFAULT_SETTINGS;
	public dictionary!: DictionaryService;

	public async onload(): Promise<void> {
		await this.loadSettings();
		this.dictionary = new DictionaryService(this.app, this.manifest, async (metadata) => {
			this.settings.installedDictionaryVersion = metadata.snapshotVersion;
			this.settings.installedDictionaryBuiltAt = metadata.builtAt;
			await this.saveSettings();
		});

		this.addSettingTab(new KotobaSettingTab(this));
		this.registerEditorExtension(furiganaLivePreview);
		this.addCommand({
			id: "search-and-insert",
			name: "Search and insert Japanese vocabulary",
			icon: "languages",
			editorCallback: (editor: Editor) => this.openLookup(editor),
		});
		this.registerMarkdownPostProcessor((element) => renderFuriganaInElement(element));
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private openLookup(editor: Editor): void {
		new LookupModal(this.app, editor, this.dictionary, () => this.settings.templateFolder).open();
	}

	private async loadSettings(): Promise<void> {
		const savedSettings: unknown = await this.loadData();
		this.settings = normalizeSettings(savedSettings);
	}
}

function normalizeSettings(value: unknown): KotobaSettings {
	if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
	return {
		templateFolder: nonEmptyString(value.templateFolder, DEFAULT_SETTINGS.templateFolder),
		dictionaryMetadataUrl: nonEmptyString(value.dictionaryMetadataUrl, DEFAULT_SETTINGS.dictionaryMetadataUrl),
		installedDictionaryVersion: stringOrNull(value.installedDictionaryVersion),
		installedDictionaryBuiltAt: stringOrNull(value.installedDictionaryBuiltAt),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}
