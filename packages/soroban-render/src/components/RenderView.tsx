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

/**
 * Default styles based on Stellar Design System
 * https://design-system.stellar.org/
 *
 * Uses Inter font (Stellar's brand font) with fallbacks.
 * Color palette uses Stellar's lilac/purple as primary accent.
 */
export const defaultStyles = `
/* CSS Custom Properties - Stellar Design System Colors */
.soroban-render-view {
  --sds-clr-gray-01: #fcfcfc;
  --sds-clr-gray-02: #f8f8f8;
  --sds-clr-gray-03: #f3f3f3;
  --sds-clr-gray-06: #e2e2e2;
  --sds-clr-gray-09: #8f8f8f;
  --sds-clr-gray-11: #6f6f6f;
  --sds-clr-gray-12: #171717;
  --sds-clr-lilac-03: #f1efff;
  --sds-clr-lilac-09: #7857e1;
  --sds-clr-lilac-10: #6b4ad1;
  --sds-clr-lilac-11: #5a3dab;
  --sds-clr-red-03: #ffebeb;
  --sds-clr-red-06: #fdbdbd;
  --sds-clr-red-09: #e5484d;
  --sds-clr-red-11: #c62a2f;

  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: var(--sds-clr-gray-12);
}

.soroban-render-view h1 {
  font-size: 1.875rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--sds-clr-gray-06);
  letter-spacing: -0.02em;
}

.soroban-render-view h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 2rem 0 1rem 0;
  letter-spacing: -0.01em;
}

.soroban-render-view h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem 0;
}

.soroban-render-view h4 {
  font-size: 1.125rem;
  font-weight: 500;
  margin: 1.25rem 0 0.5rem 0;
}

.soroban-render-view p {
  margin: 0.75rem 0;
}

.soroban-render-view strong {
  font-weight: 600;
}

.soroban-render-view ul, .soroban-render-view ol {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.soroban-render-view li {
  margin: 0.375rem 0;
}

.soroban-render-view code {
  background-color: var(--sds-clr-gray-03);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-family: 'Inconsolata', 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--sds-clr-lilac-11);
}

.soroban-render-view pre {
  background-color: var(--sds-clr-gray-03);
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid var(--sds-clr-gray-06);
}

.soroban-render-view pre code {
  background: none;
  padding: 0;
  color: inherit;
  font-size: 0.875rem;
}

.soroban-render-view blockquote {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--sds-clr-lilac-09);
  background-color: var(--sds-clr-gray-02);
  color: var(--sds-clr-gray-11);
  border-radius: 0 4px 4px 0;
}

.soroban-render-view blockquote p {
  margin: 0;
}

.soroban-render-view table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  font-size: 0.875rem;
}

.soroban-render-view th, .soroban-render-view td {
  border: 1px solid var(--sds-clr-gray-06);
  padding: 0.75rem 1rem;
  text-align: left;
}

.soroban-render-view th {
  background-color: var(--sds-clr-gray-03);
  font-weight: 600;
}

.soroban-render-view tr:hover td {
  background-color: var(--sds-clr-gray-02);
}

.soroban-render-view a {
  color: var(--sds-clr-lilac-09);
  text-decoration: none;
  transition: color 100ms ease-out;
}

.soroban-render-view a:hover {
  color: var(--sds-clr-lilac-10);
  text-decoration: underline;
}

.soroban-render-view a:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(120, 87, 225, 0.35);
  border-radius: 2px;
}

.soroban-render-view hr {
  border: none;
  border-top: 1px solid var(--sds-clr-gray-06);
  margin: 2rem 0;
}

.soroban-render-view img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

/* Form elements */
.soroban-render-view input[type="text"],
.soroban-render-view input[type="email"],
.soroban-render-view input[type="number"],
.soroban-render-view textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-family: inherit;
  font-size: 1rem;
  color: var(--sds-clr-gray-12);
  background-color: #ffffff;
  border: 1px solid var(--sds-clr-gray-06);
  border-radius: 6px;
  margin: 0.5rem 0;
  transition: border-color 100ms ease-out, box-shadow 100ms ease-out;
}

.soroban-render-view input:focus,
.soroban-render-view textarea:focus {
  outline: none;
  border-color: var(--sds-clr-lilac-09);
  box-shadow: 0 0 0 3px rgba(120, 87, 225, 0.35);
}

.soroban-render-view input::placeholder,
.soroban-render-view textarea::placeholder {
  color: var(--sds-clr-gray-09);
}

.soroban-render-view label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

/* Action buttons - but allow contract styles to override via custom classes */
.soroban-render-view a.soroban-action:not(.board-card):not(.thread-title):not(.nav-item) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  background-color: var(--sds-clr-lilac-09);
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 100ms ease-out, transform 100ms ease-out;
  margin-right: 0.5rem;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.soroban-render-view a.soroban-action:not(.board-card):not(.thread-title):not(.nav-item):hover {
  background-color: var(--sds-clr-lilac-10);
  text-decoration: none;
  transform: translateY(-1px);
}

.soroban-render-view a.soroban-action:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(120, 87, 225, 0.35);
}

.soroban-render-view a.soroban-action.secondary {
  color: var(--sds-clr-gray-12);
  background-color: var(--sds-clr-gray-03);
  border: 1px solid var(--sds-clr-gray-06);
}

.soroban-render-view a.soroban-action.secondary:hover {
  background-color: var(--sds-clr-gray-06);
}

.soroban-render-view a.soroban-action[data-action*="delete"] {
  background-color: var(--sds-clr-red-09);
}

.soroban-render-view a.soroban-action[data-action*="delete"]:hover {
  background-color: var(--sds-clr-red-11);
}

/* Error states */
.soroban-render-error {
  padding: 1rem;
  background-color: var(--sds-clr-red-03);
  border: 1px solid var(--sds-clr-red-06);
  border-radius: 6px;
  color: var(--sds-clr-red-11);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .soroban-render-view {
    --sds-clr-gray-01: #161616;
    --sds-clr-gray-02: #1c1c1c;
    --sds-clr-gray-03: #232323;
    --sds-clr-gray-06: #3e3e3e;
    --sds-clr-gray-09: #8f8f8f;
    --sds-clr-gray-11: #b4b4b4;
    --sds-clr-gray-12: #eeeeee;
    --sds-clr-lilac-03: #2a2340;
    --sds-clr-lilac-09: #9176e8;
    --sds-clr-lilac-10: #a28fec;
    --sds-clr-lilac-11: #b7ace8;
    --sds-clr-red-03: #3d1a1a;
    --sds-clr-red-06: #6b2a2a;
    --sds-clr-red-09: #f56565;
    --sds-clr-red-11: #fc8181;
  }

  .soroban-render-view input[type="text"],
  .soroban-render-view input[type="email"],
  .soroban-render-view input[type="number"],
  .soroban-render-view textarea {
    background-color: var(--sds-clr-gray-02);
  }
}
`;
