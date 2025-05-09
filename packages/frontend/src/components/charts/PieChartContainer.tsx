import React from 'react';
import { 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';

interface PieChartContainerProps {
  data: any[];
  colors?: string[];
  dataKey?: string;
  nameKey?: string;
  tooltipFormatter?: (value: any, name: string) => [string, string];
  labelFormatter?: (props: any) => string;
  outerRadius?: number;
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#6B66FF'];

/**
 * Reusable pie chart container component
 */
const PieChartContainer: React.FC<PieChartContainerProps> = ({
  data,
  colors = DEFAULT_COLORS,
  dataKey = 'value',
  nameKey = 'name',
  tooltipFormatter,
  labelFormatter = ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`,
  outerRadius = 150
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={true}
          label={labelFormatter}
          outerRadius={outerRadius}
          fill="#8884d8"
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default PieChartContainer;