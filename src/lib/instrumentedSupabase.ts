/**
 * Instrumented Supabase Client
 * Wraps all Supabase operations to emit debug events
 */

import { supabase } from "@/integrations/supabase/client";
import { debugLog, EntityType } from "./debugLogger";
import type { Database } from "@/integrations/supabase/types";

// Table name to entity type mapping
const TABLE_ENTITY_MAP: Record<string, EntityType> = {
  lora_sensors: 'sensor',
  gateways: 'gateway',
  units: 'unit',
  areas: 'area',
  sites: 'site',
  alerts: 'alert',
  devices: 'device',
};

function generateCorrelationId(): string {
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Wrap a Supabase query builder to add logging
 */
function wrapQueryBuilder(builder: any, tableName: string, operation: string, correlationId: string, startTime: number): any {
  const originalThen = builder.then?.bind(builder);
  
  if (originalThen) {
    builder.then = function(onfulfilled?: any, onrejected?: any) {
      return originalThen(
        (result: any) => {
          const duration = Date.now() - startTime;
          debugLog.dbResult(
            operation,
            tableName,
            !result.error,
            {
              row_count: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0),
              has_error: !!result.error,
              error_message: result.error?.message,
            },
            duration,
            correlationId
          );
          debugLog.endOperation(correlationId, result.error ? 'error' : 'success', {
            row_count: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0),
          });
          return onfulfilled ? onfulfilled(result) : result;
        },
        (error: any) => {
          const duration = Date.now() - startTime;
          debugLog.dbResult(operation, tableName, false, { error: error.message }, duration, correlationId);
          debugLog.endOperation(correlationId, 'error', { error: error.message });
          return onrejected ? onrejected(error) : Promise.reject(error);
        }
      );
    };
  }
  
  return builder;
}

/**
 * Create an instrumented version of supabase.from()
 */
function instrumentedFrom<T extends keyof Database['public']['Tables']>(table: T) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  const tableName = table as string;
  const originalBuilder = supabase.from(table);
  
  // Create a proxy to intercept method calls
  return new Proxy(originalBuilder, {
    get(target, prop) {
      const original = (target as any)[prop];
      
      if (typeof original === 'function') {
        return function(...args: any[]) {
          let operation = 'select';
          
          if (prop === 'insert') {
            operation = 'insert';
            const entityType = TABLE_ENTITY_MAP[tableName];
            debugLog.dbOperation('insert', tableName, { 
              row_count: Array.isArray(args[0]) ? args[0].length : 1 
            }, correlationId);
            if (entityType) {
              debugLog.crud('create', entityType, null, { table: tableName }, correlationId);
            }
          } else if (prop === 'update') {
            operation = 'update';
            const entityType = TABLE_ENTITY_MAP[tableName];
            debugLog.dbOperation('update', tableName, {}, correlationId);
            if (entityType) {
              debugLog.crud('update', entityType, null, { table: tableName }, correlationId);
            }
          } else if (prop === 'delete') {
            operation = 'delete';
            const entityType = TABLE_ENTITY_MAP[tableName];
            debugLog.dbOperation('delete', tableName, {}, correlationId);
            if (entityType) {
              debugLog.crud('delete', entityType, null, { table: tableName }, correlationId);
            }
          } else if (prop === 'select') {
            operation = 'select';
            debugLog.dbOperation('select', tableName, { columns: args[0] }, correlationId);
          } else if (prop === 'upsert') {
            operation = 'upsert';
            debugLog.dbOperation('update', tableName, { is_upsert: true }, correlationId);
          }
          
          const result = original.apply(target, args);
          
          // Wrap the result to intercept the final .then()
          return wrapQueryBuilder(result, tableName, operation, correlationId, startTime);
        };
      }
      
      return original;
    },
  });
}

/**
 * Instrumented Edge Function invocation
 */
async function invokeFunction(
  name: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<{ data: any; error: any }> {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  
  debugLog.edgeFunction(name, 'start', { 
    has_body: !!options?.body,
    body_keys: options?.body ? Object.keys(options.body) : undefined,
  }, undefined, correlationId);

  try {
    const result = await supabase.functions.invoke(name, options);
    const duration = Date.now() - startTime;

    if (result.error) {
      debugLog.edgeFunction(name, 'error', {
        error: result.error.message,
        error_code: (result.data as any)?.error_code,
        request_id: (result.data as any)?.request_id,
      }, duration, correlationId);
      debugLog.endOperation(correlationId, 'error', { error: result.error.message });
    } else {
      debugLog.edgeFunction(name, 'success', {
        has_data: !!result.data,
        request_id: (result.data as any)?.request_id,
      }, duration, correlationId);
      debugLog.endOperation(correlationId, 'success', { duration });
    }

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    debugLog.edgeFunction(name, 'error', { error: error.message }, duration, correlationId);
    debugLog.endOperation(correlationId, 'error', { error: error.message });
    throw error;
  }
}

/**
 * Instrumented RPC call
 */
async function instrumentedRpc<T extends keyof Database['public']['Functions']>(
  fn: T,
  args?: Database['public']['Functions'][T]['Args'],
  options?: any
): Promise<{ data: any; error: any }> {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  const fnName = fn as string;
  
  debugLog.dbOperation('rpc', fnName, { 
    args_keys: args ? Object.keys(args) : undefined 
  }, correlationId);

  try {
    const result = await supabase.rpc(fn, args as any, options);
    const duration = Date.now() - startTime;

    debugLog.dbResult(
      'rpc',
      fnName,
      !result.error,
      {
        has_data: !!result.data,
        error_message: result.error?.message,
      },
      duration,
      correlationId
    );

    debugLog.endOperation(correlationId, result.error ? 'error' : 'success', { duration });
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    debugLog.dbResult('rpc', fnName, false, { error: error.message }, duration, correlationId);
    debugLog.endOperation(correlationId, 'error', { error: error.message });
    throw error;
  }
}

/**
 * Instrumented Supabase client
 * Use this instead of the raw supabase client for automatic debug logging
 */
export const instrumentedSupabase = {
  from: instrumentedFrom,
  
  functions: {
    invoke: invokeFunction,
  },
  
  rpc: instrumentedRpc,
  
  // Pass through auth - no instrumentation needed here
  auth: supabase.auth,
  
  // Instrumented channel for realtime
  channel: (name: string) => {
    debugLog.realtime('subscribe', name);
    return supabase.channel(name);
  },
  
  removeChannel: (channel: any) => {
    debugLog.realtime('unsubscribe', channel.topic || 'unknown');
    return supabase.removeChannel(channel);
  },
};

// Type helper for compatibility
export type InstrumentedSupabase = typeof instrumentedSupabase;
