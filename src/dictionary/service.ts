import { requestUrl, type App, type DataAdapter, type PluginManifest } from "obsidian";

import { formContainsQuery } from "./matching";
import { parseSnapshot, SNAPSHOT_SCHEMA_VERSION, type DictionarySnapshot, type SearchResult, type SnapshotMetadata, isMetadata } from "./types";

export const DEFAULT_METADATA_URL = "https://github.com/fabsamson/kotoba-insert-data/releases/latest/download/kotoba-dictionary.metadata.json";
const SNAPSHOT_FILE_NAME = "kotoba-dictionary.json.gz";

export class DictionaryService {
	private snapshot: DictionarySnapshot | null = null;

	public constructor(
		private readonly app: App,
		private readonly manifest: PluginManifest,
		private readonly onInstalled: (metadata: SnapshotMetadata) => Promise<void>,
	) {}

	public async loadInstalled(): Promise<DictionarySnapshot | null> {
		if (this.snapshot) return this.snapshot;
		const adapter = this.app.vault.adapter;
		const path = this.snapshotPath();
		if (!await adapter.exists(path)) return null;
		this.snapshot = parseSnapshot(await adapter.readBinary(path));
		return this.snapshot;
	}

	public async installFromMetadata(metadataUrl: string): Promise<SnapshotMetadata> {
		const metadataResponse = await requestUrl({ url: metadataUrl, method: "GET" });
		if (!isMetadata(metadataResponse.json)) throw new Error("The dictionary metadata file is invalid.");
		const metadata = metadataResponse.json;
		if (metadata.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
			throw new Error(`Dictionary schema ${metadata.schemaVersion} is not supported by this plugin version.`);
		}

		const assetUrl = new URL(metadata.asset.fileName, metadataUrl).toString();
		const assetResponse = await requestUrl({ url: assetUrl, method: "GET" });
		const bytes = assetResponse.arrayBuffer;
		if (await sha256(bytes) !== metadata.asset.sha256) throw new Error("Dictionary checksum verification failed.");
		const candidate = parseSnapshot(bytes);
		if (candidate.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new Error("Dictionary schema verification failed.");

		await this.writeSnapshot(this.app.vault.adapter, bytes);
		this.snapshot = candidate;
		await this.onInstalled(metadata);
		return metadata;
	}

	public async search(query: string): Promise<SearchResult[]> {
		const normalized = query.trim();
		if (!normalized) return [];
		const snapshot = await this.loadInstalled();
		if (!snapshot) throw new Error("Install the dictionary before searching.");
		return snapshot.entries.flatMap((entry) => entry.forms
			.filter((form) => formContainsQuery(form, normalized))
			.map((matchedForm) => ({ entry, matchedForm })));
	}

	private snapshotPath(): string {
		return `${this.manifest.dir}/${SNAPSHOT_FILE_NAME}`;
	}

	private async writeSnapshot(adapter: DataAdapter, bytes: ArrayBuffer): Promise<void> {
		await adapter.writeBinary(this.snapshotPath(), bytes);
	}
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
