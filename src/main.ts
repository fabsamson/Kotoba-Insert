import { Plugin, type Editor } from "obsidian";

import { AiService } from "./ai/service";
import { DictionaryService } from "./dictionary/service";
import { renderFuriganaInElement } from "./furigana";
import { furiganaLivePreview } from "./live-preview";
import { DEFAULT_SETTINGS, KotobaSettingTab, type KotobaSettings } from "./settings";
import { LookupModal } from "./ui/lookup-modal";

export default class KotobaInsertPlugin extends Plugin {
	public settings: KotobaSettings = DEFAULT_SETTINGS;
	public dictionary!: DictionaryService;
	public ai!: AiService;

	public async onload(): Promise<void> {
		await this.loadSettings();
		this.dictionary = new DictionaryService(this.app, this.manifest, async (metadata) => {
			this.settings.installedDictionaryVersion = metadata.snapshotVersion;
			this.settings.installedDictionaryBuiltAt = metadata.builtAt;
			await this.saveSettings();
		});
		this.ai = new AiService(this.app, () => ({
			apiBaseUrl: this.settings.aiApiBaseUrl,
			model: this.settings.aiModel,
			apiKeySecret: this.settings.aiApiKeySecret,
		}));

		this.addSettingTab(new KotobaSettingTab(this));
		this.registerEditorExtension(furiganaLivePreview);
		this.addCommand({
			id: "search-and-insert",
			name: "Search and insert Japanese vocabulary",
			icon: "languages",
			editorCallback: (editor: Editor) => this.openLookup(editor),
		});
		this.addCommand({
			id: "ask-ai-and-insert",
			name: "Ask AI and insert Japanese study note",
			icon: "sparkles",
			editorCallback: (editor: Editor) => this.openLookup(editor, "ai"),
		});
		this.registerMarkdownPostProcessor((element) => renderFuriganaInElement(element));
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private openLookup(editor: Editor, initialTab: "dictionary" | "ai" = "dictionary"): void {
		new LookupModal(this.app, editor, this.dictionary, this.ai, () => this.settings.templateFolder, () => this.settings.promptFolder, initialTab).open();
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
		promptFolder: nonEmptyString(value.promptFolder, DEFAULT_SETTINGS.promptFolder),
		aiApiBaseUrl: nonEmptyString(value.aiApiBaseUrl, DEFAULT_SETTINGS.aiApiBaseUrl),
		aiModel: nonEmptyString(value.aiModel, DEFAULT_SETTINGS.aiModel),
		aiApiKeySecret: stringOrEmpty(value.aiApiKeySecret),
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

function stringOrEmpty(value: unknown): string {
	return typeof value === "string" ? value : "";
}
