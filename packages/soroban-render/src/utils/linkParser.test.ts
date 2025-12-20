import { describe, it, expect, beforeEach } from "vitest";
import { parseLink, collectFormInputs, buildPathWithParams } from "./linkParser";

describe("parseLink", () => {
  describe("render: protocol", () => {
    it("should parse render with path", () => {
      const result = parseLink("render:/tasks");

      expect(result.protocol).toBe("render");
      expect(result.path).toBe("/tasks");
      expect(result.functionName).toBeUndefined();
    });

    it("should parse render with empty path", () => {
      const result = parseLink("render:/");

      expect(result.protocol).toBe("render");
      expect(result.path).toBe("/");
      expect(result.functionName).toBeUndefined();
    });

    it("should parse render with query params", () => {
      const result = parseLink("render:/?filter=active");

      expect(result.protocol).toBe("render");
      expect(result.path).toBe("/?filter=active");
    });

    it("should parse render with just query params", () => {
      const result = parseLink("render:?page=2");

      expect(result.protocol).toBe("render");
      expect(result.path).toBe("?page=2");
    });

    it("should parse render: alone as empty path", () => {
      const result = parseLink("render:");

      expect(result.protocol).toBe("render");
      expect(result.path).toBeUndefined();
    });

    it("should parse render with function name only", () => {
      const result = parseLink("render:header");

      expect(result.protocol).toBe("render");
      expect(result.functionName).toBe("header");
      expect(result.path).toBeUndefined();
    });

    it("should parse render with function name and path", () => {
      const result = parseLink("render:header/main");

      expect(result.protocol).toBe("render");
      expect(result.functionName).toBe("header");
      expect(result.path).toBe("/main");
    });

    it("should parse render with function name and query", () => {
      const result = parseLink("render:nav?active=home");

      expect(result.protocol).toBe("render");
      expect(result.functionName).toBe("nav");
      expect(result.path).toBe("?active=home");
    });
  });

  describe("tx: protocol", () => {
    it("should parse tx with method only", () => {
      const result = parseLink("tx:submit");

      expect(result.protocol).toBe("tx");
      expect(result.method).toBe("submit");
      expect(result.args).toEqual({});
    });

    it("should parse tx with method and JSON args", () => {
      const result = parseLink('tx:add_task {"name":"Test"}');

      expect(result.protocol).toBe("tx");
      expect(result.method).toBe("add_task");
      expect(result.args).toEqual({ name: "Test" });
    });

    it("should parse tx with complex JSON args", () => {
      const result = parseLink('tx:update {"id":1,"completed":true,"tags":["a","b"]}');

      expect(result.protocol).toBe("tx");
      expect(result.method).toBe("update");
      expect(result.args).toEqual({
        id: 1,
        completed: true,
        tags: ["a", "b"],
      });
    });

    it("should handle invalid JSON gracefully", () => {
      const result = parseLink("tx:method {invalid json}");

      expect(result.protocol).toBe("tx");
      expect(result.method).toBe("method");
      expect(result.args).toEqual({});
    });

    it("should trim method name", () => {
      const result = parseLink("tx:  method_name  ");

      expect(result.method).toBe("method_name");
    });

    describe("with .send= parameter", () => {
      it("should parse tx with .send parameter only", () => {
        const result = parseLink("tx:donate .send=1000000");

        expect(result.protocol).toBe("tx");
        expect(result.method).toBe("donate");
        expect(result.args).toEqual({});
        expect(result.sendAmount).toBe("1000000");
      });

      it("should parse tx with args and .send parameter", () => {
        const result = parseLink('tx:purchase {"item_id":42} .send=5000000');

        expect(result.protocol).toBe("tx");
        expect(result.method).toBe("purchase");
        expect(result.args).toEqual({ item_id: 42 });
        expect(result.sendAmount).toBe("5000000");
      });

      it("should parse tx with complex args and .send", () => {
        const result = parseLink('tx:transfer {"to":"GA...","memo":"test"} .send=10000000');

        expect(result.protocol).toBe("tx");
        expect(result.method).toBe("transfer");
        expect(result.args).toEqual({ to: "GA...", memo: "test" });
        expect(result.sendAmount).toBe("10000000");
      });

      it("should handle tx without .send (backward compatibility)", () => {
        const result = parseLink('tx:add_task {"name":"Test"}');

        expect(result.sendAmount).toBeUndefined();
      });

      it("should handle .send with large amount (10 XLM = 100000000 stroops)", () => {
        const result = parseLink("tx:donate .send=100000000");

        expect(result.sendAmount).toBe("100000000");
      });
    });

    describe("with user-settable parameters", () => {
      it("should detect empty string as user-settable param", () => {
        const result = parseLink('tx:post {"message":""}');

        expect(result.protocol).toBe("tx");
        expect(result.method).toBe("post");
        expect(result.args).toEqual({ message: "" });
        expect(result.userSettableParams).toEqual(["message"]);
      });

      it("should detect multiple empty params", () => {
        const result = parseLink('tx:transfer {"to":"","amount":""}');

        expect(result.userSettableParams).toEqual(["to", "amount"]);
      });

      it("should detect mixed filled and empty params", () => {
        const result = parseLink('tx:update {"id":1,"name":""}');

        expect(result.args).toEqual({ id: 1, name: "" });
        expect(result.userSettableParams).toEqual(["name"]);
      });

      it("should not set userSettableParams when all params have values", () => {
        const result = parseLink('tx:update {"id":1,"name":"test"}');

        expect(result.userSettableParams).toBeUndefined();
      });

      it("should handle user-settable params with .send", () => {
        const result = parseLink('tx:donate {"message":""} .send=1000000');

        expect(result.userSettableParams).toEqual(["message"]);
        expect(result.sendAmount).toBe("1000000");
      });
    });
  });

  describe("form: protocol", () => {
    it("should parse form protocol", () => {
      const result = parseLink("form:add_task");

      expect(result.protocol).toBe("form");
      expect(result.method).toBe("add_task");
    });

    it("should trim method name", () => {
      const result = parseLink("form:  submit_form  ");

      expect(result.method).toBe("submit_form");
    });
  });

  describe("standard protocol", () => {
    it("should identify standard http links", () => {
      const result = parseLink("https://example.com");

      expect(result.protocol).toBe("standard");
      expect(result.href).toBe("https://example.com");
    });

    it("should identify relative links", () => {
      const result = parseLink("/path/to/page");

      expect(result.protocol).toBe("standard");
      expect(result.href).toBe("/path/to/page");
    });

    it("should identify mailto links", () => {
      const result = parseLink("mailto:test@example.com");

      expect(result.protocol).toBe("standard");
    });

    it("should identify anchor links", () => {
      const result = parseLink("#section");

      expect(result.protocol).toBe("standard");
    });
  });
});

