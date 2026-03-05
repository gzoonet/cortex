import type { CortexEvent, EventHandler, EventBusInterface } from '../types/events.js';

export class EventBus implements EventBusInterface {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  emit(event: CortexEvent): void {
    const typeHandlers = this.handlers.get(event.type);
    if (!typeHandlers) return;

    for (const handler of typeHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow handler errors to prevent breaking the event chain.
        // In production this would go to the structured logger.
      }
    }
  }

  on(type: string, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => this.off(type, handler);
  }

  off(type: string, handler: EventHandler): void {
    const typeHandlers = this.handlers.get(type);
    if (!typeHandlers) return;

    typeHandlers.delete(handler);
    if (typeHandlers.size === 0) {
      this.handlers.delete(type);
    }
  }

  once(type: string, handler: EventHandler): void {
    const wrappedHandler: EventHandler = (event) => {
      this.off(type, wrappedHandler);
      handler(event);
    };
    this.on(type, wrappedHandler);
  }
}

export const eventBus = new EventBus();
