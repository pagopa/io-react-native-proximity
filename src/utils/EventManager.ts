// TODO: This is a temporary list of event type.
type EventType =
  | 'ON_BLE_START'
  | 'ON_BLE_STOP'
  | 'ON_PERIPHERAL_DISCOVERED'
  | 'ON_PERIPHERAL_CONNECTED'
  | 'ON_PERIPHERAL_DISCONNECTED'
  | 'ON_PERIPHERAL_SERVICES_DISCOVERED'
  | 'ON_PERIPHERAL_RSSI_UPDATED'
  | 'ON_CHARACTERISTIC_READ'
  | 'ON_CHARACTERISTIC_WRITTEN'
  | 'ON_CHARACTERISTIC_CHANGED'
  | 'ON_BLE_ERROR'
  | 'ON_SESSION_ESTABLISHMENT'
  | 'ON_DOCUMENT_REQUESTS_RECEIVED'
  | 'ON_DOCUMENT_PRESENTATION_COMPLETED';

export type EventData = {
  message: string;
  type: EventType;
};

/**
 * Event Manager
 * @function
 * @alias module:utils/EventManager
 * @returns {object} EventManager
 * @property {function} addListener - Add event listener
 * @property {function} removeListener - Remove event listener
 * @property {function} emit - Emit event
 * @example
 * import createEventManager from 'utils/EventManager';
 * const eventManager = createEventManager();
 * eventManager.addListener('ON_BLE_START', (eventData) => {
 * console.log(eventData);
 * });
 * eventManager.emit('ON_BLE_START', { message: 'Ble started', type: 'ON_BLE_START' });
 * eventManager.removeListener('ON_BLE_START', (eventData) => {
 * console.log(eventData);
 * });
 * @see module:utils/EventManager
 */
const createEventManager = () => {
  const listeners: { [key: string]: Array<(eventData: EventData) => void> } =
    {};

  const addListener = (
    eventName: string,
    callback: (eventData: EventData) => void
  ) => {
    if (!listeners[eventName]) {
      listeners[eventName] = [];
    }
    listeners[eventName]?.push(callback);
  };

  const removeListener = (
    eventName: string,
    callback: (eventData: EventData) => void
  ) => {
    if (listeners[eventName]) {
      listeners[eventName] = (listeners[eventName] || []).filter(
        (listener) => listener !== callback
      );
    }
  };

  const removeAllListeners = () => {
    Object.keys(listeners).forEach((eventName) => {
      listeners[eventName] = [];
    });
  };

  const emit = (eventName: string, data: EventData) => {
    if (listeners[eventName]) {
      listeners[eventName]?.forEach((listener) => listener(data));
    }
  };

  return {
    addListener,
    removeListener,
    removeAllListeners,
    emit,
  };
};

export default createEventManager;
