/**
 * Test debugging utilities for analyzing test failures and performance issues
 */

import { vi } from 'vitest';
import { screen, prettyDOM } from '@testing-library/react';

// Test debugging utilities
export class TestDebugger {
  private static debugMode = false;
  private static logs: DebugLog[] = [];
  private static snapshots: Map<string, string> = new Map();

  static enable(): void {
    this.debugMode = true;
    console.log('🐛 Test debugging enabled');
  }

  static disable(): void {
    this.debugMode = false;
    console.log('✅ Test debugging disabled');
  }

  static isEnabled(): boolean {
    return this.debugMode;
  }

  static log(message: string, data?: any, level: 'info' | 'warn' | 'error' = 'info'): void {
    const log: DebugLog = {
      timestamp: Date.now(),
      message,
      data,
      level,
      stackTrace: new Error().stack,
    };

    this.logs.push(log);

    if (this.debugMode) {
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
      console.log(`${prefix} [DEBUG] ${message}`, data ? data : '');
    }
  }

  static snapshot(name: string, element?: HTMLElement): void {
    const targetElement = element || document.body;
    const snapshot = prettyDOM(targetElement, undefined, { highlight: false });
    this.snapshots.set(name, snapshot || '');
    this.log(`Snapshot taken: ${name}`);
  }

  static getSnapshot(name: string): string | undefined {
    return this.snapshots.get(name);
  }

  static compareSnapshots(snapshot1: string, snapshot2: string): SnapshotComparison {
    const lines1 = snapshot1.split('\n');
    const lines2 = snapshot2.split('\n');
    const differences: SnapshotDifference[] = [];

    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (line1 !== line2) {
        differences.push({
          line: i + 1,
          before: line1,
          after: line2,
          type: !line1 ? 'added' : !line2 ? 'removed' : 'modified',
        });
      }
    }

    return {
      identical: differences.length === 0,
      differences,
      similarity: 1 - (differences.length / maxLines),
    };
  }

  static dumpState(): DebugState {
    return {
      logs: [...this.logs],
      snapshots: new Map(this.snapshots),
      domState: prettyDOM(document.body, undefined, { highlight: false }) || '',
      timestamp: Date.now(),
    };
  }

  static clear(): void {
    this.logs = [];
    this.snapshots.clear();
  }

  static getLogs(): DebugLog[] {
    return [...this.logs];
  }

  static getErrorLogs(): DebugLog[] {
    return this.logs.filter(log => log.level === 'error');
  }

  static generateDebugReport(): string {
    const errorLogs = this.getErrorLogs();
    const allLogs = this.getLogs();

    return `
# Test Debug Report
Generated: ${new Date().toISOString()}

## Summary
- Total logs: ${allLogs.length}
- Error logs: ${errorLogs.length}
- Snapshots: ${this.snapshots.size}

## Error Logs
${errorLogs.map(log => `
### ${new Date(log.timestamp).toISOString()}
**Level:** ${log.level}
**Message:** ${log.message}
**Data:** ${JSON.stringify(log.data, null, 2)}
**Stack:**
\`\`\`
${log.stackTrace}
\`\`\`
`).join('\n')}

## All Logs
${allLogs.map(log => `
- [${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()}: ${log.message}
`).join('\n')}

## Snapshots
${Array.from(this.snapshots.entries()).map(([name, snapshot]) => `
### ${name}
\`\`\`html
${snapshot}
\`\`\`
`).join('\n')}
    `;
  }
}

// Mock debugging utilities
export class MockDebugger {
  private static mockCalls: Map<string, MockCall[]> = new Map();

  static trackMock(mockName: string, mock: any): any {
    if (!this.mockCalls.has(mockName)) {
      this.mockCalls.set(mockName, []);
    }

    const originalImplementation = mock.getMockImplementation?.() || mock;

    return vi.fn((...args: any[]) => {
      const call: MockCall = {
        timestamp: Date.now(),
        args,
        stackTrace: new Error().stack,
      };

      this.mockCalls.get(mockName)!.push(call);
      TestDebugger.log(`Mock called: ${mockName}`, { args });

      if (typeof originalImplementation === 'function') {
        return originalImplementation(...args);
      }
      return originalImplementation;
    });
  }

  static getMockCalls(mockName: string): MockCall[] {
    return this.mockCalls.get(mockName) || [];
  }

  static getLastMockCall(mockName: string): MockCall | undefined {
    const calls = this.getMockCalls(mockName);
    return calls[calls.length - 1];
  }

  static clearMockCalls(mockName?: string): void {
    if (mockName) {
      this.mockCalls.delete(mockName);
    } else {
      this.mockCalls.clear();
    }
  }

  static getAllMockCalls(): Record<string, MockCall[]> {
    const result: Record<string, MockCall[]> = {};
    this.mockCalls.forEach((calls, name) => {
      result[name] = calls;
    });
    return result;
  }

  static generateMockReport(): string {
    const allCalls = this.getAllMockCalls();

    return `
