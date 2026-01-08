import { describe, it, expect } from "vitest";
import {
  parseIncludes,
  replaceInclude,
  hasIncludes,
  createIncludeKey,
  hasCustomParams,
} from "./include";

describe("parseIncludes", () => {
  it("should parse a simple include tag", () => {
    const content = 'Some text {{include contract=CABC123}} more text';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("CABC123");
    expect(result.includes[0].func).toBeUndefined();
    expect(result.includes[0].path).toBeUndefined();
  });

  it("should parse include with func attribute", () => {
    const content = '{{include contract=CABC123 func="header"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("CABC123");
    expect(result.includes[0].func).toBe("header");
  });

  it("should parse include with path attribute", () => {
    const content = '{{include contract=CABC123 path="/tasks"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("CABC123");
    expect(result.includes[0].path).toBe("/tasks");
  });

  it("should parse include with all attributes", () => {
    const content = '{{include contract=CABC123 func="nav" path="?page=2"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("CABC123");
    expect(result.includes[0].func).toBe("nav");
    expect(result.includes[0].path).toBe("?page=2");
  });

  it("should parse SELF keyword", () => {
    const content = '{{include contract=SELF func="footer"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("SELF");
    expect(result.includes[0].func).toBe("footer");
  });

  it("should parse multiple includes", () => {
    const content = `
      {{include contract=CABC123 func="header"}}
      Content here
      {{include contract=CABC123 func="footer"}}
    `;
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(2);
    expect(result.includes[0].func).toBe("header");
    expect(result.includes[1].func).toBe("footer");
  });

  it("should handle single-quoted attributes", () => {
    const content = "{{include contract='CABC123' func='header'}}";
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("CABC123");
    expect(result.includes[0].func).toBe("header");
  });

  it("should handle unquoted attributes", () => {
    const content = "{{include contract=CABC123 func=header}}";
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("CABC123");
    expect(result.includes[0].func).toBe("header");
  });

  it("should skip includes without contract attribute", () => {
    const content = '{{include func="header"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(0);
  });

  it("should return empty array for content without includes", () => {
    const content = "Just some regular markdown content";
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(0);
    expect(result.content).toBe(content);
  });

  it("should preserve start and end indices", () => {
    const content = "prefix{{include contract=ABC}}suffix";
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].startIndex).toBe(6);
    expect(result.includes[0].endIndex).toBe(30);
    expect(result.includes[0].original).toBe("{{include contract=ABC}}");
  });

  it("should work correctly when called multiple times", () => {
    const content = "{{include contract=ABC}}";

    // Call twice to ensure regex state is reset properly
    const result1 = parseIncludes(content);
    const result2 = parseIncludes(content);

    expect(result1.includes).toHaveLength(1);
    expect(result2.includes).toHaveLength(1);
  });
});

describe("replaceInclude", () => {
  it("should replace an include with new content", () => {
    const content = "before{{include contract=ABC}}after";
    const parsed = parseIncludes(content);
    const replacement = "[REPLACED]";

    const result = replaceInclude(content, parsed.includes[0], replacement);

    expect(result).toBe("before[REPLACED]after");
  });

  it("should handle replacement with empty string", () => {
    const content = "before{{include contract=ABC}}after";
    const parsed = parseIncludes(content);

    const result = replaceInclude(content, parsed.includes[0], "");

    expect(result).toBe("beforeafter");
  });

  it("should handle replacement with longer content", () => {
    const content = "{{include contract=X}}";
    const parsed = parseIncludes(content);
    const replacement = "This is a much longer replacement text";

    const result = replaceInclude(content, parsed.includes[0], replacement);

    expect(result).toBe(replacement);
  });
});

