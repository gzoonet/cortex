import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@cortex/core';
import type { CortexEvent } from '@cortex/core';

function makeEvent(type: string, payload: unknown): CortexEvent {
  return { type, payload, timestamp: new Date().toISOString(), source: 'test' };
}

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should emit and receive events', () => {
    const handler = vi.fn();
    bus.on('file.changed', handler);

    const event = makeEvent('file.changed', { path: '/test.md' });
    bus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should support multiple handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('file.changed', handler1);
    bus.on('file.changed', handler2);

    bus.emit(makeEvent('file.changed', { path: '/test.md' }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe via returned function', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('file.changed', handler);

    bus.emit(makeEvent('file.changed', { path: '/test.md' }));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit(makeEvent('file.changed', { path: '/test.md' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe via off()', () => {
    const handler = vi.fn();
    bus.on('entity.created', handler);
    bus.off('entity.created', handler);

    bus.emit(makeEvent('entity.created', { entity: { id: '1' } }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support once() for single-fire handlers', () => {
    const handler = vi.fn();
    bus.once('file.changed', handler);

    const event = makeEvent('file.changed', { path: '/test.md' });
    bus.emit(event);
    bus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not cross-fire between event types', () => {
    const fileHandler = vi.fn();
    const entityHandler = vi.fn();

    bus.on('file.changed', fileHandler);
    bus.on('entity.created', entityHandler);

    bus.emit(makeEvent('file.changed', { path: '/test.md' }));

    expect(fileHandler).toHaveBeenCalledTimes(1);
    expect(entityHandler).not.toHaveBeenCalled();
  });
});