# Mock Debug Report
Generated: ${new Date().toISOString()}

${Object.entries(allCalls).map(([mockName, calls]) => `
## ${mockName}
- Total calls: ${calls.length}

### Calls:
${calls.map((call, index) => `
${index + 1}. [${new Date(call.timestamp).toISOString()}]
   Args: ${JSON.stringify(call.args, null, 2)}
`).join('\n')}
`).join('\n')}
    `;
  }
}

// Element debugging utilities
export class ElementDebugger {
  static analyzeElement(element: HTMLElement): ElementAnalysis {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      className: element.className,
      attributes: this.getElementAttributes(element),
      computedStyles: this.getRelevantStyles(computedStyle),
      boundingRect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      },
      isVisible: this.isElementVisible(element),
      isInteractable: this.isElementInteractable(element),
      children: element.children.length,
      textContent: element.textContent?.trim() || '',
      innerHTML: element.innerHTML,
    };
  }

  static findElementsByText(text: string, exact = false): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const element = node as HTMLElement;
      const elementText = element.textContent?.trim() || '';
      
      const matches = exact 
        ? elementText === text 
        : elementText.includes(text);

      if (matches) {
        elements.push(element);
      }
    }

    return elements;
  }

  static findElementsByTestId(testId: string): HTMLElement[] {
    return Array.from(document.querySelectorAll(`[data-testid="${testId}"]`));
  }

  static findElementsByRole(role: string): HTMLElement[] {
    return Array.from(document.querySelectorAll(`[role="${role}"]`));
  }

  static debugElementQuery(selector: string): ElementQueryDebug {
    const elements = Array.from(document.querySelectorAll(selector));
    const suggestions: string[] = [];

    if (elements.length === 0) {
      // Provide suggestions for similar selectors
      const similarSelectors = this.generateSimilarSelectors(selector);
      suggestions.push(...similarSelectors);
    }

    return {
      selector,
      found: elements.length,
      elements: elements.map(el => this.analyzeElement(el as HTMLElement)),
      suggestions,
    };
  }

  private static getElementAttributes(element: HTMLElement): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private static getRelevantStyles(computedStyle: CSSStyleDeclaration): Record<string, string> {
    const relevantProps = [
      'display', 'visibility', 'opacity', 'position', 'zIndex',
      'width', 'height', 'margin', 'padding', 'border',
      'backgroundColor', 'color', 'fontSize', 'fontFamily',
      'textAlign', 'overflow', 'cursor', 'pointerEvents'
    ];

    const styles: Record<string, string> = {};
    relevantProps.forEach(prop => {
      styles[prop] = computedStyle.getPropertyValue(prop);
    });

    return styles;
  }

  private static isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  private static isElementInteractable(element: HTMLElement): boolean {
    if (!this.isElementVisible(element)) return false;

    const style = window.getComputedStyle(element);
    const isDisabled = element.hasAttribute('disabled');
    const hasPointerEvents = style.pointerEvents !== 'none';

    return !isDisabled && hasPointerEvents;
  }

  private static generateSimilarSelectors(selector: string): string[] {
    const suggestions: string[] = [];
    
    // Extract parts of the selector
    const parts = selector.split(/[\s>+~]/);
    const lastPart = parts[parts.length - 1];

    if (lastPart.startsWith('#')) {
      // ID selector - suggest data-testid
      const id = lastPart.substring(1);
      suggestions.push(`[data-testid="${id}"]`);
      suggestions.push(`[data-testid*="${id}"]`);
    } else if (lastPart.startsWith('.')) {
      // Class selector - suggest similar classes
      const className = lastPart.substring(1);
      const existingClasses = Array.from(document.querySelectorAll(`[class*="${className}"]`))
        .map(el => el.className.split(' '))
        .flat()
        .filter(cls => cls.includes(className.substring(0, 3)));
      
      suggestions.push(...[...new Set(existingClasses)].map(cls => `.${cls}`));
    }

    return suggestions.slice(0, 5); // Limit suggestions
  }
}

// Performance debugging utilities
export class PerformanceDebugger {
  private static marks: Map<string, number> = new Map();
  private static measures: PerformanceMeasure[] = [];

  static mark(name: string): void {
    this.marks.set(name, performance.now());
    TestDebugger.log(`Performance mark: ${name}`);
  }

  static measure(name: string, startMark: string, endMark?: string): number {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      throw new Error(`Start mark "${startMark}" not found`);
    }

    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    if (endMark && !endTime) {
      throw new Error(`End mark "${endMark}" not found`);
    }

    const duration = (endTime || performance.now()) - startTime;
    
    const measure: PerformanceMeasure = {
      name,
      startMark,
      endMark,
      duration,
      timestamp: Date.now(),
    };

    this.measures.push(measure);
    TestDebugger.log(`Performance measure: ${name} = ${duration.toFixed(2)}ms`);

    return duration;
  }

  static getMeasures(): PerformanceMeasure[] {
    return [...this.measures];
  }

  static getSlowestMeasures(limit = 5): PerformanceMeasure[] {
    return this.measures
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  static clear(): void {
    this.marks.clear();
    this.measures = [];
  }

  static generatePerformanceReport(): string {
    const slowestMeasures = this.getSlowestMeasures();
    const allMeasures = this.getMeasures();

    return `
