import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '@heroicons/react/24/outline';
import { chartService } from '@/services/chartService';
import { cn } from '@/utils/cn';

interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  format?: 'number' | 'currency' | 'percentage';
  currency?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

/**
 * StatCard - Display a single statistic with optional change indicator
 */
export function StatCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  format = 'number',
  currency = 'USD',
  icon: Icon,
  color = 'blue',
  size = 'md',
  className,
  onClick,
}: StatCardProps) {
  const formatValue = () => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return chartService.formatCurrency(value, currency);
      case 'percentage':
        return chartService.formatPercentage(value);
      case 'number':
      default:
        return chartService.formatNumber(value);
    }
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
  };

  const titleSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const valueSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn('font-medium text-gray-600 dark:text-gray-400', titleSizes[size])}>
            {title}
          </p>
          <p className={cn('font-bold mt-1', valueSizes[size])}>
            {formatValue()}
          </p>
          
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive && <TrendingUpIcon className="h-4 w-4 text-green-500" />}
              {isNegative && <TrendingDownIcon className="h-4 w-4 text-red-500" />}
              <span
                className={cn(
                  'text-sm font-medium',
                  isPositive && 'text-green-600 dark:text-green-400',
                  isNegative && 'text-red-600 dark:text-red-400',
                  !isPositive && !isNegative && 'text-gray-600 dark:text-gray-400'
                )}
              >
                {isPositive && '+'}
                {chartService.formatPercentage(change)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {changeLabel}
              </span>
            </div>
          )}
        </div>
        
        {Icon && (
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className={cn(
              size === 'sm' && 'h-4 w-4',
              size === 'md' && 'h-5 w-5',
              size === 'lg' && 'h-6 w-6'
            )} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatGridProps {
  stats: Array<Omit<StatCardProps, 'className'>>;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * StatGrid - Display multiple stat cards in a grid layout
 */
export function StatGrid({
  stats,
  columns = 4,
  gap = 'md',
  className,
}: StatGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return (
    <div
      className={cn(
        'grid',
        columnClasses[columns],
        gapClasses[gap],
        className
      )}
    >
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}