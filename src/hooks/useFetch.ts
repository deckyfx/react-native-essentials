// https://usehooks-ts.com/react-hook/use-fetch

import { useCallback, useEffect, useReducer, useRef } from 'react';

export interface FetchState<T> {
  data?: T;
  error?: Error;
  loading?: boolean;
}

export enum DispatchFecthState {
  LOADING = 'loading',
  FETCHED = 'fetched',
  ERROR = 'error',
  IDLE = 'idle',
}

type Cache<T> = { [url: string]: T };

// discriminated union type
type Action<T> =
  | { type: DispatchFecthState.LOADING }
  | { type: DispatchFecthState.FETCHED; payload: T }
  | { type: DispatchFecthState.ERROR; payload: Error };

export interface UseFecthOptions extends RequestInit {
  autorun?: boolean;
  cacheResponse?: boolean;
}

export interface FecthOutput<T> extends FetchState<T> {
  fetch: (url: string | null | undefined, options: RequestInit | null | undefined) => void;
  abort: () => void;
}

const useFetch = <T = unknown>(
  url?: string,
  options: UseFecthOptions = {
    autorun: false,
    cacheResponse: false,
  },
): FecthOutput<T> => {
  const cache = useRef<Cache<T>>({});

  // Used to prevent state update if the component is unmounted
  const cancelRequest = useRef<boolean>(false);

  const initialState: FetchState<T> = {
    error: undefined,
    data: undefined,
    loading: false,
  };

  // Keep state logic separated
  const fetchReducer = (_state: FetchState<T>, action: Action<T>): FetchState<T> => {
    switch (action.type) {
      case DispatchFecthState.LOADING:
        return { ...initialState, loading: true };
      case DispatchFecthState.FETCHED:
        return { ...initialState, loading: false, data: action.payload };
      case DispatchFecthState.ERROR:
        return { ...initialState, loading: false, error: action.payload };
      default:
        return _state;
    }
  };

  const [state, dispatch] = useReducer(fetchReducer, initialState);

  const execute = useCallback(
    async (newurl: string | null | undefined = null, newoptions: RequestInit | null | undefined = null) => {
      if (!newurl) {
        newurl = url;
      }

      if (!newoptions) {
        newoptions = options;
      }

      // Do nothing if the url is not given
      if (!newurl) return;

      cancelRequest.current = false;

      const fetchData = async () => {
        dispatch({ type: DispatchFecthState.LOADING });

        // If a cache exists for this url, return it
        if (options.cacheResponse && cache.current[newurl!]) {
          dispatch({ type: DispatchFecthState.FETCHED, payload: cache.current[newurl!] });
          return;
        }

        try {
          const response = await fetch(newurl!, newoptions!);
          if (!response.ok) {
            throw new Error(response.statusText);
          }

          const data = (await response.json()) as T;
          if (options.cacheResponse) cache.current[newurl!] = data;
          if (cancelRequest.current) return;

          dispatch({ type: DispatchFecthState.FETCHED, payload: data });
        } catch (error) {
          if (cancelRequest.current) return;

          dispatch({ type: DispatchFecthState.ERROR, payload: error as Error });
        }
      };

      void fetchData();

      // Use the cleanup function for avoiding a possibly...
      // ...state update after the component was unmounted
      return () => {
        cancelRequest.current = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [url],
  );

  /* tslint:disable:no-empty */
  const abort = useCallback(() => {}, []);
  /* tslint:enable */

  useEffect(() => {
    if (options.autorun) {
      execute();
    }
  }, [url]);

  return { ...state, fetch: execute, abort };
};

export default useFetch;