# Performance Debug Report
Generated: ${new Date().toISOString()}

## Summary
- Total measures: ${allMeasures.length}
- Average duration: ${allMeasures.length > 0 ? (allMeasures.reduce((sum, m) => sum + m.duration, 0) / allMeasures.length).toFixed(2) : 0}ms

## Slowest Operations
${slowestMeasures.map((measure, index) => `
${index + 1}. ${measure.name}: ${measure.duration.toFixed(2)}ms
   Start: ${measure.startMark}
   ${measure.endMark ? `End: ${measure.endMark}` : 'End: now'}
`).join('\n')}

## All Measures
${allMeasures.map(measure => `
- ${measure.name}: ${measure.duration.toFixed(2)}ms [${new Date(measure.timestamp).toISOString()}]
`).join('\n')}
    `;
  }
}

// Test debugging helpers
export const createDebugWrapper = (testName: string) => {
  return {
    beforeTest: () => {
      TestDebugger.log(`Starting test: ${testName}`);
      PerformanceDebugger.mark(`test_start_${testName}`);
    },
    afterTest: () => {
      PerformanceDebugger.mark(`test_end_${testName}`);
      const duration = PerformanceDebugger.measure(`test_duration_${testName}`, `test_start_${testName}`, `test_end_${testName}`);
      TestDebugger.log(`Completed test: ${testName} in ${duration.toFixed(2)}ms`);
    },
    onError: (error: Error) => {
      TestDebugger.log(`Test failed: ${testName}`, error, 'error');
      TestDebugger.snapshot(`error_${testName}_${Date.now()}`);
    },
  };
};

export const debugElement = (element: HTMLElement, name?: string) => {
  const analysis = ElementDebugger.analyzeElement(element);
  TestDebugger.log(`Element analysis${name ? ` for ${name}` : ''}`, analysis);
  return analysis;
};

export const debugQuery = (selector: string) => {
  const debug = ElementDebugger.debugElementQuery(selector);
  TestDebugger.log(`Query debug for: ${selector}`, debug);
  return debug;
};

export const waitForDebug = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      TestDebugger.log('Wait condition met');
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  TestDebugger.log('Wait condition timeout', { timeout }, 'error');
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Types
export interface DebugLog {
  timestamp: number;
  message: string;
  data?: any;
  level: 'info' | 'warn' | 'error';
  stackTrace?: string;
}

export interface DebugState {
  logs: DebugLog[];
  snapshots: Map<string, string>;
  domState: string;
  timestamp: number;
}

export interface MockCall {
  timestamp: number;
  args: any[];
  stackTrace?: string;
}

export interface ElementAnalysis {
  tagName: string;
  id: string;
  className: string;
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  isVisible: boolean;
  isInteractable: boolean;
  children: number;
  textContent: string;
  innerHTML: string;
}

export interface ElementQueryDebug {
  selector: string;
  found: number;
  elements: ElementAnalysis[];
  suggestions: string[];
}

export interface PerformanceMeasure {
  name: string;
  startMark: string;
  endMark?: string;
  duration: number;
  timestamp: number;
}

export interface SnapshotDifference {
  line: number;
  before: string;
  after: string;
  type: 'added' | 'removed' | 'modified';
}

export interface SnapshotComparison {
  identical: boolean;
  differences: SnapshotDifference[];
  similarity: number;
}

export default {
  TestDebugger,
  MockDebugger,
  ElementDebugger,
  PerformanceDebugger,
  createDebugWrapper,
  debugElement,
  debugQuery,
  waitForDebug,
};