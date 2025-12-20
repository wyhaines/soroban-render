import React, { useState, useCallback } from "react";
import {
  JsonUIDocument,
  JsonComponent,
  HeadingComponent,
  TextComponent,
  MarkdownComponent,
  FormComponent,
  ButtonComponent,
  ListComponent,
  TaskComponent,
  NavigationComponent,
  ContainerComponent,
  FormField,
  TaskAction,
} from "../parsers/json";
import { parseMarkdown } from "../parsers/markdown";

export interface JsonRenderViewProps {
  document: JsonUIDocument;
  className?: string;
  style?: React.CSSProperties;
  onPathChange?: (path: string) => void;
  onTransaction?: (method: string, args: Record<string, unknown>) => void;
  onFormSubmit?: (method: string, formData: Record<string, unknown>) => void;
  onInclude?: (contract: string, path?: string) => React.ReactNode;
}

export function JsonRenderView({
  document,
  className = "",
  style,
  onPathChange,
  onTransaction,
  onFormSubmit,
  onInclude,
}: JsonRenderViewProps): React.ReactElement {
  return (
    <div className={`soroban-render-json ${className}`} style={style}>
      {document.title && <title>{document.title}</title>}
      {document.components.map((component, index) => (
        <ComponentRenderer
          key={index}
          component={component}
          onPathChange={onPathChange}
          onTransaction={onTransaction}
          onFormSubmit={onFormSubmit}
          onInclude={onInclude}
        />
      ))}
    </div>
  );
}

interface ComponentRendererProps {
  component: JsonComponent;
  onPathChange?: (path: string) => void;
  onTransaction?: (method: string, args: Record<string, unknown>) => void;
  onFormSubmit?: (method: string, formData: Record<string, unknown>) => void;
  onInclude?: (contract: string, path?: string) => React.ReactNode;
}

function ComponentRenderer({
  component,
  onPathChange,
  onTransaction,
  onFormSubmit,
  onInclude,
}: ComponentRendererProps): React.ReactElement | null {
  switch (component.type) {
    case "heading":
      return <HeadingRenderer component={component} />;
    case "text":
      return <TextRenderer component={component} />;
    case "markdown":
      return <MarkdownRenderer component={component} />;
    case "divider":
      return <DividerRenderer />;
    case "form":
      return <FormRenderer component={component} onSubmit={onFormSubmit} />;
    case "button":
      return (
        <ButtonRenderer
          component={component}
          onPathChange={onPathChange}
          onTransaction={onTransaction}
        />
      );
    case "list":
      return (
        <ListRenderer
          component={component}
          onPathChange={onPathChange}
          onTransaction={onTransaction}
          onFormSubmit={onFormSubmit}
          onInclude={onInclude}
        />
      );
    case "task":
      return (
        <TaskRenderer
          component={component}
          onPathChange={onPathChange}
          onTransaction={onTransaction}
        />
      );
    case "navigation":
      return <NavigationRenderer component={component} onPathChange={onPathChange} />;
    case "container":
      return (
        <ContainerRenderer
          component={component}
          onPathChange={onPathChange}
          onTransaction={onTransaction}
          onFormSubmit={onFormSubmit}
          onInclude={onInclude}
        />
      );
    case "include":
      if (onInclude) {
        return <>{onInclude(component.contract, component.path)}</>;
      }
      return (
        <div className="soroban-render-include-placeholder">
          [Include: {component.contract}]
        </div>
      );
    default:
      return null;
  }
}

function HeadingRenderer({ component }: { component: HeadingComponent }): React.ReactElement {
  const Tag = `h${component.level}` as keyof JSX.IntrinsicElements;
  return <Tag>{component.text}</Tag>;
}

function TextRenderer({ component }: { component: TextComponent }): React.ReactElement {
  return <p>{component.content}</p>;
}

