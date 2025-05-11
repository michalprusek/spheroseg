import React from 'react';
import { render } from '@testing-library/react';
import { Skeleton } from '../skeleton';
import '@testing-library/jest-dom';

describe('Skeleton Component', () => {
  it('renders with default classes', () => {
    const { container } = render(<Skeleton />);
    const skeletonElement = container.firstChild as HTMLElement;

    expect(skeletonElement).toBeInTheDocument();
    expect(skeletonElement).toHaveClass('animate-pulse');
    expect(skeletonElement).toHaveClass('rounded-md');
    expect(skeletonElement).toHaveClass('bg-muted');
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    const skeletonElement = container.firstChild as HTMLElement;

    expect(skeletonElement).toHaveClass('custom-class');
    expect(skeletonElement).toHaveClass('animate-pulse');
  });

  it('passes additional props to the div element', () => {
    const { container } = render(<Skeleton data-testid="skeleton-test" aria-label="Loading" />);
    const skeletonElement = container.firstChild as HTMLElement;

    expect(skeletonElement).toHaveAttribute('data-testid', 'skeleton-test');
    expect(skeletonElement).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders with custom dimensions', () => {
    const { container } = render(<Skeleton className="h-10 w-20" />);
    const skeletonElement = container.firstChild as HTMLElement;

    expect(skeletonElement).toHaveClass('h-10');
    expect(skeletonElement).toHaveClass('w-20');
  });

  it('renders children when provided', () => {
    const { getByText } = render(
      <Skeleton>
        <span>Loading content</span>
      </Skeleton>,
    );

    expect(getByText('Loading content')).toBeInTheDocument();
  });
});
