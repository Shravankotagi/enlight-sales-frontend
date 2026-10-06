import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSystemPoReservationToken,
  getPoErrorMessage,
  normalizeSystemPoAllocation,
  type SystemPoAllocation,
  type SystemPoRequestParams,
} from '../lib/systemPo';

type PoRequest = (params: SystemPoRequestParams) => Promise<any>;

interface UseSystemPoConflictSuggestionOptions {
  value: string;
  reservationToken?: string;
  dealId?: string;
  enabled?: boolean;
  allocate: PoRequest;
  check: PoRequest;
}

export function useSystemPoConflictSuggestion({
  value,
  reservationToken,
  dealId,
  enabled = true,
  allocate,
  check,
}: UseSystemPoConflictSuggestionOptions) {
  const [checking, setChecking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SystemPoAllocation | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const valueRef = useRef(value);
  const lastValueRef = useRef(value.trim());
  const suggestionForRef = useRef('');
  const suggestingForRef = useRef('');

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const cleanValue = value.trim();
    if (lastValueRef.current === cleanValue) return;

    lastValueRef.current = cleanValue;
    setConflict(null);
    setSuggestion(null);
    setSuggestionError(null);
    suggestionForRef.current = '';
  }, [value]);

  const requestNextSuggestion = useCallback(
    async (conflictingValue?: string, force = false) => {
      const cleanValue = String(conflictingValue ?? valueRef.current).trim();
      if (!cleanValue) return null;
      if (!force && suggestionForRef.current === cleanValue) return suggestion;
      if (suggestingForRef.current === cleanValue) return null;

      if (force) {
        setSuggestion(null);
        suggestionForRef.current = '';
      }

      const reservationToken = createSystemPoReservationToken('po-conflict');
      suggestionForRef.current = cleanValue;
      suggestingForRef.current = cleanValue;
      setSuggesting(true);
      setSuggestionError(null);

      try {
        const response = await allocate({
          reservation_token: reservationToken,
          deal_id: dealId,
        });
        const nextAllocation = normalizeSystemPoAllocation(response);
        if (!nextAllocation) {
          throw new Error('The next available system PO was not returned.');
        }

        if (valueRef.current.trim() === cleanValue) {
          setSuggestion(nextAllocation);
        }
        return nextAllocation;
      } catch (error: any) {
        if (valueRef.current.trim() === cleanValue) {
          setSuggestionError(getPoErrorMessage(error, 'Could not load the next available system PO.'));
        }
        return null;
      } finally {
        if (suggestingForRef.current === cleanValue) {
          suggestingForRef.current = '';
          setSuggesting(false);
        }
      }
    },
    [allocate, dealId, suggestion],
  );

  const reportConflict = useCallback(
    (message: string, conflictingValue?: string, force = false) => {
      setConflict(message || 'This PO number is already allocated.');
      void requestNextSuggestion(conflictingValue, force);
    },
    [requestNextSuggestion],
  );

  useEffect(() => {
    const cleanValue = value.trim();
    if (!enabled || !cleanValue || !reservationToken) {
      setChecking(false);
      setConflict(null);
      setSuggestion(null);
      setSuggestionError(null);
      suggestionForRef.current = '';
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setChecking(true);
      try {
        const response = await check({
          po_number: cleanValue,
          reservation_token: reservationToken,
          deal_id: dealId,
        });
        if (!active || valueRef.current.trim() !== cleanValue) return;

        if (response?.data?.available === false) {
          const reason = response.data.reason || 'This PO number is already allocated.';
          setConflict(reason);
          void requestNextSuggestion(cleanValue);
        } else {
          setConflict(null);
          setSuggestion(null);
          setSuggestionError(null);
          suggestionForRef.current = '';
        }
      } catch (error: any) {
        if (active && valueRef.current.trim() === cleanValue) {
          setConflict(getPoErrorMessage(error, 'PO availability could not be checked. Please try again.'));
        }
      } finally {
        if (active) setChecking(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    check,
    dealId,
    enabled,
    requestNextSuggestion,
    reservationToken,
    value,
  ]);

  return {
    checking,
    suggesting,
    conflict,
    suggestion,
    suggestionError,
    requestNextSuggestion,
    reportConflict,
  };
}
