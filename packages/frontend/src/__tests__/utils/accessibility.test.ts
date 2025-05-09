import { 
  isKey, 
  handleKeyboardActivation, 
  createAccessibleId,
  KeyCode,
  srOnlyStyle
} from '@/utils/accessibility';
import { vi } from 'vitest';

describe('Accessibility Utilities', () => {
  describe('isKey', () => {
    it('should return true when event key matches the specified key', () => {
      const event = { key: 'Enter' } as React.KeyboardEvent;
      expect(isKey(event, KeyCode.ENTER)).toBe(true);
    });

    it('should return true when event key matches one of the specified keys', () => {
      const event = { key: ' ' } as React.KeyboardEvent;
      expect(isKey(event, [KeyCode.ENTER, KeyCode.SPACE])).toBe(true);
    });

    it('should return false when event key does not match the specified key', () => {
      const event = { key: 'a' } as React.KeyboardEvent;
      expect(isKey(event, KeyCode.ENTER)).toBe(false);
    });

    it('should return false when event key does not match any of the specified keys', () => {
      const event = { key: 'Tab' } as React.KeyboardEvent;
      expect(isKey(event, [KeyCode.ENTER, KeyCode.SPACE])).toBe(false);
    });
  });

  describe('handleKeyboardActivation', () => {
    it('should call the callback when the event key matches the default keys', () => {
      const callback = vi.fn();
      const preventDefault = vi.fn();
      
      // Test Enter key
      const enterEvent = { 
        key: 'Enter',
        preventDefault 
      } as unknown as React.KeyboardEvent;
      
      handleKeyboardActivation(enterEvent, callback);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
      
      // Test Space key
      const spaceEvent = { 
        key: ' ',
        preventDefault 
      } as unknown as React.KeyboardEvent;
      
      handleKeyboardActivation(spaceEvent, callback);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(preventDefault).toHaveBeenCalledTimes(2);
    });

    it('should call the callback when the event key matches the specified keys', () => {
      const callback = vi.fn();
      const preventDefault = vi.fn();
      
      const event = { 
        key: 'ArrowDown',
        preventDefault 
      } as unknown as React.KeyboardEvent;
      
      handleKeyboardActivation(event, callback, [KeyCode.ARROW_DOWN]);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it('should not call the callback when the event key does not match the specified keys', () => {
      const callback = vi.fn();
      const preventDefault = vi.fn();
      
      const event = { 
        key: 'a',
        preventDefault 
      } as unknown as React.KeyboardEvent;
      
      handleKeyboardActivation(event, callback);
      expect(callback).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('createAccessibleId', () => {
    it('should create an ID by combining prefix and value', () => {
      expect(createAccessibleId('test', 'value')).toBe('test-value');
      expect(createAccessibleId('input', 123)).toBe('input-123');
    });
  });

  describe('srOnlyStyle', () => {
    it('should have the correct CSS properties for screen reader only content', () => {
      expect(srOnlyStyle).toEqual(expect.objectContaining({
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: '0',
      }));
    });
  });
});