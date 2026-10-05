// Offer search box controller (pre-React-Query, still used on the Shop page).
// The view calls onQueryChange on every keystroke and renders whatever
// onUpdate gives it.

export type Offer = { id: string; brand: string; title: string };

export type SearchState = {
  query: string;
  results: Offer[];
  loading: boolean;
  error: string | null;
};

export type Fetcher = (query: string) => Promise<Offer[]>;

export class OfferSearch {
  private state: SearchState = { query: "", results: [], loading: false, error: null };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private fetcher: Fetcher;
  private onUpdate: (s: SearchState) => void;
  private delayMs: number;

  constructor(fetcher: Fetcher, onUpdate: (s: SearchState) => void, delayMs = 250) {
    this.fetcher = fetcher;
    this.onUpdate = onUpdate;
    this.delayMs = delayMs;
  }

  onQueryChange(query: string) {
    this.set({ query });
    clearTimeout(this.timer);

    if (query.trim().length < 2) {
      this.set({ results: [], loading: false });
      return;
    }

    this.timer = setTimeout(() => this.run(query), this.delayMs);
  }

  private async run(query: string) {
    this.set({ loading: true, error: null });
    try {
      const results = await this.fetcher(query.trim());
      this.set({ results, loading: false });
    } catch (e) {
      this.set({ error: "Search failed", loading: false });
    }
  }

  dispose() {
    clearTimeout(this.timer);
  }

  private set(patch: Partial<SearchState>) {
    this.state = { ...this.state, ...patch };
    this.onUpdate(this.state);
  }
}
