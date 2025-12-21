export {
  createClient,
  callRender,
  detectRenderSupport,
  Networks,
  type SorobanClient,
  type RenderOptions,
  type NetworkName,
} from "./utils/client";

export {
  submitTransaction,
  parseTransactionLink,
  parseFormLink,
  parseRenderLink,
  type TransactionParams,
  type TransactionResult,
} from "./utils/transaction";

export { parseMarkdown, detectFormat } from "./parsers/markdown";

export {
  parseJsonUI,
  isJsonFormat,
  type JsonUIDocument,
  type JsonComponent,
  type HeadingComponent,
  type TextComponent,
  type MarkdownComponent,
  type DividerComponent,
  type FormComponent,
  type ButtonComponent,
  type ListComponent,
  type TaskComponent,
  type NavigationComponent,
  type ContainerComponent,
  type IncludeComponent,
  type ChartComponent,
  type ChartDataPoint,
  type PieChartComponent,
  type GaugeChartComponent,
  type BarChartComponent,
  type FormField,
  type ParseJsonResult,
} from "./parsers/json";

export { PieChart } from "./components/charts/PieChart";
export { GaugeChart } from "./components/charts/GaugeChart";
export { BarChart } from "./components/charts/BarChart";

export {
  useRender,
  useRenderSupport,
  type UseRenderResult,
  type UseRenderOptions,
} from "./hooks/useRender";

export {
  useWallet,
  type WalletState,
  type UseWalletResult,
} from "./hooks/useWallet";

export {
  RenderView,
  defaultStyles,
  type RenderViewProps,
} from "./components/RenderView";

export {
  InteractiveRenderView,
  type InteractiveRenderViewProps,
} from "./components/InteractiveRenderView";

export {
  JsonRenderView,
  jsonStyles,
  type JsonRenderViewProps,
} from "./components/JsonRenderView";

export {
  InteractiveJsonRenderView,
  type InteractiveJsonRenderViewProps,
} from "./components/InteractiveJsonRenderView";

export {
  parseLink,
  collectFormInputs,
  buildPathWithParams,
  type LinkProtocol,
  type ParsedLink,
} from "./utils/linkParser";

export {
  parseIncludes,
  hasIncludes,
  createIncludeKey,
  type IncludeTag,
  type ParsedIncludes,
} from "./parsers/include";

export {
  resolveIncludes,
  createIncludeResolver,
  type ResolveOptions,
  type ResolveResult,
  type CacheEntry,
} from "./utils/includeResolver";

export {
  parseStyles,
  hasStyleTags,
  hasCssBlocks,
  createStyleKey,
  removeCssBlocks,
  extractInlineCss,
  type StyleTag,
  type CssBlock,
  type ParsedStyles,
} from "./parsers/style";

export {
  sanitizeCss,
  scopeCss,
  validateCss,
  combineCss,
  createScopeClassName,
  type SanitizeOptions,
} from "./utils/cssSanitizer";

export {
  resolveStyles,
  createStyleResolver,
  type StyleResolveOptions,
  type StyleResolveResult,
  type StyleCacheEntry,
} from "./utils/styleResolver";

export {
  parseProgressiveTags,
  hasProgressiveTags,
  createTagId,
  createChunkKey,
  type ContinuationTag,
  type ChunkTag,
  type ProgressiveTag,
  type ParsedProgressiveContent,
} from "./parsers/continuation";

export {
  ProgressiveLoader,
  createProgressiveLoader,
  type ProgressiveLoaderOptions,
  type ChunkResult,
  type ChunkMeta,
} from "./utils/progressiveLoader";

export {
  useProgressiveRender,
  type UseProgressiveRenderOptions,
  type UseProgressiveRenderResult,
} from "./hooks/useProgressiveRender";
