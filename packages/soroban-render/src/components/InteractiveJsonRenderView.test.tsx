import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveJsonRenderView } from "./InteractiveJsonRenderView";
import type { JsonUIDocument } from "../parsers/json";
import type { SorobanClient } from "../utils/client";
import type { TransactionResult } from "../utils/transaction";

// Mock submitTransaction
vi.mock("../utils/transaction", () => ({
  submitTransaction: vi.fn(),
}));

// Mock parseMarkdown for markdown component tests
vi.mock("../parsers/markdown", () => ({
  parseMarkdown: vi.fn().mockImplementation((content: string) =>
    Promise.resolve(`<p>${content}</p>`)
  ),
}));

import { submitTransaction } from "../utils/transaction";
const mockSubmitTransaction = vi.mocked(submitTransaction);

describe("InteractiveJsonRenderView", () => {
  let mockClient: SorobanClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      server: {} as SorobanClient["server"],
      networkPassphrase: "Test Network",
    };
  });

  describe("basic rendering", () => {
    it("should render document", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{ type: "text", content: "Hello" }],
      };

      render(<InteractiveJsonRenderView document={document} />);

      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("should apply className", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [],
      };

      const { container } = render(
        <InteractiveJsonRenderView document={document} className="custom-class" />
      );

      expect(container.querySelector(".soroban-render-json")).toHaveClass("custom-class");
    });

    it("should apply style", () => {
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [],
      };

      const { container } = render(
        <InteractiveJsonRenderView document={document} style={{ color: "red" }} />
      );

      const element = container.querySelector(".soroban-render-json") as HTMLElement;
      expect(element.style.color).toBe("red");
    });
  });

  describe("path changes", () => {
    it("should call onPathChange when navigation clicked", () => {
      const onPathChange = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "navigation",
          items: [{ label: "Home", path: "/" }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          onPathChange={onPathChange}
        />
      );

      fireEvent.click(screen.getByText("Home"));

      expect(onPathChange).toHaveBeenCalledWith("/");
    });

    it("should call onPathChange when button with render action clicked", () => {
      const onPathChange = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Go",
          action: "render",
          path: "/page",
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          onPathChange={onPathChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Go" }));

      expect(onPathChange).toHaveBeenCalledWith("/page");
    });
  });

  describe("transaction handling", () => {
    it("should error when wallet not connected (no client)", async () => {
      const onError = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Submit",
          action: "tx",
          method: "create_item",
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={null}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onError={onError}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onError).toHaveBeenCalledWith("Wallet not connected");
    });

    it("should error when wallet not connected (no contractId)", async () => {
      const onError = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Submit",
          action: "tx",
          method: "create_item",
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId={null}
          walletAddress="GUSER123"
          onError={onError}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onError).toHaveBeenCalledWith("Wallet not connected");
    });

    it("should error when wallet not connected (no walletAddress)", async () => {
      const onError = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Submit",
          action: "tx",
          method: "create_item",
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress={null}
          onError={onError}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onError).toHaveBeenCalledWith("Wallet not connected");
    });

    it("should submit transaction with caller injected", async () => {
      const successResult: TransactionResult = { success: true };
      mockSubmitTransaction.mockResolvedValue(successResult);

      const onTransactionStart = vi.fn();
      const onTransactionComplete = vi.fn();

      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Create",
          action: "tx",
          method: "create_item",
          args: { name: "Test" },
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onTransactionStart={onTransactionStart}
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => {
        expect(onTransactionStart).toHaveBeenCalled();
      });

      expect(mockSubmitTransaction).toHaveBeenCalledWith(
        mockClient,
        "CONTRACT123",
        {
          method: "create_item",
          args: { name: "Test", caller: "GUSER123" },
        },
        "GUSER123"
      );

      await waitFor(() => {
        expect(onTransactionComplete).toHaveBeenCalledWith(successResult);
      });
    });

    it("should call onError when transaction fails", async () => {
      const errorResult: TransactionResult = {
        success: false,
        error: {
          type: "contract",
          code: 1,
          message: "Operation failed",
          rawMessage: "Error(Contract, #1)",
          isRetryable: false,
        },
      };
      mockSubmitTransaction.mockResolvedValue(errorResult);

      const onError = vi.fn();
      const onTransactionComplete = vi.fn();

      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "button",
          label: "Submit",
          action: "tx",
          method: "fail_method",
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onError={onError}
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => {
        expect(onTransactionComplete).toHaveBeenCalledWith(errorResult);
        expect(onError).toHaveBeenCalledWith(errorResult.error);
      });
    });
  });

  describe("form submission", () => {
    it("should error when form submitted without wallet", async () => {
      const onError = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={null}
          onError={onError}
        />
      );

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Task" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onError).toHaveBeenCalledWith("Wallet not connected");
    });

    it("should error when form submitted with empty fields", async () => {
      const onError = vi.fn();
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onError={onError}
        />
      );

      // Submit without filling in fields
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(onError).toHaveBeenCalledWith("Please fill in the form fields");
    });

    it("should submit form with caller injected", async () => {
      const successResult: TransactionResult = { success: true };
      mockSubmitTransaction.mockResolvedValue(successResult);

      const onTransactionStart = vi.fn();
      const onTransactionComplete = vi.fn();

      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onTransactionStart={onTransactionStart}
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "My Task" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => {
        expect(onTransactionStart).toHaveBeenCalled();
      });

      expect(mockSubmitTransaction).toHaveBeenCalledWith(
        mockClient,
        "CONTRACT123",
        {
          method: "create_task",
          args: { title: "My Task", caller: "GUSER123" },
        },
        "GUSER123"
      );

      await waitFor(() => {
        expect(onTransactionComplete).toHaveBeenCalledWith(successResult);
      });
    });

    it("should call onError when form submission fails", async () => {
      const errorResult: TransactionResult = {
        success: false,
        error: {
          type: "contract",
          code: 2,
          message: "Validation failed",
          rawMessage: "Error(Contract, #2)",
          isRetryable: false,
        },
      };
      mockSubmitTransaction.mockResolvedValue(errorResult);

      const onError = vi.fn();

      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "form",
          action: "create_task",
          fields: [{ name: "title", type: "text" }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onError={onError}
        />
      );

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Task" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(errorResult.error);
      });
    });
  });

  describe("include component", () => {
    it("should pass onInclude to JsonRenderView", () => {
      const onInclude = vi.fn().mockReturnValue(<div>Included</div>);
      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "include",
          contract: "INCLUDE_CONTRACT",
          path: "/section",
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          onInclude={onInclude}
        />
      );

      expect(onInclude).toHaveBeenCalledWith("INCLUDE_CONTRACT", "/section");
      expect(screen.getByText("Included")).toBeInTheDocument();
    });
  });

  describe("task actions", () => {
    it("should handle task tx actions with wallet", async () => {
      const successResult: TransactionResult = { success: true };
      mockSubmitTransaction.mockResolvedValue(successResult);

      const onTransactionComplete = vi.fn();

      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "task",
          text: "Task",
          completed: false,
          actions: [{
            type: "tx",
            label: "Complete",
            method: "complete_task",
            args: { id: 1 },
          }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GUSER123"
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Complete" }));

      await waitFor(() => {
        expect(mockSubmitTransaction).toHaveBeenCalledWith(
          mockClient,
          "CONTRACT123",
          {
            method: "complete_task",
            args: { id: 1, caller: "GUSER123" },
          },
          "GUSER123"
        );
      });
    });

    it("should handle task render actions", () => {
      const onPathChange = vi.fn();

      const document: JsonUIDocument = {
        format: "soroban-render-json-v1",
        components: [{
          type: "task",
          text: "Task",
          completed: false,
          actions: [{
            type: "render",
            label: "View",
            path: "/task/1",
          }],
        }],
      };

      render(
        <InteractiveJsonRenderView
          document={document}
          onPathChange={onPathChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "View" }));

      expect(onPathChange).toHaveBeenCalledWith("/task/1");
    });
  });
});
