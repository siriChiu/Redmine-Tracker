const LEGACY_API_ORIGIN = 'http://127.0.0.1:8000';

function resolveBackendOrigin() {
    const requestedPort = Number(new URLSearchParams(window.location.search).get('backendPort'));
    const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
        ? requestedPort
        : 8000;
    return `http://127.0.0.1:${port}`;
}

export function configureBackendEndpoint() {
    const backendOrigin = resolveBackendOrigin();
    const nativeFetch = window.fetch.bind(window);
    const remap = (url: string) => url.startsWith(LEGACY_API_ORIGIN)
        ? `${backendOrigin}${url.slice(LEGACY_API_ORIGIN.length)}`
        : url;

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === 'string') return nativeFetch(remap(input), init);
        if (input instanceof URL) return nativeFetch(new URL(remap(input.toString())), init);
        const remappedUrl = remap(input.url);
        return remappedUrl === input.url
            ? nativeFetch(input, init)
            : nativeFetch(new Request(remappedUrl, input), init);
    };

    document.documentElement.dataset.backendOrigin = backendOrigin;
}
