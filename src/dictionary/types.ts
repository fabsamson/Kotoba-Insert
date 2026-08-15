import { gunzipSync } from "fflate";

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface FuriganaSegment {
	ruby: string;
	rt?: string;
}

export interface DictionaryForm {
	written: string;
	reading: string;
	priority: string[];
	commonness?: string[];
	newsFrequencyBand?: number;
	furigana?: FuriganaSegment[];
}

export interface DictionarySense {
	definitions: string[];
	partOfSpeech: string[];
	fieldTags: string[];
	usageTags: string[];
	senseNotes: string[];
	crossReferences: string[];
	antonyms: string[];
}

export interface DictionaryEntry {
	id: string;
	forms: DictionaryForm[];
	senses: DictionarySense[];
}

export interface DictionarySnapshot {
	schemaVersion: number;
	entries: DictionaryEntry[];
}

export interface SnapshotMetadata {
	schemaVersion: number;
	snapshotVersion: string;
	builtAt: string;
	upstream: { url: string; sha256: string };
	furiganaUpstream?: { url: string; sha256: string };
	asset: { fileName: string; sha256: string; bytes: number };
	licences: { data: string; upstream: string; furiganaUpstream?: string };
}

export interface SearchResult {
	entry: DictionaryEntry;
	matchedForm: DictionaryForm;
}

export function parseSnapshot(compressed: ArrayBuffer | Uint8Array): DictionarySnapshot {
	const bytes = compressed instanceof Uint8Array ? compressed : new Uint8Array(compressed);
	const text = new TextDecoder().decode(gunzipSync(bytes));
	const snapshot: unknown = JSON.parse(text);
	if (!isSnapshot(snapshot)) throw new Error("The downloaded file is not a supported Kotoba Insert dictionary.");
	return snapshot;
}

export function isMetadata(value: unknown): value is SnapshotMetadata {
	if (!value || typeof value !== "object") return false;
	const metadata = value as Partial<SnapshotMetadata>;
	return typeof metadata.schemaVersion === "number"
		&& typeof metadata.snapshotVersion === "string"
		&& typeof metadata.asset?.fileName === "string"
		&& typeof metadata.asset?.sha256 === "string";
}

function isSnapshot(value: unknown): value is DictionarySnapshot {
	if (!value || typeof value !== "object") return false;
	const snapshot = value as Partial<DictionarySnapshot>;
	return snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION && Array.isArray(snapshot.entries);
}
