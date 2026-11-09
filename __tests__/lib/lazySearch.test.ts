jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ tenantId: "tenant", currentUser: { id: "me" } }),
}));
jest.mock("@/lib/MessageRepository", () => ({
  MessageRepository: { getAllTextMessages: jest.fn(), subscribeAll: jest.fn() },
}));

import { createElement } from "react";
import { useMessageSearch } from "@/hooks/useMessageSearch";
import { MessageRepository } from "@/lib/MessageRepository";

const { act, create } = jest.requireActual("react-test-renderer");

it("builds and refreshes the search index only while a query is active", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.mocked(MessageRepository.getAllTextMessages).mockResolvedValue([
    { id: "message", chatId: "chat", senderId: "me", content: "Olá mundo", createdAtMs: 1 },
  ]);
  let onChange: (() => void) | undefined;
  const unsubscribe = jest.fn(() => { onChange = undefined; });
  jest.mocked(MessageRepository.subscribeAll).mockImplementation((listener) => {
    onChange = listener;
    return unsubscribe;
  });
  let search: ReturnType<typeof useMessageSearch> | undefined;
  function Harness() { search = useMessageSearch(); return null; }
  let root: { unmount: () => void } | undefined;
  try {
    await act(async () => { root = create(createElement(Harness)); });
    expect(MessageRepository.getAllTextMessages).not.toHaveBeenCalled();
    expect(MessageRepository.subscribeAll).not.toHaveBeenCalled();
    await act(async () => { search!.setQuery("ola"); });
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(search!.results).toHaveLength(1);
    expect(MessageRepository.getAllTextMessages).toHaveBeenCalledTimes(1);
    await act(async () => { onChange!(); jest.advanceTimersByTime(1000); });
    expect(MessageRepository.getAllTextMessages).toHaveBeenCalledTimes(2);
    await act(async () => { search!.setQuery(""); });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await act(async () => { onChange?.(); jest.advanceTimersByTime(2000); });
    expect(MessageRepository.getAllTextMessages).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => { root?.unmount(); });
    jest.useRealTimers();
  }
});
