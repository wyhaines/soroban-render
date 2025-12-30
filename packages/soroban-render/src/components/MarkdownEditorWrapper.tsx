import React, { useState, useEffect } from "react";
import MDEditor from "@uiw/react-md-editor";

export interface MarkdownEditorWrapperProps {
  name: string;
  initialValue: string;
  placeholder?: string;
  rows?: number;
  onChange?: (value: string) => void;
}

// Force text visibility in the markdown editor
// MDEditor uses a layered approach - textarea for input, pre/code for display
const editorOverrideStyles = `
  .md-editor-wrapper,
  .md-editor-wrapper * {
    --color-fg-default: #e0e0e0 !important;
    --color-canvas-default: #1e1e1e !important;
  }
  .md-editor-wrapper .w-md-editor {
    background-color: #1e1e1e !important;
    color: #e0e0e0 !important;
  }
  .md-editor-wrapper .w-md-editor-toolbar {
    background-color: #2d2d2d !important;
    border-color: #444 !important;
  }
  .md-editor-wrapper .w-md-editor-toolbar li > button {
    color: #ccc !important;
  }
  .md-editor-wrapper .w-md-editor-content,
  .md-editor-wrapper .w-md-editor-area,
  .md-editor-wrapper .w-md-editor-input {
    background-color: #1e1e1e !important;
    color: #e0e0e0 !important;
  }
  /* Target ALL text elements inside the editor */
  .md-editor-wrapper pre,
  .md-editor-wrapper code,
  .md-editor-wrapper span,
  .md-editor-wrapper div,
  .md-editor-wrapper p,
  .md-editor-wrapper textarea {
    color: #e0e0e0 !important;
    caret-color: #e0e0e0 !important;
    -webkit-text-fill-color: #e0e0e0 !important;
  }
  /* CodeMirror specific if used */
  .md-editor-wrapper .cm-content,
  .md-editor-wrapper .cm-line,
  .md-editor-wrapper .cm-editor {
    color: #e0e0e0 !important;
    caret-color: #e0e0e0 !important;
    -webkit-text-fill-color: #e0e0e0 !important;
  }
`;

/**
 * A React wrapper around MDEditor that integrates with form collection.
 * Renders a hidden input with the editor's value for form submission.
 */
export function MarkdownEditorWrapper({
  name,
  initialValue,
  placeholder,
  rows = 10,
  onChange,
}: MarkdownEditorWrapperProps): React.ReactElement {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  // Calculate height from rows (approx 24px per row)
  const height = Math.max(rows * 24, 200);

  return (
    <div data-color-mode="dark" className="md-editor-wrapper">
      <style>{editorOverrideStyles}</style>
      {/* Hidden input for form collection */}
      <input type="hidden" name={name} value={value} />
      <MDEditor
        value={value}
        onChange={(val) => setValue(val || "")}
        preview="edit"
        height={height}
        textareaProps={{
          placeholder,
        }}
      />
    </div>
  );
}