describe("hasIncludes", () => {
  it("should return true when content has includes", () => {
    expect(hasIncludes("text {{include contract=ABC}} more")).toBe(true);
  });

  it("should return false when content has no includes", () => {
    expect(hasIncludes("just regular text")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(hasIncludes("")).toBe(false);
  });

  it("should return false for partial/malformed includes", () => {
    expect(hasIncludes("{{include contract=")).toBe(false);
    expect(hasIncludes("include contract=ABC}}")).toBe(false);
  });

  it("should work correctly when called multiple times", () => {
    const content = "{{include contract=ABC}}";

    // Call twice to ensure regex state is reset properly
    expect(hasIncludes(content)).toBe(true);
    expect(hasIncludes(content)).toBe(true);
  });
});

describe("createIncludeKey", () => {
  it("should create key with all parts", () => {
    const key = createIncludeKey("CABC123", "header", "/path");
    expect(key).toBe("CABC123:header|/path|");
  });

  it("should create key without func", () => {
    const key = createIncludeKey("CABC123", undefined, "/path");
    expect(key).toBe("CABC123:|/path|");
  });

  it("should create key without path", () => {
    const key = createIncludeKey("CABC123", "header");
    expect(key).toBe("CABC123:header||");
  });

  it("should create key with only contract", () => {
    const key = createIncludeKey("CABC123");
    expect(key).toBe("CABC123:||");
  });

  it("should create key with params", () => {
    const key = createIncludeKey("CABC123", "nav_include", undefined, {
      viewer: true,
      return_path: "@main:/b/1",
    });
    // Params are sorted alphabetically
    expect(key).toBe("CABC123:nav_include||return_path=@main:/b/1,viewer");
  });

  it("should create consistent keys regardless of param order", () => {
    const key1 = createIncludeKey("CABC123", "func", undefined, {
      b_param: "second",
      a_param: "first",
    });
    const key2 = createIncludeKey("CABC123", "func", undefined, {
      a_param: "first",
      b_param: "second",
    });
    expect(key1).toBe(key2);
  });
});

describe("parseIncludes - parameterized mode", () => {
  it("should parse flag attributes (no value)", () => {
    const content = '{{include contract=@main func="nav_include" viewer}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].contract).toBe("@main");
    expect(result.includes[0].func).toBe("nav_include");
    expect(result.includes[0].params).toEqual({ viewer: true });
  });

  it("should parse named parameters with values", () => {
    const content =
      '{{include contract=@main func="nav_include" return_path="@main:/b/1"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].params).toEqual({ return_path: "@main:/b/1" });
  });

  it("should parse mixed flags and named parameters", () => {
    const content =
      '{{include contract=@main func="render_nav_include" viewer return_path="@main:/b/1"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    const include = result.includes[0];
    expect(include.contract).toBe("@main");
    expect(include.func).toBe("render_nav_include");
    expect(include.params).toEqual({
      viewer: true,
      return_path: "@main:/b/1",
    });
  });

  it("should handle params with alias references", () => {
    const content =
      '{{include contract=@main func="widget" board_link="@boards:/b/5"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].params).toEqual({ board_link: "@boards:/b/5" });
  });

  it("should separate standard attrs from params", () => {
    const content =
      '{{include contract=CABC123 func="header" path="/home" viewer custom="value"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    const include = result.includes[0];
    // Standard attrs
    expect(include.contract).toBe("CABC123");
    expect(include.func).toBe("header");
    expect(include.path).toBe("/home");
    // Custom params
    expect(include.params).toEqual({ viewer: true, custom: "value" });
  });

  it("should have empty params for legacy includes", () => {
    const content = '{{include contract=CABC123 func="footer"}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].params).toEqual({});
  });

  it("should handle multiple params", () => {
    const content =
      '{{include contract=@main func="complex" viewer page_id="5" offset="10" include_hidden}}';
    const result = parseIncludes(content);

    expect(result.includes).toHaveLength(1);
    expect(result.includes[0].params).toEqual({
      viewer: true,
      page_id: "5",
      offset: "10",
      include_hidden: true,
    });
  });
});

describe("hasCustomParams", () => {
  it("should return true when params exist", () => {
    const content = '{{include contract=@main func="nav" viewer}}';
    const result = parseIncludes(content);

    expect(hasCustomParams(result.includes[0])).toBe(true);
  });

  it("should return false when no params", () => {
    const content = '{{include contract=@main func="nav"}}';
    const result = parseIncludes(content);

    expect(hasCustomParams(result.includes[0])).toBe(false);
  });

  it("should return true for named param", () => {
    const content = '{{include contract=ABC custom="value"}}';
    const result = parseIncludes(content);

    expect(hasCustomParams(result.includes[0])).toBe(true);
  });
});
