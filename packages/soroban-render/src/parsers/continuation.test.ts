import { describe, it, expect } from "vitest";
import {
  parseProgressiveTags,
  hasProgressiveTags,
  createTagId,
  createChunkKey,
} from "./continuation";

describe("parseProgressiveTags", () => {
  it("should parse continuation tag with from and total", () => {
    const content = '# Comments\n{{continue collection="comments" from=5 total=50}}';
    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(true);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].type).toBe("continue");
    expect(result.tags[0].collection).toBe("comments");
    expect((result.tags[0] as any).from).toBe(5);
    expect((result.tags[0] as any).total).toBe(50);
  });

  it("should parse continuation tag with only from", () => {
    const content = '{{continue collection="data" from=10}}';
    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(true);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].type).toBe("continue");
    expect((result.tags[0] as any).from).toBe(10);
    expect((result.tags[0] as any).total).toBeUndefined();
  });

  it("should parse paginated continuation tag", () => {
    const content = '{{continue collection="items" page=2 per_page=10 total=47}}';
    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(true);
    expect(result.tags).toHaveLength(1);
    const tag = result.tags[0] as any;
    expect(tag.type).toBe("continue");
    expect(tag.page).toBe(2);
    expect(tag.perPage).toBe(10);
    expect(tag.total).toBe(47);
  });

  it("should parse chunk tag", () => {
    const content = '{{chunk collection="chunks" index=3}}';
    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(true);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].type).toBe("chunk");
    expect(result.tags[0].collection).toBe("chunks");
    expect((result.tags[0] as any).index).toBe(3);
  });

  it("should parse chunk tag with placeholder", () => {
    const content = '{{chunk collection="content" index=7 placeholder="Loading..."}}';
    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(true);
    expect(result.tags).toHaveLength(1);
    const tag = result.tags[0] as any;
    expect(tag.type).toBe("chunk");
    expect(tag.index).toBe(7);
    expect(tag.placeholder).toBe("Loading...");
  });

  it("should parse multiple tags", () => {
    const content = `# Post
{{chunk collection="body" index=0}}
## Comments
{{continue collection="comments" from=0 total=10}}`;

    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(true);
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].type).toBe("chunk");
    expect(result.tags[1].type).toBe("continue");
  });

  it("should replace tags with placeholder divs", () => {
    const content = '{{chunk collection="test" index=5}}';
    const result = parseProgressiveTags(content);

    expect(result.content).toContain('data-progressive-id="chunk-test-5"');
    expect(result.content).toContain('data-type="chunk"');
    expect(result.content).toContain('data-collection="test"');
    expect(result.content).toContain('data-index="5"');
  });

  it("should include placeholder text in div", () => {
    const content = '{{chunk collection="x" index=0 placeholder="Wait..."}}';
    const result = parseProgressiveTags(content);

    expect(result.content).toContain(">Wait...</div>");
  });

  it("should return original content when no tags", () => {
    const content = "# Hello\nNo progressive tags here.";
    const result = parseProgressiveTags(content);

    expect(result.hasProgressive).toBe(false);
    expect(result.tags).toHaveLength(0);
    expect(result.content).toBe(content);
  });
});

describe("hasProgressiveTags", () => {
  it("should return true for continuation tag", () => {
    expect(hasProgressiveTags('{{continue collection="x" from=0}}')).toBe(true);
  });

  it("should return true for chunk tag", () => {
    expect(hasProgressiveTags('{{chunk collection="x" index=0}}')).toBe(true);
  });

  it("should return false for no tags", () => {
    expect(hasProgressiveTags("# Normal content")).toBe(false);
  });
});

describe("createTagId", () => {
  it("should create chunk tag id", () => {
    const id = createTagId({
      type: "chunk",
      collection: "test",
      index: 5,
      position: 0,
      length: 0,
    });
    expect(id).toBe("chunk-test-5");
  });

  it("should create continue tag id", () => {
    const id = createTagId({
      type: "continue",
      collection: "data",
      from: 10,
      position: 0,
      length: 0,
    });
    expect(id).toBe("continue-data-10");
  });
});

describe("createChunkKey", () => {
  it("should create cache key", () => {
    expect(createChunkKey("comments", 3)).toBe("comments:3");
  });
});
