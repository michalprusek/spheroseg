/**
 * Optimized Recharts imports
 * 
 * Instead of importing all of recharts, only import the components we use.
 * This reduces bundle size significantly through tree-shaking.
 */

// Charts
export { 
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  RadarChart,
  ScatterChart,
  ComposedChart,
} from 'recharts';

// Chart Components
export {
  Line,
  Bar,
  Area,
  Pie,
  Radar,
  Scatter,
  Cell,
  LabelList,
} from 'recharts';

// Container
export { ResponsiveContainer } from 'recharts';

// Axes
export {
  XAxis,
  YAxis,
  ZAxis,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

// Grid
export {
  CartesianGrid,
  PolarGrid,
} from 'recharts';

// Tooltip & Legend
export {
  Tooltip,
  Legend,
} from 'recharts';

// Reference Components
export {
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
} from 'recharts';

// Shapes
export {
  Rectangle,
  Sector,
  Curve,
  Dot,
  Polygon,
  Cross,
} from 'recharts';

// Types (if needed)
export type {
  TooltipProps,
  LegendProps,
  ResponsiveContainerProps,
  LineProps,
  BarProps,
  AreaProps,
  PieProps,
  CellProps,
  XAxisProps,
  YAxisProps,
  CartesianGridProps,
} from 'recharts';

// Re-export commonly used together
export const ChartComponents = {
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  RadarChart,
  Line,
  Bar,
  Area,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} as const;