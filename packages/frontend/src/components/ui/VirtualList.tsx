import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  height: number | string;
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * High-performance virtual scrolling list component
 * Renders only visible items to handle thousands of items efficiently
 */
export const VirtualList = memo(
  <T extends any>({
    items,
    height,
    itemHeight,
    renderItem,
    overscan = 3,
    className,
    onScroll,
    getItemKey = (_, index) => index,
  }: VirtualListProps<T>) => {
    const scrollElementRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout>();

    // Calculate item heights
    const getItemOffset = useCallback(
      (index: number): number => {
        if (typeof itemHeight === 'function') {
          let offset = 0;
          for (let i = 0; i < index; i++) {
            offset += itemHeight(i);
          }
          return offset;
        }
        return index * itemHeight;
      },
      [itemHeight],
    );

    const getItemHeight = useCallback(
      (index: number): number => {
        return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
      },
      [itemHeight],
    );

    // Calculate total height
    const totalHeight =
      typeof itemHeight === 'number'
        ? items.length * itemHeight
        : items.reduce((acc, _, index) => acc + getItemHeight(index), 0);

    // Calculate visible range
    const calculateVisibleRange = useCallback(() => {
      if (!scrollElementRef.current) return { start: 0, end: 0 };

      const containerHeight = scrollElementRef.current.clientHeight;
      const accumulatedHeight = 0;
      let start = 0;
      let end = items.length;

      // Find start index
      for (let i = 0; i < items.length; i++) {
        const itemOffset = getItemOffset(i);
        if (itemOffset + getItemHeight(i) > scrollTop) {
          start = Math.max(0, i - overscan);
          break;
        }
      }

      // Find end index
      for (let i = start; i < items.length; i++) {
        if (getItemOffset(i) > scrollTop + containerHeight) {
          end = Math.min(items.length, i + overscan);
          break;
        }
      }

      return { start, end };
    }, [items.length, scrollTop, overscan, getItemOffset, getItemHeight]);

    const { start, end } = calculateVisibleRange();

    // Handle scroll
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        const newScrollTop = e.currentTarget.scrollTop;
        setScrollTop(newScrollTop);
        setIsScrolling(true);

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Set scrolling to false after scroll ends
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 150);

        onScroll?.(newScrollTop);
      },
      [onScroll],
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, []);

    // Render visible items
    const visibleItems = [];
    for (let i = start; i < end; i++) {
      const item = items[i];
      const itemOffset = getItemOffset(i);
      const itemKey = getItemKey(item, i);

      visibleItems.push(
        <div
          key={itemKey}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: getItemHeight(i),
            transform: `translateY(${itemOffset}px)`,
            willChange: isScrolling ? 'transform' : 'auto',
          }}
        >
          {renderItem(item, i)}
        </div>,
      );
    }

    return (
      <div
        ref={scrollElementRef}
        className={cn('relative overflow-auto', className)}
        style={{ height }}
        onScroll={handleScroll}
      >
        {/* Total height container to maintain scrollbar */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Render only visible items */}
          {visibleItems}
        </div>
      </div>
    );
  },
) as <T>(props: VirtualListProps<T>) => JSX.Element;

VirtualList.displayName = 'VirtualList';

/**
 * Hook for virtual scrolling with dynamic item heights
 */
export function useVirtualList<T>(items: T[], estimatedItemHeight: number = 50) {
  const itemHeights = useRef<Map<number, number>>(new Map());
  const [forceUpdate, setForceUpdate] = useState(0);

  const setItemHeight = useCallback((index: number, height: number) => {
    const currentHeight = itemHeights.current.get(index);
    if (currentHeight !== height) {
      itemHeights.current.set(index, height);
      setForceUpdate((prev) => prev + 1);
    }
  }, []);

  const getItemHeight = useCallback(
    (index: number) => {
      return itemHeights.current.get(index) || estimatedItemHeight;
    },
    [estimatedItemHeight],
  );

  const measureElement = useCallback(
    (element: HTMLElement | null, index: number) => {
      if (element) {
        const resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            setItemHeight(index, entry.contentRect.height);
          }
        });
        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
      }
    },
    [setItemHeight],
  );

  return {
    getItemHeight,
    measureElement,
    forceUpdate,
  };
}

export default VirtualList;
