interface QueueTask {
  (): Promise<void>;
}

interface Queue {
  add(task: QueueTask): void;
  flush(): Promise<void>;
  setRetryListener(listener: (attempt: number) => void): void;
}

const DEFAULT_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export const createQueue = (dbName: string, version: number): Queue & { setRetryListener: (listener: (attempt: number) => void) => void } => {
  let retryAttempt = 0;
  let retryListener: ((attempt: number) => void) | null = null;
  const tasks: QueueTask[] = [];
  let flushing = false;

  const add = (task: QueueTask): void => {
    tasks.push(task);
    void flush();
  };

  const flush = async (): Promise<void> => {
    if (flushing) {
      return;
    }
    flushing = true;
    while (tasks.length) {
      const current = tasks[0];
      try {
        await current();
        tasks.shift();
        retryAttempt = 0;
      } catch (error) {
        retryAttempt += 1;
        const backoff = Math.min(DEFAULT_BACKOFF_MS * 2 ** (retryAttempt - 1), MAX_BACKOFF_MS);
        if (retryListener) {
          retryListener(retryAttempt);
        }
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
    flushing = false;
  };

  const setRetryListener = (listener: (attempt: number) => void): void => {
    retryListener = listener;
  };

  void openDB(dbName, version);

  return { add, flush, setRetryListener };
};

const openDB = (dbName: string, version: number): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};
