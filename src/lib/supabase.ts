import { createClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dzjqheusezwkhjmpnjsr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6anFoZXVzZXp3a2hqbXBuanNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzY0NjIsImV4cCI6MjEwMDIxMjQ2Mn0.WXK8mx4NJlsWlkqIGkDQZHK3QUASjhrqwNXcfB_f0E8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

let isSubscribed = false;

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

  const channel = supabase
    .channel('public-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inquiries' },
      (payload) => {
        console.log('[Realtime] Inquiries table change:', payload.eventType);
        notifyChange('inquiries', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['inquiries-list'] });
        queryClient.invalidateQueries({ queryKey: ['inquiries'] });
        queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        queryClient.invalidateQueries({ queryKey: ['kanban'] });
        queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kra-sheets'] });
        queryClient.invalidateQueries({ queryKey: ['home-inquiries'] });
        queryClient.invalidateQueries({ queryKey: ['action-queue'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deals' },
      (payload) => {
        console.log('[Realtime] Deals table change:', payload.eventType);
        notifyChange('deals', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['deals'] });
        queryClient.invalidateQueries({ queryKey: ['deal'] });
        queryClient.invalidateQueries({ queryKey: ['orders-list'] });
        queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        queryClient.invalidateQueries({ queryKey: ['kanban'] });
        queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kra-sheets'] });
        queryClient.invalidateQueries({ queryKey: ['home-summary-deals'] });
        queryClient.invalidateQueries({ queryKey: ['home-won-deals'] });
        queryClient.invalidateQueries({ queryKey: ['action-queue'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deal_items' },
      (payload) => {
        console.log('[Realtime] Deal Items table change:', payload.eventType);
        notifyChange('deal_items', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['deal'] });
        queryClient.invalidateQueries({ queryKey: ['deals'] });
        queryClient.invalidateQueries({ queryKey: ['orders-list'] });
        queryClient.invalidateQueries({ queryKey: ['inquiries-list'] });
        queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customer_visits' },
      (payload) => {
        console.log('[Realtime] Customer Visits table change:', payload.eventType);
        notifyChange('customer_visits', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['visits'] });
        queryClient.invalidateQueries({ queryKey: ['customer-visits'] });
        queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kra-sheets'] });
        queryClient.invalidateQueries({ queryKey: ['home-visits'] });
        queryClient.invalidateQueries({ queryKey: ['action-queue'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'complaints' },
      (payload) => {
        console.log('[Realtime] Complaints table change:', payload.eventType);
        notifyChange('complaints', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
        queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kra-sheets'] });
        queryClient.invalidateQueries({ queryKey: ['home-complaints'] });
        queryClient.invalidateQueries({ queryKey: ['action-queue'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers' },
      (payload) => {
        console.log('[Realtime] Customers table change:', payload.eventType);
        notifyChange('customers', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['customer'] });
        queryClient.invalidateQueries({ queryKey: ['customer-names-list'] });
        queryClient.invalidateQueries({ queryKey: ['customer-names-list-orders'] });
        queryClient.invalidateQueries({ queryKey: ['reorder-queue'] });
        queryClient.invalidateQueries({ queryKey: ['churn-risk'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recurring_customers' },
      (payload) => {
        console.log('[Realtime] Recurring Customers table change:', payload.eventType);
        notifyChange('recurring_customers', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['reorder-queue'] });
        queryClient.invalidateQueries({ queryKey: ['churn-risk'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kra_logs' },
      (payload) => {
        console.log('[Realtime] KRA Logs table change:', payload.eventType);
        notifyChange('kra_logs', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kra-sheets'] });
        queryClient.invalidateQueries({ queryKey: ['action-queue'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_logs' },
      (payload) => {
        console.log('[Realtime] Activity Logs table change:', payload.eventType);
        notifyChange('activity_logs', payload.eventType, payload);
        queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
        queryClient.invalidateQueries({ queryKey: ['action-queue'] });
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