describe("collectFormInputs", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should collect text input values", () => {
    container.innerHTML = '<input name="username" type="text" value="john" />';

    const result = collectFormInputs(container);

    expect(result).toEqual({ username: "john" });
  });

  it("should collect multiple inputs", () => {
    container.innerHTML = `
      <input name="first" type="text" value="John" />
      <input name="last" type="text" value="Doe" />
    `;

    const result = collectFormInputs(container);

    expect(result).toEqual({ first: "John", last: "Doe" });
  });

  it("should collect select values", () => {
    container.innerHTML = `
      <select name="color">
        <option value="red">Red</option>
        <option value="blue" selected>Blue</option>
      </select>
    `;

    const result = collectFormInputs(container);

    expect(result).toEqual({ color: "blue" });
  });

  it("should collect textarea values", () => {
    container.innerHTML = '<textarea name="description">Some text</textarea>';

    const result = collectFormInputs(container);

    expect(result).toEqual({ description: "Some text" });
  });

  it("should collect checked checkbox values", () => {
    container.innerHTML = `
      <input name="agreed" type="checkbox" value="yes" checked />
      <input name="newsletter" type="checkbox" value="yes" />
    `;

    const result = collectFormInputs(container);

    expect(result).toEqual({ agreed: "yes" });
    expect(result.newsletter).toBeUndefined();
  });

  it("should use 'on' for checkbox without value", () => {
    container.innerHTML = '<input name="agreed" type="checkbox" checked />';

    const result = collectFormInputs(container);

    expect(result).toEqual({ agreed: "on" });
  });

  it("should collect checked radio values", () => {
    container.innerHTML = `
      <input name="size" type="radio" value="small" />
      <input name="size" type="radio" value="medium" checked />
      <input name="size" type="radio" value="large" />
    `;

    const result = collectFormInputs(container);

    expect(result).toEqual({ size: "medium" });
  });

  it("should skip inputs without name", () => {
    container.innerHTML = `
      <input type="text" value="no-name" />
      <input name="named" type="text" value="has-name" />
    `;

    const result = collectFormInputs(container);

    expect(result).toEqual({ named: "has-name" });
  });

  it("should only collect inputs before specified element", () => {
    container.innerHTML = `
      <input name="before1" type="text" value="a" />
      <input name="before2" type="text" value="b" />
      <button id="marker">Click</button>
      <input name="after" type="text" value="c" />
    `;

    const marker = container.querySelector("#marker") as HTMLElement;
    const result = collectFormInputs(container, marker);

    expect(result).toEqual({ before1: "a", before2: "b" });
    expect(result.after).toBeUndefined();
  });
});

describe("buildPathWithParams", () => {
  it("should return base path with no params", () => {
    const result = buildPathWithParams("/tasks", {});

    expect(result).toBe("/tasks");
  });

  it("should skip empty string params", () => {
    const result = buildPathWithParams("/tasks", { filter: "" });

    expect(result).toBe("/tasks");
  });

  it("should add single param", () => {
    const result = buildPathWithParams("/tasks", { filter: "active" });

    expect(result).toBe("/tasks?filter=active");
  });

  it("should add multiple params", () => {
    const result = buildPathWithParams("/tasks", {
      filter: "active",
      page: "2",
    });

    expect(result).toContain("filter=active");
    expect(result).toContain("page=2");
    expect(result).toContain("&");
  });

  it("should URL encode param values", () => {
    const result = buildPathWithParams("/search", { q: "hello world" });

    expect(result).toBe("/search?q=hello%20world");
  });

  it("should URL encode param keys", () => {
    const result = buildPathWithParams("/test", { "my key": "value" });

    expect(result).toBe("/test?my%20key=value");
  });

  it("should append to existing query string", () => {
    const result = buildPathWithParams("/tasks?existing=1", { new: "2" });

    expect(result).toBe("/tasks?existing=1&new=2");
  });

  it("should handle special characters", () => {
    const result = buildPathWithParams("/", { filter: "a=b&c=d" });

    expect(result).toBe("/?filter=a%3Db%26c%3Dd");
  });
});

// Additional afterEach for cleanup
afterEach(() => {
  // Clean up any leftover DOM elements
  document.body.innerHTML = "";
});
