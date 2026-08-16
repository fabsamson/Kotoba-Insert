export function completionEndpoint(baseUrl: string): string {
	let parsed: URL;
	try {
		parsed = new URL(baseUrl.trim());
	} catch {
		throw new Error("Enter a valid AI API base URL in Kotoba Insert settings.");
	}
	if (parsed.username || parsed.password || parsed.search || parsed.hash) {
		throw new Error("The AI API base URL cannot include credentials, a query, or a fragment.");
	}
	if (parsed.protocol !== "https:" && !isLocalAddress(parsed)) {
		throw new Error("AI API URLs must use HTTPS, except for a local server.");
	}
	parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/chat/completions`;
	return parsed.toString();
}

function isLocalAddress(url: URL): boolean {
	return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}
