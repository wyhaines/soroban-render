import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveRenderView } from "./InteractiveRenderView";
import type { SorobanClient } from "../utils/client";

// Mock the transaction module
vi.mock("../utils/transaction", () => ({
  submitTransaction: vi.fn(),
}));

import { submitTransaction } from "../utils/transaction";

const mockSubmitTransaction = vi.mocked(submitTransaction);

describe("InteractiveRenderView", () => {
  const mockClient = {} as SorobanClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("should render loading state", () => {
      render(<InteractiveRenderView html={null} loading={true} />);

      expect(screen.getByText("Loading contract UI...")).toBeInTheDocument();
    });

    it("should render custom loading component", () => {
      render(
        <InteractiveRenderView
          html={null}
          loading={true}
          loadingComponent={<div>Custom Loading</div>}
        />
      );

      expect(screen.getByText("Custom Loading")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("should render error state", () => {
      render(<InteractiveRenderView html={null} error="Something went wrong" />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should render custom error component", () => {
      render(
        <InteractiveRenderView
          html={null}
          error="Error"
          errorComponent={<div>Custom Error</div>}
        />
      );

      expect(screen.getByText("Custom Error")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should render empty state", () => {
      render(<InteractiveRenderView html={null} />);

      expect(screen.getByText("No content to display")).toBeInTheDocument();
    });
  });

  describe("content rendering", () => {
    it("should render HTML content", () => {
      const { container } = render(
        <InteractiveRenderView html="<p>Hello World</p>" />
      );

      expect(container.querySelector("p")).toHaveTextContent("Hello World");
    });
  });

  describe("render: protocol links", () => {
    it("should call onPathChange for render: links", async () => {
      const onPathChange = vi.fn();

      render(
        <InteractiveRenderView
          html='<a href="#" data-action="render:/tasks">View Tasks</a>'
          onPathChange={onPathChange}
        />
      );

      fireEvent.click(screen.getByText("View Tasks"));

      expect(onPathChange).toHaveBeenCalledWith("/tasks");
    });

    it("should navigate without collecting form inputs for render: links", async () => {
      const onPathChange = vi.fn();

      render(
        <InteractiveRenderView
          html={`
            <input name="search" value="test query" />
            <a href="#" data-action="render:/search">Search</a>
          `}
          onPathChange={onPathChange}
        />
      );

      fireEvent.click(screen.getByText("Search"));

      // render: links navigate directly to the path without collecting form inputs
      // Form input collection is only for form: protocol links
      expect(onPathChange).toHaveBeenCalledWith("/search");
    });

    it("should not prevent standard links", async () => {
      const onPathChange = vi.fn();

      render(
        <InteractiveRenderView
          html='<a href="https://example.com">External Link</a>'
          onPathChange={onPathChange}
        />
      );

      // Standard links should not trigger onPathChange
      fireEvent.click(screen.getByText("External Link"));

      expect(onPathChange).not.toHaveBeenCalled();
    });
  });

  describe("tx: protocol links", () => {
    it("should submit transaction for tx: links", async () => {
      const onTransactionStart = vi.fn();
      const onTransactionComplete = vi.fn();
      mockSubmitTransaction.mockResolvedValue({ success: true });

      // Use single quotes for the JSON to avoid HTML escaping issues
      render(
        <InteractiveRenderView
          html={`<a href="#" data-action='tx:complete_task {"id":1}'>Complete</a>`}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GADDRESS123"
          onTransactionStart={onTransactionStart}
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.click(screen.getByText("Complete"));

      await waitFor(() => {
        expect(onTransactionStart).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockSubmitTransaction).toHaveBeenCalledWith(
          mockClient,
          "CONTRACT123",
          {
            method: "complete_task",
            args: { id: 1, caller: "GADDRESS123" },
          },
          "GADDRESS123"
        );
      });

      await waitFor(() => {
        expect(onTransactionComplete).toHaveBeenCalledWith({ success: true });
      });
    });

    it("should error when wallet not connected", async () => {
      const onError = vi.fn();

      render(
        <InteractiveRenderView
          html='<a href="#" data-action="tx:some_method">Submit</a>'
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress={null} // Not connected
          onError={onError}
        />
      );

      fireEvent.click(screen.getByText("Submit"));

      expect(onError).toHaveBeenCalledWith("Wallet not connected");
    });

    it("should handle transaction errors", async () => {
      const onError = vi.fn();
      const onTransactionComplete = vi.fn();
      mockSubmitTransaction.mockResolvedValue({
        success: false,
        error: "Transaction failed",
      });

      render(
        <InteractiveRenderView
          html='<a href="#" data-action="tx:method">Submit</a>'
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GADDRESS123"
          onError={onError}
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(onTransactionComplete).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith("Transaction failed");
      });
    });
  });

  describe("form: protocol links", () => {
    it("should submit form inputs as transaction", async () => {
      const onTransactionComplete = vi.fn();
      mockSubmitTransaction.mockResolvedValue({ success: true });

      render(
        <InteractiveRenderView
          html={`
            <input name="description" value="Test task" />
            <a href="#" data-action="form:add_task">Add Task</a>
          `}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GADDRESS123"
          onTransactionComplete={onTransactionComplete}
        />
      );

      fireEvent.click(screen.getByText("Add Task"));

      await waitFor(() => {
        expect(mockSubmitTransaction).toHaveBeenCalledWith(
          mockClient,
          "CONTRACT123",
          {
            method: "add_task",
            args: { description: "Test task", caller: "GADDRESS123" },
          },
          "GADDRESS123"
        );
      });
    });

    it("should error when form is empty", async () => {
      const onError = vi.fn();

      render(
        <InteractiveRenderView
          html={`
            <input name="description" value="" />
            <a href="#" data-action="form:add_task">Add Task</a>
          `}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress="GADDRESS123"
          onError={onError}
        />
      );

      fireEvent.click(screen.getByText("Add Task"));

      expect(onError).toHaveBeenCalledWith("Please fill in the form fields");
      expect(mockSubmitTransaction).not.toHaveBeenCalled();
    });

    it("should error when wallet not connected", async () => {
      const onError = vi.fn();

      render(
        <InteractiveRenderView
          html={`
            <input name="description" value="Test" />
            <a href="#" data-action="form:add_task">Add Task</a>
          `}
          client={mockClient}
          contractId="CONTRACT123"
          walletAddress={null}
          onError={onError}
        />
      );

      fireEvent.click(screen.getByText("Add Task"));

      expect(onError).toHaveBeenCalledWith("Wallet not connected");
    });
  });

  describe("styling", () => {
    it("should apply className", () => {
      const { container } = render(
        <InteractiveRenderView html="<p>Test</p>" className="my-class" />
      );

      expect(container.querySelector(".soroban-render-view")).toHaveClass(
        "my-class"
      );
    });

    it("should apply style", () => {
      const { container } = render(
        <InteractiveRenderView
          html="<p>Test</p>"
          style={{ backgroundColor: "red" }}
        />
      );

      const view = container.querySelector(".soroban-render-view") as HTMLElement;
      expect(view.style.backgroundColor).toBe("red");
    });
  });
});
