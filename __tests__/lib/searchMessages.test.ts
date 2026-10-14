import {
  normalize,
  searchMessages,
  tokenize,
  type SearchableMessage,
} from "@/lib/searchMessages";

function message(
  id: string,
  content: string,
  createdAtMs = 0,
): SearchableMessage {
  return { id, chatId: "c1", senderId: "u1", content, createdAtMs };
}

describe("normalize", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Ação CORAÇÃO Você Pão")).toBe("acao coracao voce pao");
  });

  it("keeps characters without diacritics untouched", () => {
    expect(normalize("abc 123 !?")).toBe("abc 123 !?");
  });
});

describe("tokenize", () => {
  it("splits on any whitespace and drops empty tokens", () => {
    expect(tokenize("  Olá\tMundo \n  Bonito ")).toEqual(["ola", "mundo", "bonito"]);
  });

  it("returns no tokens for a blank query", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("searchMessages", () => {
  it("returns nothing for a blank query", () => {
    expect(searchMessages([message("1", "qualquer coisa")], "  ")).toEqual([]);
  });

  it("matches ignoring accents and case in both query and content", () => {
    const index = [message("1", "Vamos à PADARIA comprar pão"), message("2", "nada aqui")];
    const results = searchMessages(index, "pao")
      .concat(searchMessages(index, "Padaria"));
    expect(results.map((r) => r.message.id)).toEqual(["1", "1"]);
  });

  it("matches an accented query against unaccented content", () => {
    const results = searchMessages([message("1", "a reuniao foi boa")], "reunião");
    expect(results.map((r) => r.message.id)).toEqual(["1"]);
  });

  it("skips messages with empty content", () => {
    expect(searchMessages([message("1", "")], "a")).toEqual([]);
  });

  it("uses the precomputed normalizedContent when present", () => {
    const indexed = { ...message("1", "conteúdo original"), normalizedContent: "outro texto" };
    expect(searchMessages([indexed], "outro")).toHaveLength(1);
    expect(searchMessages([indexed], "original")).toHaveLength(0);
  });

  it("matches a single-typo word of at least four characters fuzzily", () => {
    const results = searchMessages([message("1", "vamos ao mercado amanha")], "mercadi");
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(20);
  });

  it("does not fuzzy-match tokens shorter than four characters", () => {
    expect(searchMessages([message("1", "um gato")], "rat")).toEqual([]);
  });

  it("ranks an exact phrase above scattered tokens", () => {
    const index = [
      message("scattered", "jantar ficou para depois, bom dia", 200),
      message("phrase", "bom jantar para todos", 100),
    ];
    const results = searchMessages(index, "bom jantar");
    expect(results.map((r) => r.message.id)).toEqual(["phrase", "scattered"]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("ranks whole-word matches above partial substring matches", () => {
    const index = [
      message("partial", "casamento no sábado", 200),
      message("whole", "a casa está limpa", 100),
    ];
    const results = searchMessages(index, "casa");
    expect(results.map((r) => r.message.id)).toEqual(["whole", "partial"]);
  });

  it("orders ties by most recent first", () => {
    const index = [
      message("old", "bolo de chocolate", 1),
      message("new", "bolo de cenoura", 3),
      message("mid", "bolo de milho", 2),
    ];
    expect(searchMessages(index, "bolo").map((r) => r.message.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("respects the limit option", () => {
    const index = Array.from({ length: 10 }, (_, i) => message(String(i), "oi", i));
    const results = searchMessages(index, "oi", { limit: 3 });
    expect(results.map((r) => r.message.id)).toEqual(["9", "8", "7"]);
  });

  it("defaults to a limit of 50 results", () => {
    const index = Array.from({ length: 60 }, (_, i) => message(String(i), "oi", i));
    expect(searchMessages(index, "oi")).toHaveLength(50);
  });

  it("highlights the matched range in the original content", () => {
    const [result] = searchMessages([message("1", "Comprei Pão hoje")], "pao");
    expect(result.snippet.text).toBe("Comprei Pão hoje");
    expect(result.snippet.ranges).toEqual([{ start: 8, end: 11 }]);
    const { start, end } = result.snippet.ranges[0];
    expect(result.snippet.text.slice(start, end)).toBe("Pão");
  });

  it("merges overlapping phrase and token highlight ranges", () => {
    const [result] = searchMessages([message("1", "bom dia família")], "bom dia");
    expect(result.snippet.ranges).toEqual([{ start: 0, end: 7 }]);
  });

  it("windows long content around the match with ellipses", () => {
    const content = `${"a ".repeat(100)}alvo${" b".repeat(100)}`;
    const [result] = searchMessages([message("1", content)], "alvo");
    expect(result.snippet.text.startsWith("…")).toBe(true);
    expect(result.snippet.text.endsWith("…")).toBe(true);
    const { start, end } = result.snippet.ranges[0];
    expect(result.snippet.text.slice(start, end)).toBe("alvo");
  });

  it("falls back to the start of the content when only a fuzzy match exists", () => {
    const [result] = searchMessages([message("1", "vamos ao mercado")], "mercadi");
    expect(result.snippet).toEqual({ text: "vamos ao mercado", ranges: [] });
  });
});
