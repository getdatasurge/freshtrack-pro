export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          created_at: string
          door_open_critical_minutes: number | null
          door_open_max_mask_minutes_per_day: number | null
          door_open_warning_minutes: number | null
          excursion_confirm_minutes_door_closed: number | null
          excursion_confirm_minutes_door_open: number | null
          expected_reading_interval_seconds: number | null
          id: string
          manual_grace_minutes: number | null
          manual_interval_minutes: number | null
          manual_log_missed_checkins_threshold: number | null
          max_excursion_minutes: number | null
          offline_critical_missed_checkins: number | null
          offline_trigger_additional_minutes: number | null
          offline_trigger_multiplier: number | null
          offline_warning_missed_checkins: number | null
          organization_id: string | null
          site_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          door_open_critical_minutes?: number | null
          door_open_max_mask_minutes_per_day?: number | null
          door_open_warning_minutes?: number | null
          excursion_confirm_minutes_door_closed?: number | null
          excursion_confirm_minutes_door_open?: number | null
          expected_reading_interval_seconds?: number | null
          id?: string
          manual_grace_minutes?: number | null
          manual_interval_minutes?: number | null
          manual_log_missed_checkins_threshold?: number | null
          max_excursion_minutes?: number | null
          offline_critical_missed_checkins?: number | null
          offline_trigger_additional_minutes?: number | null
          offline_trigger_multiplier?: number | null
          offline_warning_missed_checkins?: number | null
          organization_id?: string | null
          site_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          door_open_critical_minutes?: number | null
          door_open_max_mask_minutes_per_day?: number | null
          door_open_warning_minutes?: number | null
          excursion_confirm_minutes_door_closed?: number | null
          excursion_confirm_minutes_door_open?: number | null
          expected_reading_interval_seconds?: number | null
          id?: string
          manual_grace_minutes?: number | null
          manual_interval_minutes?: number | null
          manual_log_missed_checkins_threshold?: number | null
          max_excursion_minutes?: number | null
          offline_critical_missed_checkins?: number | null
          offline_trigger_additional_minutes?: number | null
          offline_trigger_multiplier?: number | null
          offline_warning_missed_checkins?: number | null
          organization_id?: string | null
          site_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules_history: {
        Row: {
          action: string
          alert_rules_id: string | null
          changed_at: string
          changed_by: string
          changes: Json
          created_at: string
          id: string
          note: string | null
          organization_id: string | null
          site_id: string | null
          unit_id: string | null
        }
        Insert: {
          action: string
          alert_rules_id?: string | null
          changed_at?: string
          changed_by: string
          changes?: Json
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string | null
          site_id?: string | null
          unit_id?: string | null
        }
        Update: {
          action?: string
          alert_rules_id?: string | null
          changed_at?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string | null
          site_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_history_alert_rules_id_fkey"
            columns: ["alert_rules_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_history_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledgment_notes: string | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          area_id: string | null
          created_at: string
          escalation_level: number
          first_active_at: string | null
          id: string
          last_notified_at: string | null
          last_notified_reason: string | null
          message: string | null
          metadata: Json | null
          next_escalation_at: string | null
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          site_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["alert_status"]
          temp_limit: number | null
          temp_reading: number | null
          title: string
          triggered_at: string
          triggered_by_device_id: string | null
          unit_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgment_notes?: string | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          area_id?: string | null
          created_at?: string
          escalation_level?: number
          first_active_at?: string | null
          id?: string
          last_notified_at?: string | null
          last_notified_reason?: string | null
          message?: string | null
          metadata?: Json | null
          next_escalation_at?: string | null
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          site_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          temp_limit?: number | null
          temp_reading?: number | null
          title: string
          triggered_at?: string
          triggered_by_device_id?: string | null
          unit_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgment_notes?: string | null
          alert_type?: Database["public"]["Enums"]["alert_type"]
          area_id?: string | null
          created_at?: string
          escalation_level?: number
          first_active_at?: string | null
          id?: string
          last_notified_at?: string | null
          last_notified_reason?: string | null
          message?: string | null
          metadata?: Json | null
          next_escalation_at?: string | null
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          site_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          temp_limit?: number | null
          temp_reading?: number | null
          title?: string
          triggered_at?: string
          triggered_by_device_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_triggered_by_device_id_fkey"
            columns: ["triggered_by_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          site_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          site_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_records: {
        Row: {
          calibrated_at: string
          created_at: string
          device_id: string
          id: string
          measured_temp: number
          next_calibration_due: string | null
          notes: string | null
          offset_applied: number
          performed_by: string
          reference_temp: number
        }
        Insert: {
          calibrated_at?: string
          created_at?: string
          device_id: string
          id?: string
          measured_temp: number
          next_calibration_due?: string | null
          notes?: string | null
          offset_applied: number
          performed_by: string
          reference_temp: number
        }
        Update: {
          calibrated_at?: string
          created_at?: string
          device_id?: string
          id?: string
          measured_temp?: number
          next_calibration_due?: string | null
          notes?: string | null
          offset_applied?: number
          performed_by?: string
          reference_temp?: number
        }
        Relationships: [
          {
            foreignKeyName: "calibration_records_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          action_taken: string
          alert_id: string | null
          completed_at: string
          created_at: string
          created_by: string
          id: string
          photo_urls: string[] | null
          preventive_measures: string | null
          root_cause: string | null
          unit_id: string
        }
        Insert: {
          action_taken: string
          alert_id?: string | null
          completed_at?: string
          created_at?: string
          created_by: string
          id?: string
          photo_urls?: string[] | null
          preventive_measures?: string | null
          root_cause?: string | null
          unit_id: string
        }
        Update: {
          action_taken?: string
          alert_id?: string | null
          completed_at?: string
          created_at?: string
          created_by?: string
          id?: string
          photo_urls?: string[] | null
          preventive_measures?: string | null
          root_cause?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          battery_last_reported_at: string | null
          battery_level: number | null
          battery_voltage: number | null
          calibration_offset: number | null
          created_at: string
          firmware_version: string | null
          hub_id: string | null
          id: string
          last_calibrated_at: string | null
          last_seen_at: string | null
          mac_address: string | null
          serial_number: string
          signal_strength: number | null
          status: Database["public"]["Enums"]["device_status"]
          transmit_interval: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          battery_last_reported_at?: string | null
          battery_level?: number | null
          battery_voltage?: number | null
          calibration_offset?: number | null
          created_at?: string
          firmware_version?: string | null
          hub_id?: string | null
          id?: string
          last_calibrated_at?: string | null
          last_seen_at?: string | null
          mac_address?: string | null
          serial_number: string
          signal_strength?: number | null
          status?: Database["public"]["Enums"]["device_status"]
          transmit_interval?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          battery_last_reported_at?: string | null
          battery_level?: number | null
          battery_voltage?: number | null
          calibration_offset?: number | null
          created_at?: string
          firmware_version?: string | null
          hub_id?: string | null
          id?: string
          last_calibrated_at?: string | null
          last_seen_at?: string | null
          mac_address?: string | null
          serial_number?: string
          signal_strength?: number | null
          status?: Database["public"]["Enums"]["device_status"]
          transmit_interval?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      door_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          occurred_at: string
          source: string | null
          state: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          source?: string | null
          state: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          source?: string | null
          state?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notification_channels: string[]
          organization_id: string
          phone: string | null
          priority: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notification_channels?: string[]
          organization_id: string
          phone?: string | null
          priority?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_channels?: string[]
          organization_id?: string
          phone?: string | null
          priority?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_policies: {
        Row: {
          acknowledge_stops_notifications: boolean
          created_at: string
          critical_owner_delay_minutes: number | null
          critical_primary_delay_minutes: number
          critical_secondary_delay_minutes: number | null
          id: string
          organization_id: string | null
          quiet_hours_behavior: string | null
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          repeat_notification_interval_minutes: number | null
          site_id: string | null
          updated_at: string
          warning_primary_delay_minutes: number
          warning_secondary_delay_minutes: number | null
        }
        Insert: {
          acknowledge_stops_notifications?: boolean
          created_at?: string
          critical_owner_delay_minutes?: number | null
          critical_primary_delay_minutes?: number
          critical_secondary_delay_minutes?: number | null
          id?: string
          organization_id?: string | null
          quiet_hours_behavior?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          repeat_notification_interval_minutes?: number | null
          site_id?: string | null
          updated_at?: string
          warning_primary_delay_minutes?: number
          warning_secondary_delay_minutes?: number | null
        }
        Update: {
          acknowledge_stops_notifications?: boolean
          created_at?: string
          critical_owner_delay_minutes?: number | null
          critical_primary_delay_minutes?: number
          critical_secondary_delay_minutes?: number | null
          id?: string
          organization_id?: string | null
          quiet_hours_behavior?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          repeat_notification_interval_minutes?: number | null
          site_id?: string | null
          updated_at?: string
          warning_primary_delay_minutes?: number
          warning_secondary_delay_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_policies_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      event_logs: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          event_data: Json
          event_hash: string | null
          event_type: string
          id: string
          ip_address: string | null
          organization_id: string
          previous_hash: string | null
          recorded_at: string
          site_id: string | null
          unit_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          event_data?: Json
          event_hash?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          previous_hash?: string | null
          recorded_at?: string
          site_id?: string | null
          unit_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          event_data?: Json
          event_hash?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          previous_hash?: string | null
          recorded_at?: string
          site_id?: string | null
          unit_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      hubs: {
        Row: {
          created_at: string
          firmware_version: string | null
          id: string
          ip_address: string | null
          is_online: boolean
          last_seen_at: string | null
          mac_address: string | null
          name: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean
          last_seen_at?: string | null
          mac_address?: string | null
          name: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean
          last_seen_at?: string | null
          mac_address?: string | null
          name?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_sessions: {
        Row: {
          allowed_site_ids: string[] | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          organization_id: string
          token: string
        }
        Insert: {
          allowed_site_ids?: string[] | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id: string
          token?: string
        }
        Update: {
          allowed_site_ids?: string[] | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspector_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_pdf_url: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          stripe_invoice_id: string | null
          subscription_id: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          stripe_invoice_id?: string | null
          subscription_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_temperature_logs: {
        Row: {
          created_at: string
          id: string
          is_in_range: boolean | null
          logged_at: string
          logged_by: string
          notes: string | null
          photo_url: string | null
          temperature: number
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_in_range?: boolean | null
          logged_at?: string
          logged_by: string
          notes?: string | null
          photo_url?: string | null
          temperature: number
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_in_range?: boolean | null
          logged_at?: string
          logged_by?: string
          notes?: string | null
          photo_url?: string | null
          temperature?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_temperature_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          alert_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          user_id: string
        }
        Insert: {
          alert_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          user_id: string
        }
        Update: {
          alert_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          alert_id: string | null
          channel: string
          created_at: string
          event_type: string
          id: string
          organization_id: string
          provider_message_id: string | null
          reason: string | null
          site_id: string | null
          status: string
          to_recipients: Json
          unit_id: string | null
        }
        Insert: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          provider_message_id?: string | null
          reason?: string | null
          site_id?: string | null
          status: string
          to_recipients?: Json
          unit_id?: string | null
        }
        Update: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          provider_message_id?: string | null
          reason?: string | null
          site_id?: string | null
          status?: string
          to_recipients?: Json
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          notify_alarm_active: boolean
          notify_low_battery: boolean
          notify_manual_required: boolean
          notify_offline: boolean
          notify_temp_excursion: boolean
          notify_warnings: boolean
          organization_id: string
          recipients: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          notify_alarm_active?: boolean
          notify_low_battery?: boolean
          notify_manual_required?: boolean
          notify_offline?: boolean
          notify_temp_excursion?: boolean
          notify_warnings?: boolean
          organization_id: string
          recipients?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          notify_alarm_active?: boolean
          notify_low_battery?: boolean
          notify_manual_required?: boolean
          notify_offline?: boolean
          notify_temp_excursion?: boolean
          notify_warnings?: boolean
          organization_id?: string
          recipients?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          compliance_mode: Database["public"]["Enums"]["compliance_mode"]
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          compliance_mode?: Database["public"]["Enums"]["compliance_mode"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          compliance_mode?: Database["public"]["Enums"]["compliance_mode"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      pairing_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          device_id: string | null
          error_message: string | null
          expires_at: string
          hub_id: string
          id: string
          initiated_by: string
          started_at: string
          status: Database["public"]["Enums"]["pairing_status"]
          unit_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          error_message?: string | null
          expires_at?: string
          hub_id: string
          id?: string
          initiated_by: string
          started_at?: string
          status?: Database["public"]["Enums"]["pairing_status"]
          unit_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          error_message?: string | null
          expires_at?: string
          hub_id?: string
          id?: string
          initiated_by?: string
          started_at?: string
          status?: Database["public"]["Enums"]["pairing_status"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pairing_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairing_sessions_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairing_sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_feedback: {
        Row: {
          alert_fatigue_rating: number | null
          created_at: string
          id: string
          logging_speed_rating: number | null
          notes: string | null
          organization_id: string
          report_usefulness_rating: number | null
          site_id: string | null
          submitted_by: string
          week_start: string
        }
        Insert: {
          alert_fatigue_rating?: number | null
          created_at?: string
          id?: string
          logging_speed_rating?: number | null
          notes?: string | null
          organization_id: string
          report_usefulness_rating?: number | null
          site_id?: string | null
          submitted_by: string
          week_start: string
        }
        Update: {
          alert_fatigue_rating?: number | null
          created_at?: string
          id?: string
          logging_speed_rating?: number | null
          notes?: string | null
          organization_id?: string
          report_usefulness_rating?: number | null
          site_id?: string | null
          submitted_by?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_feedback_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notification_preferences: Json | null
          organization_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_readings: {
        Row: {
          battery_level: number | null
          device_id: string | null
          door_open: boolean | null
          humidity: number | null
          id: string
          received_at: string
          recorded_at: string
          signal_strength: number | null
          source: string | null
          temperature: number
          unit_id: string
        }
        Insert: {
          battery_level?: number | null
          device_id?: string | null
          door_open?: boolean | null
          humidity?: number | null
          id?: string
          received_at?: string
          recorded_at?: string
          signal_strength?: number | null
          source?: string | null
          temperature: number
          unit_id: string
        }
        Update: {
          battery_level?: number | null
          device_id?: string | null
          door_open?: boolean | null
          humidity?: number | null
          id?: string
          received_at?: string
          recorded_at?: string
          signal_strength?: number | null
          source?: string | null
          temperature?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      simulated_devices: {
        Row: {
          battery_level: number | null
          created_at: string | null
          created_by: string | null
          current_humidity: number | null
          current_temperature: number | null
          device_id: string | null
          door_cycle_closed_seconds: number | null
          door_cycle_enabled: boolean | null
          door_cycle_next_change_at: string | null
          door_cycle_open_seconds: number | null
          door_open_since: string | null
          door_sensor_present: boolean | null
          door_state: string | null
          id: string
          is_active: boolean | null
          last_heartbeat_at: string | null
          next_reading_at: string | null
          organization_id: string
          sensor_online: boolean | null
          sensor_paired: boolean | null
          signal_strength: number | null
          streaming_enabled: boolean | null
          streaming_interval_seconds: number | null
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          battery_level?: number | null
          created_at?: string | null
          created_by?: string | null
          current_humidity?: number | null
          current_temperature?: number | null
          device_id?: string | null
          door_cycle_closed_seconds?: number | null
          door_cycle_enabled?: boolean | null
          door_cycle_next_change_at?: string | null
          door_cycle_open_seconds?: number | null
          door_open_since?: string | null
          door_sensor_present?: boolean | null
          door_state?: string | null
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          next_reading_at?: string | null
          organization_id: string
          sensor_online?: boolean | null
          sensor_paired?: boolean | null
          signal_strength?: number | null
          streaming_enabled?: boolean | null
          streaming_interval_seconds?: number | null
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          battery_level?: number | null
          created_at?: string | null
          created_by?: string | null
          current_humidity?: number | null
          current_temperature?: number | null
          device_id?: string | null
          door_cycle_closed_seconds?: number | null
          door_cycle_enabled?: boolean | null
          door_cycle_next_change_at?: string | null
          door_cycle_open_seconds?: number | null
          door_open_since?: string | null
          door_sensor_present?: boolean | null
          door_state?: string | null
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          next_reading_at?: string | null
          organization_id?: string
          sensor_online?: boolean | null
          sensor_paired?: boolean | null
          signal_strength?: number | null
          streaming_enabled?: boolean | null
          streaming_interval_seconds?: number | null
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulated_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulated_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulated_devices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          city: string | null
          compliance_mode: string | null
          corrective_action_required: boolean | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          manual_log_cadence_seconds: number | null
          name: string
          organization_id: string
          postal_code: string | null
          state: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          compliance_mode?: string | null
          corrective_action_required?: boolean | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          manual_log_cadence_seconds?: number | null
          name: string
          organization_id: string
          postal_code?: string | null
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          compliance_mode?: string | null
          corrective_action_required?: boolean | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          manual_log_cadence_seconds?: number | null
          name?: string
          organization_id?: string
          postal_code?: string | null
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          current_sensor_count: number
          id: string
          organization_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          sensor_limit: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          current_sensor_count?: number
          id?: string
          organization_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          sensor_limit?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          current_sensor_count?: number
          id?: string
          organization_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          sensor_limit?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_settings_history: {
        Row: {
          changed_at: string
          changed_by: string
          changes: Json
          created_at: string
          id: string
          note: string | null
          unit_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          changes: Json
          created_at?: string
          id?: string
          note?: string | null
          unit_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          changes?: Json
          created_at?: string
          id?: string
          note?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_settings_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area_id: string
          checkin_interval_minutes: number | null
          confirm_time_door_closed: number
          confirm_time_door_open: number
          consecutive_checkins: number | null
          created_at: string
          door_last_changed_at: string | null
          door_open_grace_minutes: number | null
          door_sensor_enabled: boolean | null
          door_state: string | null
          id: string
          is_active: boolean
          last_checkin_at: string | null
          last_manual_log_at: string | null
          last_reading_at: string | null
          last_status_change: string | null
          last_temp_reading: number | null
          make: string | null
          manual_log_cadence: number
          manual_logging_enabled: boolean | null
          max_excursion_duration: number
          model: string | null
          name: string
          notes: string | null
          sensor_reliable: boolean | null
          serial_number: string | null
          status: Database["public"]["Enums"]["unit_status"]
          temp_hysteresis: number
          temp_limit_high: number
          temp_limit_low: number | null
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          area_id: string
          checkin_interval_minutes?: number | null
          confirm_time_door_closed?: number
          confirm_time_door_open?: number
          consecutive_checkins?: number | null
          created_at?: string
          door_last_changed_at?: string | null
          door_open_grace_minutes?: number | null
          door_sensor_enabled?: boolean | null
          door_state?: string | null
          id?: string
          is_active?: boolean
          last_checkin_at?: string | null
          last_manual_log_at?: string | null
          last_reading_at?: string | null
          last_status_change?: string | null
          last_temp_reading?: number | null
          make?: string | null
          manual_log_cadence?: number
          manual_logging_enabled?: boolean | null
          max_excursion_duration?: number
          model?: string | null
          name: string
          notes?: string | null
          sensor_reliable?: boolean | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["unit_status"]
          temp_hysteresis?: number
          temp_limit_high?: number
          temp_limit_low?: number | null
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          area_id?: string
          checkin_interval_minutes?: number | null
          confirm_time_door_closed?: number
          confirm_time_door_open?: number
          consecutive_checkins?: number | null
          created_at?: string
          door_last_changed_at?: string | null
          door_open_grace_minutes?: number | null
          door_sensor_enabled?: boolean | null
          door_state?: string | null
          id?: string
          is_active?: boolean
          last_checkin_at?: string | null
          last_manual_log_at?: string | null
          last_reading_at?: string | null
          last_status_change?: string | null
          last_temp_reading?: number | null
          make?: string | null
          manual_log_cadence?: number
          manual_logging_enabled?: boolean | null
          max_excursion_duration?: number
          model?: string | null
          name?: string
          notes?: string | null
          sensor_reliable?: boolean | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["unit_status"]
          temp_hysteresis?: number
          temp_limit_high?: number
          temp_limit_low?: number | null
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_all_audit_logs: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_contact_details: {
        Args: { _target_org_id: string; _viewer_id: string }
        Returns: boolean
      }
      create_area_for_site: {
        Args: { p_description?: string; p_name: string; p_site_id: string }
        Returns: string
      }
      create_organization_with_owner: {
        Args: {
          p_compliance_mode?: Database["public"]["Enums"]["compliance_mode"]
          p_name: string
          p_slug: string
          p_timezone?: string
        }
        Returns: string
      }
      create_site_for_org: {
        Args: {
          p_address?: string
          p_city?: string
          p_name: string
          p_postal_code?: string
          p_state?: string
          p_timezone?: string
        }
        Returns: string
      }
      create_unit_for_area: {
        Args: {
          p_area_id: string
          p_name: string
          p_temp_limit_high?: number
          p_temp_limit_low?: number
          p_unit_type?: Database["public"]["Enums"]["unit_type"]
        }
        Returns: string
      }
      get_effective_alert_rules: { Args: { p_unit_id: string }; Returns: Json }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      alert_status: "active" | "acknowledged" | "resolved" | "escalated"
      alert_type:
        | "alarm_active"
        | "monitoring_interrupted"
        | "missed_manual_entry"
        | "low_battery"
        | "sensor_fault"
        | "door_open"
        | "calibration_due"
        | "suspected_cooling_failure"
        | "temp_excursion"
      app_role: "owner" | "admin" | "manager" | "staff" | "viewer" | "inspector"
      compliance_mode: "standard" | "haccp"
      device_status: "active" | "inactive" | "pairing" | "fault" | "low_battery"
      notification_channel: "push" | "email" | "sms"
      notification_status: "pending" | "sent" | "delivered" | "failed"
      pairing_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "failed"
        | "expired"
      subscription_plan: "starter" | "pro" | "haccp" | "enterprise"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
      unit_status:
        | "ok"
        | "excursion"
        | "alarm_active"
        | "monitoring_interrupted"
        | "manual_required"
        | "restoring"
        | "offline"
      unit_type:
        | "fridge"
        | "freezer"
        | "display_case"
        | "walk_in_cooler"
        | "walk_in_freezer"
        | "blast_chiller"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "warning", "critical"],
      alert_status: ["active", "acknowledged", "resolved", "escalated"],
      alert_type: [
        "alarm_active",
        "monitoring_interrupted",
        "missed_manual_entry",
        "low_battery",
        "sensor_fault",
        "door_open",
        "calibration_due",
        "suspected_cooling_failure",
        "temp_excursion",
      ],
      app_role: ["owner", "admin", "manager", "staff", "viewer", "inspector"],
      compliance_mode: ["standard", "haccp"],
      device_status: ["active", "inactive", "pairing", "fault", "low_battery"],
      notification_channel: ["push", "email", "sms"],
      notification_status: ["pending", "sent", "delivered", "failed"],
      pairing_status: [
        "pending",
        "in_progress",
        "completed",
        "failed",
        "expired",
      ],
      subscription_plan: ["starter", "pro", "haccp", "enterprise"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
      unit_status: [
        "ok",
        "excursion",
        "alarm_active",
        "monitoring_interrupted",
        "manual_required",
        "restoring",
        "offline",
      ],
      unit_type: [
        "fridge",
        "freezer",
        "display_case",
        "walk_in_cooler",
        "walk_in_freezer",
        "blast_chiller",
      ],
    },
  },
} as const
