import React from "react";

export interface RenderViewProps {
  html: string | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  style?: React.CSSProperties;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  /** CSS from contract styles() function and {{style}} tags */
  css?: string | null;
  /** Scope class name for CSS isolation */
  scopeClassName?: string | null;
}

export function RenderView({
  html,
  loading = false,
  error = null,
  className = "",
  style,
  loadingComponent,
  errorComponent,
  css,
  scopeClassName,
}: RenderViewProps): React.ReactElement {
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className={`soroban-render-loading ${className}`} style={style}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div
            style={{
              display: "inline-block",
              width: "2rem",
              height: "2rem",
              border: "3px solid #e0e0e0",
              borderTopColor: "#333",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ marginTop: "1rem", color: "#666" }}>Loading contract UI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <div className={`soroban-render-error ${className}`} style={style}>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c00",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className={`soroban-render-empty ${className}`} style={style}>
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
          <p>No content to display</p>
          <p style={{ fontSize: "0.875rem" }}>
            Enter a contract ID that implements the render convention.
          </p>
        </div>
      </div>
    );
  }

  // Build class names including scope
  const classNames = ["soroban-render-view"];
  if (scopeClassName) {
    classNames.push(scopeClassName);
  }
  if (className) {
    classNames.push(className);
  }

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div
        className={classNames.join(" ")}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

export const defaultStyles = `
.soroban-render-view {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  line-height: 1.6;
  color: #333;
}

.soroban-render-view h1 {
  font-size: 2rem;
  margin: 0 0 1rem 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

.soroban-render-view h2 {
  font-size: 1.5rem;
  margin: 1.5rem 0 0.75rem 0;
}

.soroban-render-view h3 {
  font-size: 1.25rem;
  margin: 1.25rem 0 0.5rem 0;
}

.soroban-render-view p {
  margin: 0.5rem 0;
}

.soroban-render-view ul, .soroban-render-view ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.soroban-render-view li {
  margin: 0.25rem 0;
}

.soroban-render-view code {
  background-color: #f5f5f5;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.875em;
}

.soroban-render-view pre {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.soroban-render-view pre code {
  background: none;
  padding: 0;
}

.soroban-render-view blockquote {
  margin: 0.5rem 0;
  padding-left: 1rem;
  border-left: 3px solid #ddd;
  color: #666;
}

.soroban-render-view table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

.soroban-render-view th, .soroban-render-view td {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: left;
}

.soroban-render-view th {
  background-color: #f5f5f5;
}

.soroban-render-view a {
  color: #0066cc;
  text-decoration: none;
}

.soroban-render-view a:hover {
  text-decoration: underline;
}

.soroban-render-view hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 1.5rem 0;
}

.soroban-render-view img {
  max-width: 100%;
  height: auto;
}
`;
