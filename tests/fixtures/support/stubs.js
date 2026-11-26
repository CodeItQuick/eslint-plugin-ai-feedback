// Fixture for no-unrestored-fake: support helpers that set fakes.
export function stubScore(value) {
    vi.stubGlobal('score', value);
}

export function resetScore() {
    vi.unstubAllGlobals();
}

export const freezeClock = () => {
    vi.useFakeTimers();
    afterEach(() => { vi.useRealTimers(); });
};
