import { Notice, Plugin, type Editor } from "obsidian";

import { DictionaryService } from "./dictionary/service";
import { renderFuriganaInElement } from "./furigana";
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

		try {
			await this.dictionary.loadInstalled();
		} catch (error) {
			console.warn("Kotoba Insert could not load the installed dictionary", error);
			new Notice("Kotoba Insert could not load the installed dictionary. Reinstall it from plugin settings.");
		}

		this.addSettingTab(new KotobaSettingTab(this));
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
		this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
	}
}