function MarkdownRenderer({ component }: { component: MarkdownComponent }): React.ReactElement {
  const [html, setHtml] = useState<string>("");

  React.useEffect(() => {
    parseMarkdown(component.content).then(setHtml);
  }, [component.content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function DividerRenderer(): React.ReactElement {
  return <hr />;
}

interface FormRendererProps {
  component: FormComponent;
  onSubmit?: (method: string, formData: Record<string, unknown>) => void;
}

function FormRenderer({ component, onSubmit }: FormRendererProps): React.ReactElement {
  const getInitialFormData = useCallback(() => {
    const initial: Record<string, unknown> = {};
    component.fields.forEach((field) => {
      if (field.type === "checkbox") {
        initial[field.name] = field.checked || false;
      } else {
        initial[field.name] = field.value || "";
      }
    });
    return initial;
  }, [component.fields]);

  const [formData, setFormData] = useState<Record<string, unknown>>(getInitialFormData);

  const handleChange = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (onSubmit) {
        onSubmit(component.action, formData);
        // Clear form after submission
        setFormData(getInitialFormData());
      }
    },
    [component.action, formData, onSubmit, getInitialFormData]
  );

  return (
    <form className="soroban-render-form" onSubmit={handleSubmit}>
      {component.fields.map((field, index) => (
        <FieldRenderer
          key={index}
          field={field}
          value={formData[field.name]}
          onChange={(value) => handleChange(field.name, value)}
        />
      ))}
      <button type="submit" className="soroban-render-button soroban-render-button-primary">
        {component.submitLabel || "Submit"}
      </button>
    </form>
  );
}

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ field, value, onChange }: FieldRendererProps): React.ReactElement {
  const id = `field-${field.name}`;

  if (field.type === "textarea") {
    return (
      <div className="soroban-render-field">
        {field.label && <label htmlFor={id}>{field.label}</label>}
        <textarea
          id={id}
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="soroban-render-field">
        {field.label && <label htmlFor={id}>{field.label}</label>}
        <select
          id={id}
          name={field.name}
          required={field.required}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {field.options?.map((option, index) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="soroban-render-field soroban-render-field-checkbox">
        <input
          id={id}
          type="checkbox"
          name={field.name}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id}>{field.label || field.name}</label>
      </div>
    );
  }

  return (
    <div className="soroban-render-field">
      {field.label && <label htmlFor={id}>{field.label}</label>}
      <input
        id={id}
        type={field.type}
        name={field.name}
        placeholder={field.placeholder}
        required={field.required}
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ButtonRendererProps {
  component: ButtonComponent;
  onPathChange?: (path: string) => void;
  onTransaction?: (method: string, args: Record<string, unknown>) => void;
}

function ButtonRenderer({
  component,
  onPathChange,
  onTransaction,
}: ButtonRendererProps): React.ReactElement {
  const handleClick = useCallback(() => {
    if (component.action === "render" && component.path && onPathChange) {
      onPathChange(component.path);
    } else if (component.action === "tx" && component.method && onTransaction) {
      onTransaction(component.method, component.args || {});
    }
  }, [component, onPathChange, onTransaction]);

  const variantClass = component.variant
    ? `soroban-render-button-${component.variant}`
    : "soroban-render-button-secondary";

  return (
    <button
      type="button"
      className={`soroban-render-button ${variantClass}`}
      onClick={handleClick}
    >
      {component.label}
    </button>
  );
}

interface ListRendererProps {
  component: ListComponent;
  onPathChange?: (path: string) => void;
  onTransaction?: (method: string, args: Record<string, unknown>) => void;
  onFormSubmit?: (method: string, formData: Record<string, unknown>) => void;
  onInclude?: (contract: string, path?: string) => React.ReactNode;
}

function ListRenderer({
  component,
  onPathChange,
  onTransaction,
  onFormSubmit,
  onInclude,
}: ListRendererProps): React.ReactElement {
  const Tag = component.ordered ? "ol" : "ul";

  return (
    <Tag className="soroban-render-list">
      {component.items.map((item, index) => {
        if ("type" in item && item.type === "item") {
          // Simple list item
          if (typeof item.content === "string") {
            return <li key={index}>{item.content}</li>;
          }
          return (
            <li key={index}>
              <ComponentRenderer
                component={item.content as JsonComponent}
                onPathChange={onPathChange}
                onTransaction={onTransaction}
                onFormSubmit={onFormSubmit}
                onInclude={onInclude}
              />
            </li>
          );
        }

        // Direct component in list
        return (
          <li key={index}>
            <ComponentRenderer
              component={item as JsonComponent}
              onPathChange={onPathChange}
              onTransaction={onTransaction}
              onFormSubmit={onFormSubmit}
              onInclude={onInclude}
            />
          </li>
        );
      })}
    </Tag>
  );
}

interface TaskRendererProps {
  component: TaskComponent;
  onPathChange?: (path: string) => void;
  onTransaction?: (method: string, args: Record<string, unknown>) => void;
}

function TaskRenderer({
  component,
  onPathChange,
  onTransaction,
}: TaskRendererProps): React.ReactElement {
  const handleAction = useCallback(
    (action: TaskAction) => {
      if (action.type === "render" && action.path && onPathChange) {
        onPathChange(action.path);
      } else if (action.type === "tx" && action.method && onTransaction) {
        onTransaction(action.method, action.args || {});
      }
    },
    [onPathChange, onTransaction]
  );

  return (
    <div className={`soroban-render-task ${component.completed ? "completed" : ""}`}>
      <span className="soroban-render-task-checkbox">
        {component.completed ? "☑" : "☐"}
      </span>
      <span
        className={`soroban-render-task-text ${component.completed ? "line-through" : ""}`}
      >
        {component.text}
      </span>
      {component.actions && component.actions.length > 0 && (
        <span className="soroban-render-task-actions">
          {component.actions.map((action, index) => (
            <button
              key={index}
              type="button"
              className="soroban-render-task-action"
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

interface NavigationRendererProps {
  component: NavigationComponent;
  onPathChange?: (path: string) => void;
}

function NavigationRenderer({
  component,
  onPathChange,
}: NavigationRendererProps): React.ReactElement {
  return (
    <nav className="soroban-render-navigation">
      {component.items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="soroban-render-nav-separator">|</span>}
          <a
            href="#"
            className={`soroban-render-nav-link ${item.active ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              if (onPathChange) {
                onPathChange(item.path);
              }
            }}
          >
            {item.label}
          </a>
        </React.Fragment>
      ))}
    </nav>
  );
}

interface ContainerRendererProps {
  component: ContainerComponent;
  onPathChange?: (path: string) => void;
  onTransaction?: (method: string, args: Record<string, unknown>) => void;
  onFormSubmit?: (method: string, formData: Record<string, unknown>) => void;
  onInclude?: (contract: string, path?: string) => React.ReactNode;
}

function ContainerRenderer({
  component,
  onPathChange,
  onTransaction,
  onFormSubmit,
  onInclude,
}: ContainerRendererProps): React.ReactElement {
  return (
    <div className={`soroban-render-container ${component.className || ""}`}>
      {component.components.map((child, index) => (
        <ComponentRenderer
          key={index}
          component={child}
          onPathChange={onPathChange}
          onTransaction={onTransaction}
          onFormSubmit={onFormSubmit}
          onInclude={onInclude}
        />
      ))}
    </div>
  );
}

export const jsonStyles = `
.soroban-render-json {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  line-height: 1.6;
  color: #333;
}

.soroban-render-form {
  margin: 1rem 0;
}

.soroban-render-field {
  margin-bottom: 0.75rem;
}

.soroban-render-field label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.soroban-render-field input,
.soroban-render-field textarea,
.soroban-render-field select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.soroban-render-field input:focus,
.soroban-render-field textarea:focus,
.soroban-render-field select:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
}

.soroban-render-field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.soroban-render-field-checkbox input {
  width: auto;
}

.soroban-render-field-checkbox label {
  display: inline;
  margin-bottom: 0;
  font-weight: normal;
}

.soroban-render-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.soroban-render-button-primary {
  background-color: #0066cc;
  color: white;
}

.soroban-render-button-primary:hover {
  background-color: #0052a3;
}

.soroban-render-button-secondary {
  background-color: #e0e0e0;
  color: #333;
}

.soroban-render-button-secondary:hover {
  background-color: #d0d0d0;
}

.soroban-render-button-danger {
  background-color: #dc3545;
  color: white;
}

.soroban-render-button-danger:hover {
  background-color: #c82333;
}

.soroban-render-list {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.soroban-render-task {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.soroban-render-task.completed .soroban-render-task-text {
  text-decoration: line-through;
  color: #666;
}

.soroban-render-task-checkbox {
  font-size: 1.1rem;
}

.soroban-render-task-text {
  flex: 1;
}

.soroban-render-task-actions {
  display: flex;
  gap: 0.25rem;
}

.soroban-render-task-action {
  padding: 0.125rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 0.875rem;
}

.soroban-render-task-action:hover {
  background: #e0e0e0;
}

.soroban-render-navigation {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 0.5rem 0;
}

.soroban-render-nav-separator {
  color: #999;
}

.soroban-render-nav-link {
  color: #0066cc;
  text-decoration: none;
}

.soroban-render-nav-link:hover {
  text-decoration: underline;
}

.soroban-render-nav-link.active {
  font-weight: bold;
}

.soroban-render-container {
  margin: 0.5rem 0;
}

.soroban-render-include-placeholder {
  padding: 0.5rem;
  background: #f5f5f5;
  border: 1px dashed #ccc;
  border-radius: 4px;
  color: #666;
  font-style: italic;
}
`;
