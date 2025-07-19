# Memory Leak Prevention Guide

## Common Memory Leak Patterns in React

### 1. Event Listeners Not Removed
```typescript
// ❌ BAD - Memory leak
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // Missing cleanup!
}, []);

// ✅ GOOD - Properly cleaned up
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);

// ✅ BETTER - Using our utility hook
import { useEventListener } from '@/utils/memoryLeakFixes';
useEventListener('resize', handleResize);
```

### 2. Timers Not Cleared
```typescript
// ❌ BAD - Memory leak
useEffect(() => {
  const timer = setTimeout(() => {
    doSomething();
  }, 1000);
  // Missing cleanup!
}, []);

// ✅ GOOD - Properly cleaned up
useEffect(() => {
  const timer = setTimeout(() => {
    doSomething();
  }, 1000);
  return () => clearTimeout(timer);
}, []);

// ✅ BETTER - Using our utility hook
import { useTimer } from '@/utils/memoryLeakFixes';
const timer = useTimer();
timer.setTimeout(() => doSomething(), 1000);
```

### 3. SetState After Unmount
```typescript
// ❌ BAD - Memory leak
useEffect(() => {
  fetchData().then(data => {
    setData(data); // Component might be unmounted!
  });
}, []);

// ✅ GOOD - Check if mounted
import { useIsMounted } from '@/utils/memoryLeakFixes';
const isMounted = useIsMounted();

useEffect(() => {
  fetchData().then(data => {
    if (isMounted.current) {
      setData(data);
    }
  });
}, []);

// ✅ BETTER - Using abort controller
import { useAbortController } from '@/utils/memoryLeakFixes';
const { getSignal } = useAbortController();

useEffect(() => {
  fetchData({ signal: getSignal() })
    .then(data => setData(data))
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    });
}, []);
```

### 4. Object URLs Not Revoked
```typescript
// ❌ BAD - Memory leak
const [imageUrl, setImageUrl] = useState('');

useEffect(() => {
  const url = URL.createObjectURL(blob);
  setImageUrl(url);
  // Missing cleanup!
}, [blob]);

// ✅ GOOD - Properly cleaned up
useEffect(() => {
  const url = URL.createObjectURL(blob);
  setImageUrl(url);
  
  return () => {
    URL.revokeObjectURL(url);
  };
}, [blob]);

// ✅ BETTER - Using our utility hook
import { useBlobUrl } from '@/utils/memoryLeakFixes';
const { createObjectURL, revokeObjectURL } = useBlobUrl();

useEffect(() => {
  const url = createObjectURL(blob);
  setImageUrl(url);
}, [blob]);
```

### 5. WebSocket Connections Not Closed
```typescript
// ❌ BAD - Memory leak
useEffect(() => {
  const socket = io();
  socket.on('message', handleMessage);
  // Missing cleanup!
}, []);

// ✅ GOOD - Properly cleaned up
useEffect(() => {
  const socket = io();
  socket.on('message', handleMessage);
  
  return () => {
    socket.off('message', handleMessage);
    socket.disconnect();
  };
}, []);

// ✅ BETTER - Using Socket.IO hooks
import { useSocket } from '@/hooks/useSocketConnection';
const { socket } = useSocket();

useEffect(() => {
  if (socket) {
    socket.on('message', handleMessage);
    return () => {
      socket.off('message', handleMessage);
    };
  }
}, [socket]);
```

### 6. Observers Not Disconnected
```typescript
// ❌ BAD - Memory leak
useEffect(() => {
  const observer = new IntersectionObserver(handleIntersect);
  observer.observe(ref.current);
  // Missing cleanup!
}, []);

// ✅ GOOD - Properly cleaned up
useEffect(() => {
  if (!ref.current) return;
  
  const observer = new IntersectionObserver(handleIntersect);
  observer.observe(ref.current);
  
  return () => {
    observer.disconnect();
  };
}, []);

// ✅ BETTER - Using our utility hook
import { useIntersectionObserver } from '@/utils/memoryLeakFixes';
useIntersectionObserver(ref, handleIntersect);
```

## Memory Leak Prevention Utilities

We've created a comprehensive set of utilities in `/utils/memoryLeakFixes.ts`:

1. **useIsMounted**: Track if component is mounted
2. **useSafeAsync**: Safe async operations
3. **useAbortController**: Manage abort controllers
4. **useTimer**: Manage timers safely
5. **useEventListener**: Manage event listeners
6. **useBlobUrl**: Manage blob URLs
7. **useResizeObserver**: Manage ResizeObserver
8. **useIntersectionObserver**: Manage IntersectionObserver
9. **useWebSocket**: Manage WebSocket connections
10. **useSubscriptionManager**: Manage multiple subscriptions

## Best Practices

1. **Always clean up in useEffect**
   - Return a cleanup function
   - Clean up all resources created in the effect

2. **Use refs for mutable values**
   - Store values that shouldn't trigger re-renders
   - Access current values in callbacks

3. **Cancel async operations**
   - Use AbortController for fetch requests
   - Check if component is mounted before setState

4. **Manage subscriptions**
   - Unsubscribe from all event emitters
   - Close all connections

5. **Be careful with closures**
   - Update dependencies array correctly
   - Use useCallback for stable references

## Memory Leak Detection

1. **Browser DevTools**
   - Memory Profiler
   - Heap Snapshots
   - Timeline Recording

2. **React DevTools**
   - Profiler tab
   - Component tree inspection

3. **Console Warnings**
   - "Can't perform a React state update on an unmounted component"
   - Custom logging for resource tracking

## Testing for Memory Leaks

```typescript
// Example test for memory leaks
import { render, cleanup } from '@testing-library/react';
import { act } from 'react-dom/test-utils';

test('should not leak memory on unmount', async () => {
  const { unmount } = render(<MyComponent />);
  
  // Track initial resources
  const initialListeners = window.addEventListener.mock.calls.length;
  
  // Unmount component
  unmount();
  
  // Wait for cleanup
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  
  // Verify cleanup
  const finalListeners = window.removeEventListener.mock.calls.length;
  expect(finalListeners).toBe(initialListeners);
});
```