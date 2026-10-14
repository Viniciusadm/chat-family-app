import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { MessageRepository } from "@/lib/MessageRepository";
import { debounce } from "@/lib/debounce";
import {
  normalize,
  searchMessages,
  type SearchResult,
  type SearchableMessage,
} from "@/lib/searchMessages";

interface IndexState {
  index: SearchableMessage[];
  loading: boolean;
  error: Error | null;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;
const RESULT_LIMIT = 50;
const INDEX_RELOAD_DELAY_MS = 1_000;

export function useMessageSearch() {
  const { tenantId, currentUser } = useAuth();
  const memberId = currentUser?.id ?? null;
  const [state, setState] = useState<IndexState>({
    index: [],
    loading: true,
    error: null,
  });
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(rawQuery);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawQuery]);

  useEffect(() => {
    if (!tenantId || !memberId) {
      setState({ index: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const data = await MessageRepository.getAllTextMessages(tenantId, memberId);
        if (cancelled) return;
        const index = data.map((message) => ({
          ...message,
          normalizedContent: normalize(message.content),
        }));
        setState({ index, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          index: [],
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    };

    void load();
    const scheduleLoad = debounce(() => void load(), INDEX_RELOAD_DELAY_MS);
    const unsubscribe = MessageRepository.subscribeAll(scheduleLoad);

    return () => {
      cancelled = true;
      scheduleLoad.cancel();
      unsubscribe();
    };
  }, [memberId, tenantId]);

  const trimmedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const results = useMemo<SearchResult[]>(() => {
    if (!isSearching) return [];
    return searchMessages(state.index, trimmedQuery, { limit: RESULT_LIMIT });
  }, [isSearching, state.index, trimmedQuery]);

  return {
    query: rawQuery,
    setQuery: setRawQuery,
    results,
    loading: state.loading,
    error: state.error,
    isSearching: rawQuery.trim().length >= MIN_QUERY_LENGTH,
  };
}
