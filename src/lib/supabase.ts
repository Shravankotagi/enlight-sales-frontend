import { createClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rrzguenyebimrbbykowm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyemd1ZW55ZWJpbXJiYnlrb3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NTQxMjcsImV4cCI6MjEwNDMzMDEyN30.2nbrH6gtg6KH4i-GhTHHCICmttng6F0oZVwXQUCUiP4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

let isSubscribed = false;
const debounceTimers: Record<string, any> = {};

export function setupRealtimeSubscriptions(queryClient: QueryClient) {
  if (isSubscribed) return;
  isSubscribed = true;

  console.log('[Supabase Realtime] Initializing live subscriptions for all tables...');

  // Helper to dispatch global DOM event for components with non-React-Query state
  const notifyChange = (table: string, eventType: string, payload: any) => {
    window.dispatchEvent(
      new CustomEvent('enlight-db-change', {
        detail: { table, eventType, payload },
      })
    );
  };

  // Debounce invalidations by 250ms to coalesce rapid multi-row batch inserts (e.g. multi-item deals)
  const debounceInvalidate = (keys: string[][], delayMs = 250) => {
    const keyId = keys.map(k => k.join(':')).join('|');
    if (debounceTimers[keyId]) {
      clearTimeout(debounceTimers[keyId]);
    }
    debounceTimers[keyId] = setTimeout(() => {
      keys.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
      });
      delete debounceTimers[keyId];
    }, delayMs);
  };

  const channel = supabase
    .channel('public-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inquiries' },
      (payload) => {
        console.log('[Realtime] Inquiries table change:', payload.eventType);
        notifyChange('inquiries', payload.eventType, payload);
        debounceInvalidate([
          ['inquiries-list'],
          ['inquiries'],
          ['pipeline'],
          ['kanban'],
          ['kra-dashboard'],
          ['kra-sheets'],
          ['home-inquiries'],
          ['action-queue'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deals' },
      (payload) => {
        console.log('[Realtime] Deals table change:', payload.eventType);
        notifyChange('deals', payload.eventType, payload);
        debounceInvalidate([
          ['deals'],
          ['deal'],
          ['orders-list'],
          ['pipeline'],
          ['kanban'],
          ['kra-dashboard'],
          ['kra-sheets'],
          ['home-summary-deals'],
          ['home-won-deals'],
          ['action-queue'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deal_items' },
      (payload) => {
        console.log('[Realtime] Deal Items table change:', payload.eventType);
        notifyChange('deal_items', payload.eventType, payload);
        debounceInvalidate([
          ['deal'],
          ['deals'],
          ['orders-list'],
          ['inquiries-list'],
          ['pipeline'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customer_visits' },
      (payload) => {
        console.log('[Realtime] Customer Visits table change:', payload.eventType);
        notifyChange('customer_visits', payload.eventType, payload);
        debounceInvalidate([
          ['visits'],
          ['customer-visits'],
          ['kra-dashboard'],
          ['kra-sheets'],
          ['home-visits'],
          ['action-queue'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'complaints' },
      (payload) => {
        console.log('[Realtime] Complaints table change:', payload.eventType);
        notifyChange('complaints', payload.eventType, payload);
        debounceInvalidate([
          ['complaints'],
          ['kra-dashboard'],
          ['kra-sheets'],
          ['home-complaints'],
          ['action-queue'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers' },
      (payload) => {
        console.log('[Realtime] Customers table change:', payload.eventType);
        notifyChange('customers', payload.eventType, payload);
        debounceInvalidate([
          ['customers'],
          ['customer'],
          ['customer-names-list'],
          ['customer-names-list-orders'],
          ['reorder-queue'],
          ['churn-risk'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recurring_customers' },
      (payload) => {
        console.log('[Realtime] Recurring Customers table change:', payload.eventType);
        notifyChange('recurring_customers', payload.eventType, payload);
        debounceInvalidate([
          ['customers'],
          ['reorder-queue'],
          ['churn-risk'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kra_logs' },
      (payload) => {
        console.log('[Realtime] KRA Logs table change:', payload.eventType);
        notifyChange('kra_logs', payload.eventType, payload);
        debounceInvalidate([
          ['kra-dashboard'],
          ['kra-sheets'],
          ['action-queue'],
        ]);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_logs' },
      (payload) => {
        console.log('[Realtime] Activity Logs table change:', payload.eventType);
        notifyChange('activity_logs', payload.eventType, payload);
        debounceInvalidate([
          ['activity-logs'],
          ['action-queue'],
        ]);
      }
    )
    .subscribe((status) => {
      console.log('[Supabase Realtime] Subscription status:', status);
    });

  return () => {
    supabase.removeChannel(channel);
    isSubscribed = false;
  };
}
