import { gzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { isMetadata, parseSnapshot, SNAPSHOT_SCHEMA_VERSION } from "../src/dictionary/types";

describe("dictionary snapshot validation", () => {
	it("accepts a compatible compressed snapshot", () => {
		const compressed = gzipSync(new TextEncoder().encode(JSON.stringify({
			schemaVersion: SNAPSHOT_SCHEMA_VERSION,
			entries: [],
		})));
		expect(parseSnapshot(compressed)).toEqual({ schemaVersion: 1, entries: [] });
	});

	it("rejects an incompatible snapshot schema", () => {
		const compressed = gzipSync(new TextEncoder().encode(JSON.stringify({ schemaVersion: 99, entries: [] })));
		expect(() => parseSnapshot(compressed)).toThrow("not a supported Kotoba Insert dictionary");
	});

	it("requires metadata fields needed for secure installation", () => {
		expect(isMetadata({ schemaVersion: 1, snapshotVersion: "2026-08-15", asset: { fileName: "dictionary.json.gz", sha256: "abc", bytes: 1 } })).toBe(true);
		expect(isMetadata({ schemaVersion: 1, asset: {} })).toBe(false);
	});
});
