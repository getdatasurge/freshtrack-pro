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
      account_deletion_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          deleted_user_email: string | null
          error_message: string | null
          id: string
          org_deleted: boolean | null
          org_had_other_users: boolean | null
          organization_id: string | null
          request_id: string | null
          status: string
          steps_completed: Json | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          deleted_user_email?: string | null
          error_message?: string | null
          id?: string
          org_deleted?: boolean | null
          org_had_other_users?: boolean | null
          organization_id?: string | null
          request_id?: string | null
          status?: string
          steps_completed?: Json | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          deleted_user_email?: string | null
          error_message?: string | null
          id?: string
          org_deleted?: boolean | null
          org_had_other_users?: boolean | null
          organization_id?: string | null
          request_id?: string | null
          status?: string
          steps_completed?: Json | null
          user_id?: string
        }
        Relationships: []
      }
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
          ack_required: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledgment_notes: string | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          area_id: string | null
          created_at: string
          escalation_level: number
          escalation_steps_sent: Json | null
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
          ack_required?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgment_notes?: string | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          area_id?: string | null
          created_at?: string
          escalation_level?: number
          escalation_steps_sent?: Json | null
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
          ack_required?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledgment_notes?: string | null
          alert_type?: Database["public"]["Enums"]["alert_type"]
          area_id?: string | null
          created_at?: string
          escalation_level?: number
          escalation_steps_sent?: Json | null
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
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          site_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          site_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
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
          performed_by: string | null
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
          performed_by?: string | null
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
          performed_by?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          firmware_version: string | null
          hub_id: string | null
          id: string
          last_calibrated_at: string | null
          last_seen_at: string | null
          mac_address: string | null
          organization_id: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          firmware_version?: string | null
          hub_id?: string | null
          id?: string
          last_calibrated_at?: string | null
          last_seen_at?: string | null
          mac_address?: string | null
          organization_id?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          firmware_version?: string | null
          hub_id?: string | null
          id?: string
          last_calibrated_at?: string | null
          last_seen_at?: string | null
          mac_address?: string | null
          organization_id?: string | null
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
            foreignKeyName: "devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      emulator_sync_runs: {
        Row: {
          counts: Json
          created_at: string
          errors: Json
          id: string
          organization_id: string
          payload_summary: Json | null
          processed_at: string
          status: string
          sync_id: string | null
          synced_at: string
          warnings: Json
        }
        Insert: {
          counts?: Json
          created_at?: string
          errors?: Json
          id?: string
          organization_id: string
          payload_summary?: Json | null
          processed_at?: string
          status?: string
          sync_id?: string | null
          synced_at: string
          warnings?: Json
        }
        Update: {
          counts?: Json
          created_at?: string
          errors?: Json
          id?: string
          organization_id?: string
          payload_summary?: Json | null
          processed_at?: string
          status?: string
          sync_id?: string | null
          synced_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "emulator_sync_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_dashboard_layouts: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_user_default: boolean | null
          layout_json: Json
          layout_version: number | null
          name: string
          organization_id: string
          slot_number: number
          timeline_state_json: Json | null
          updated_at: string
          user_id: string
          widget_prefs_json: Json | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_user_default?: boolean | null
          layout_json?: Json
          layout_version?: number | null
          name: string
          organization_id: string
          slot_number: number
          timeline_state_json?: Json | null
          updated_at?: string
          user_id: string
          widget_prefs_json?: Json | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_user_default?: boolean | null
          layout_json?: Json
          layout_version?: number | null
          name?: string
          organization_id?: string
          slot_number?: number
          timeline_state_json?: Json | null
          updated_at?: string
          user_id?: string
          widget_prefs_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_dashboard_layouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          acting_user_id: string | null
          actor_id: string | null
          actor_type: string | null
          area_id: string | null
          category: string | null
          event_data: Json
          event_hash: string | null
          event_type: string
          id: string
          impersonation_session_id: string | null
          ip_address: string | null
          organization_id: string
          previous_hash: string | null
          recorded_at: string
          severity: string | null
          site_id: string | null
          title: string | null
          unit_id: string | null
          user_agent: string | null
          was_impersonated: boolean | null
        }
        Insert: {
          acting_user_id?: string | null
          actor_id?: string | null
          actor_type?: string | null
          area_id?: string | null
          category?: string | null
          event_data?: Json
          event_hash?: string | null
          event_type: string
          id?: string
          impersonation_session_id?: string | null
          ip_address?: string | null
          organization_id: string
          previous_hash?: string | null
          recorded_at?: string
          severity?: string | null
          site_id?: string | null
          title?: string | null
          unit_id?: string | null
          user_agent?: string | null
          was_impersonated?: boolean | null
        }
        Update: {
          acting_user_id?: string | null
          actor_id?: string | null
          actor_type?: string | null
          area_id?: string | null
          category?: string | null
          event_data?: Json
          event_hash?: string | null
          event_type?: string
          id?: string
          impersonation_session_id?: string | null
          ip_address?: string | null
          organization_id?: string
          previous_hash?: string | null
          recorded_at?: string
          severity?: string | null
          site_id?: string | null
          title?: string | null
          unit_id?: string | null
          user_agent?: string | null
          was_impersonated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
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
      gateways: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gateway_eui: string
          id: string
          last_seen_at: string | null
          name: string
          organization_id: string
          site_id: string | null
          status: Database["public"]["Enums"]["gateway_status"]
          ttn_application_id: string | null
          ttn_gateway_id: string | null
          ttn_last_error: string | null
          ttn_registered_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gateway_eui: string
          id?: string
          last_seen_at?: string | null
          name: string
          organization_id: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["gateway_status"]
          ttn_application_id?: string | null
          ttn_gateway_id?: string | null
          ttn_last_error?: string | null
          ttn_registered_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gateway_eui?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          organization_id?: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["gateway_status"]
          ttn_application_id?: string | null
          ttn_gateway_id?: string | null
          ttn_last_error?: string | null
          ttn_registered_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateways_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateways_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          started_at: string
          status: string
          target_org_id: string
          target_org_name: string | null
          target_user_email: string | null
          target_user_id: string
          target_user_name: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          target_org_id: string
          target_org_name?: string | null
          target_user_email?: string | null
          target_user_id: string
          target_user_name?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          target_org_id?: string
          target_org_name?: string | null
          target_user_email?: string | null
          target_user_id?: string
          target_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      lora_sensors: {
        Row: {
          app_eui: string | null
          app_key: string | null
          battery_level: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          dev_eui: string
          firmware_version: string | null
          id: string
          is_primary: boolean
          last_join_at: string | null
          last_provision_check_at: string | null
          last_provision_check_error: string | null
          last_seen_at: string | null
          manufacturer: string | null
          model: string | null
          name: string
          organization_id: string
          provisioned_source: string | null
          provisioning_state: string
          sensor_type: Database["public"]["Enums"]["lora_sensor_type"]
          signal_strength: number | null
          site_id: string | null
          status: Database["public"]["Enums"]["lora_sensor_status"]
          ttn_application_id: string | null
          ttn_cluster: string | null
          ttn_device_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          app_eui?: string | null
          app_key?: string | null
          battery_level?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          dev_eui: string
          firmware_version?: string | null
          id?: string
          is_primary?: boolean
          last_join_at?: string | null
          last_provision_check_at?: string | null
          last_provision_check_error?: string | null
          last_seen_at?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          organization_id: string
          provisioned_source?: string | null
          provisioning_state?: string
          sensor_type?: Database["public"]["Enums"]["lora_sensor_type"]
          signal_strength?: number | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["lora_sensor_status"]
          ttn_application_id?: string | null
          ttn_cluster?: string | null
          ttn_device_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          app_eui?: string | null
          app_key?: string | null
          battery_level?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          dev_eui?: string
          firmware_version?: string | null
          id?: string
          is_primary?: boolean
          last_join_at?: string | null
          last_provision_check_at?: string | null
          last_provision_check_error?: string | null
          last_seen_at?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          organization_id?: string
          provisioned_source?: string | null
          provisioning_state?: string
          sensor_type?: Database["public"]["Enums"]["lora_sensor_type"]
          signal_strength?: number | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["lora_sensor_status"]
          ttn_application_id?: string | null
          ttn_cluster?: string | null
          ttn_device_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lora_sensors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lora_sensors_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lora_sensors_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
          logged_by: string | null
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
          logged_by?: string | null
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
          logged_by?: string | null
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
          dismissed_at: string | null
          escalation_step_index: number | null
          event_type: string
          id: string
          organization_id: string
          provider_message_id: string | null
          read_at: string | null
          reason: string | null
          site_id: string | null
          status: string
          to_recipients: Json
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          dismissed_at?: string | null
          escalation_step_index?: number | null
          event_type: string
          id?: string
          organization_id: string
          provider_message_id?: string | null
          read_at?: string | null
          reason?: string | null
          site_id?: string | null
          status: string
          to_recipients?: Json
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          dismissed_at?: string | null
          escalation_step_index?: number | null
          event_type?: string
          id?: string
          organization_id?: string
          provider_message_id?: string | null
          read_at?: string | null
          reason?: string | null
          site_id?: string | null
          status?: string
          to_recipients?: Json
          unit_id?: string | null
          user_id?: string | null
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
      notification_policies: {
        Row: {
          ack_deadline_minutes: number | null
          alert_type: string
          allow_warning_notifications: boolean
          created_at: string
          escalation_steps: Json
          id: string
          initial_channels: string[]
          notify_assigned_users: boolean | null
          notify_roles: string[] | null
          notify_site_managers: boolean | null
          organization_id: string | null
          quiet_hours_enabled: boolean
          quiet_hours_end_local: string | null
          quiet_hours_start_local: string | null
          reminder_interval_minutes: number | null
          reminders_enabled: boolean
          requires_ack: boolean
          send_resolved_notifications: boolean
          severity_threshold: string
          site_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          ack_deadline_minutes?: number | null
          alert_type: string
          allow_warning_notifications?: boolean
          created_at?: string
          escalation_steps?: Json
          id?: string
          initial_channels?: string[]
          notify_assigned_users?: boolean | null
          notify_roles?: string[] | null
          notify_site_managers?: boolean | null
          organization_id?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end_local?: string | null
          quiet_hours_start_local?: string | null
          reminder_interval_minutes?: number | null
          reminders_enabled?: boolean
          requires_ack?: boolean
          send_resolved_notifications?: boolean
          severity_threshold?: string
          site_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          ack_deadline_minutes?: number | null
          alert_type?: string
          allow_warning_notifications?: boolean
          created_at?: string
          escalation_steps?: Json
          id?: string
          initial_channels?: string[]
          notify_assigned_users?: boolean | null
          notify_roles?: string[] | null
          notify_site_managers?: boolean | null
          organization_id?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end_local?: string | null
          quiet_hours_start_local?: string | null
          reminder_interval_minutes?: number | null
          reminders_enabled?: boolean
          requires_ack?: boolean
          send_resolved_notifications?: boolean
          severity_threshold?: string
          site_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_policies_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_policies_unit_id_fkey"
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
      org_cleanup_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          dependent_counts: Json | null
          id: string
          last_error: string | null
          organization_id: string
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dependent_counts?: Json | null
          id?: string
          last_error?: string | null
          organization_id: string
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dependent_counts?: Json | null
          id?: string
          last_error?: string | null
          organization_id?: string
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_cleanup_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_sync_state: {
        Row: {
          is_dirty: boolean
          last_change_at: string
          last_synced_at: string | null
          last_synced_version: number | null
          organization_id: string
          sync_version: number
        }
        Insert: {
          is_dirty?: boolean
          last_change_at?: string
          last_synced_at?: string | null
          last_synced_version?: number | null
          organization_id: string
          sync_version?: number
        }
        Update: {
          is_dirty?: boolean
          last_change_at?: string
          last_synced_at?: string | null
          last_synced_version?: number | null
          organization_id?: string
          sync_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_sync_state_organization_id_fkey"
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
          deleted_at: string | null
          deleted_by: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          timezone: string
          ttn_application_created: boolean | null
          ttn_application_id: string | null
          ttn_webhook_configured: boolean | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          compliance_mode?: Database["public"]["Enums"]["compliance_mode"]
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
          ttn_application_created?: boolean | null
          ttn_application_id?: string | null
          ttn_webhook_configured?: boolean | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          compliance_mode?: Database["public"]["Enums"]["compliance_mode"]
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
          ttn_application_created?: boolean | null
          ttn_application_id?: string | null
          ttn_webhook_configured?: boolean | null
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
          initiated_by: string | null
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
          initiated_by?: string | null
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
          initiated_by?: string | null
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
      platform_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
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
          site_id: string | null
          unit_id: string | null
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
          site_id?: string | null
          unit_id?: string | null
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
          site_id?: string | null
          unit_id?: string | null
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
          {
            foreignKeyName: "profiles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_cleanup_queue: {
        Row: {
          created_at: string | null
          deleted_user_id: string
          dev_eui: string
          error_message: string | null
          id: string
          organization_id: string
          processed_at: string | null
          sensor_id: string
          sensor_name: string
          ttn_application_id: string | null
          ttn_device_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_user_id: string
          dev_eui: string
          error_message?: string | null
          id?: string
          organization_id: string
          processed_at?: string | null
          sensor_id: string
          sensor_name: string
          ttn_application_id?: string | null
          ttn_device_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_user_id?: string
          dev_eui?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          processed_at?: string | null
          sensor_id?: string
          sensor_name?: string
          ttn_application_id?: string | null
          ttn_device_id?: string | null
        }
        Relationships: []
      }
      sensor_dashboard_layouts_archived: {
        Row: {
          created_at: string
          id: string
          is_user_default: boolean | null
          layout_json: Json
          layout_version: number | null
          name: string
          organization_id: string
          sensor_id: string
          timeline_state_json: Json | null
          updated_at: string
          user_id: string
          widget_prefs_json: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_user_default?: boolean | null
          layout_json?: Json
          layout_version?: number | null
          name: string
          organization_id: string
          sensor_id: string
          timeline_state_json?: Json | null
          updated_at?: string
          user_id: string
          widget_prefs_json?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          is_user_default?: boolean | null
          layout_json?: Json
          layout_version?: number | null
          name?: string
          organization_id?: string
          sensor_id?: string
          timeline_state_json?: Json | null
          updated_at?: string
          user_id?: string
          widget_prefs_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_dashboard_layouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_dashboard_layouts_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "lora_sensors"
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
          lora_sensor_id: string | null
          received_at: string
          recorded_at: string
          signal_strength: number | null
          source: string | null
          temperature: number | null
          unit_id: string
        }
        Insert: {
          battery_level?: number | null
          device_id?: string | null
          door_open?: boolean | null
          humidity?: number | null
          id?: string
          lora_sensor_id?: string | null
          received_at?: string
          recorded_at?: string
          signal_strength?: number | null
          source?: string | null
          temperature?: number | null
          unit_id: string
        }
        Update: {
          battery_level?: number | null
          device_id?: string | null
          door_open?: boolean | null
          humidity?: number | null
          id?: string
          lora_sensor_id?: string | null
          received_at?: string
          recorded_at?: string
          signal_strength?: number | null
          source?: string | null
          temperature?: number | null
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
            foreignKeyName: "sensor_readings_lora_sensor_id_fkey"
            columns: ["lora_sensor_id"]
            isOneToOne: false
            referencedRelation: "lora_sensors"
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      sms_alert_log: {
        Row: {
          alert_id: string | null
          alert_type: string
          created_at: string
          delivery_updated_at: string | null
          error_message: string | null
          from_number: string | null
          id: string
          message: string
          organization_id: string
          phone_number: string
          provider_message_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          alert_id?: string | null
          alert_type: string
          created_at?: string
          delivery_updated_at?: string | null
          error_message?: string | null
          from_number?: string | null
          id?: string
          message: string
          organization_id: string
          phone_number: string
          provider_message_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          alert_id?: string | null
          alert_type?: string
          created_at?: string
          delivery_updated_at?: string | null
          error_message?: string | null
          from_number?: string | null
          id?: string
          message?: string
          organization_id?: string
          phone_number?: string
          provider_message_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_alert_log_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_alert_log_organization_id_fkey"
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
      super_admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          impersonated_user_id: string | null
          ip_address: unknown
          target_id: string | null
          target_org_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          impersonated_user_id?: string | null
          ip_address?: unknown
          target_id?: string | null
          target_org_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          impersonated_user_id?: string | null
          ip_address?: unknown
          target_id?: string | null
          target_org_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      telnyx_webhook_config: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_event_at: string | null
          organization_id: string | null
          status: string
          updated_at: string
          webhook_id: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_event_at?: string | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_event_at?: string | null
          organization_id?: string | null
          status?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "telnyx_webhook_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telnyx_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          message_id: string | null
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          message_id?: string | null
          payload?: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          message_id?: string | null
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
      ttn_connections: {
        Row: {
          app_rights_check_status: string | null
          cluster_lock: string | null
          created_at: string | null
          created_by: string | null
          credentials_last_rotated_at: string | null
          credentials_rotation_count: number | null
          id: string
          is_enabled: boolean | null
          last_connection_test_at: string | null
          last_connection_test_result: Json | null
          last_http_body: string | null
          last_http_status: number | null
          last_provisioning_attempt_at: string | null
          last_ttn_correlation_id: string | null
          last_ttn_error_name: string | null
          last_ttn_error_namespace: string | null
          last_ttn_http_status: number | null
          organization_id: string
          provisioning_attempt_count: number
          provisioning_attempts: number | null
          provisioning_can_retry: boolean | null
          provisioning_error: string | null
          provisioning_last_heartbeat_at: string | null
          provisioning_last_step: string | null
          provisioning_started_at: string | null
          provisioning_status: string | null
          provisioning_step: string | null
          provisioning_step_details: Json | null
          ttn_api_key_encrypted: string | null
          ttn_api_key_id: string | null
          ttn_api_key_last4: string | null
          ttn_api_key_updated_at: string | null
          ttn_application_id: string | null
          ttn_application_name: string | null
          ttn_application_provisioned_at: string | null
          ttn_application_uid: string | null
          ttn_credential_type: string | null
          ttn_gateway_rights_checked_at: string | null
          ttn_gateway_rights_verified: boolean | null
          ttn_identity_server_url: string | null
          ttn_last_test_source: string | null
          ttn_last_updated_source: string | null
          ttn_org_api_key_encrypted: string | null
          ttn_org_api_key_id: string | null
          ttn_org_api_key_last4: string | null
          ttn_org_api_key_updated_at: string | null
          ttn_owner_scope: string | null
          ttn_region: string | null
          ttn_stack_base_url: string | null
          ttn_user_id: string | null
          ttn_webhook_events: string[] | null
          ttn_webhook_id: string | null
          ttn_webhook_last_updated_at: string | null
          ttn_webhook_last_updated_by: string | null
          ttn_webhook_secret_encrypted: string | null
          ttn_webhook_secret_last4: string | null
          ttn_webhook_url: string | null
          tts_base_url: string | null
          tts_org_admin_added: boolean | null
          tts_org_provisioned_at: string | null
          tts_org_provisioning_status: string | null
          tts_organization_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          app_rights_check_status?: string | null
          cluster_lock?: string | null
          created_at?: string | null
          created_by?: string | null
          credentials_last_rotated_at?: string | null
          credentials_rotation_count?: number | null
          id?: string
          is_enabled?: boolean | null
          last_connection_test_at?: string | null
          last_connection_test_result?: Json | null
          last_http_body?: string | null
          last_http_status?: number | null
          last_provisioning_attempt_at?: string | null
          last_ttn_correlation_id?: string | null
          last_ttn_error_name?: string | null
          last_ttn_error_namespace?: string | null
          last_ttn_http_status?: number | null
          organization_id: string
          provisioning_attempt_count?: number
          provisioning_attempts?: number | null
          provisioning_can_retry?: boolean | null
          provisioning_error?: string | null
          provisioning_last_heartbeat_at?: string | null
          provisioning_last_step?: string | null
          provisioning_started_at?: string | null
          provisioning_status?: string | null
          provisioning_step?: string | null
          provisioning_step_details?: Json | null
          ttn_api_key_encrypted?: string | null
          ttn_api_key_id?: string | null
          ttn_api_key_last4?: string | null
          ttn_api_key_updated_at?: string | null
          ttn_application_id?: string | null
          ttn_application_name?: string | null
          ttn_application_provisioned_at?: string | null
          ttn_application_uid?: string | null
          ttn_credential_type?: string | null
          ttn_gateway_rights_checked_at?: string | null
          ttn_gateway_rights_verified?: boolean | null
          ttn_identity_server_url?: string | null
          ttn_last_test_source?: string | null
          ttn_last_updated_source?: string | null
          ttn_org_api_key_encrypted?: string | null
          ttn_org_api_key_id?: string | null
          ttn_org_api_key_last4?: string | null
          ttn_org_api_key_updated_at?: string | null
          ttn_owner_scope?: string | null
          ttn_region?: string | null
          ttn_stack_base_url?: string | null
          ttn_user_id?: string | null
          ttn_webhook_events?: string[] | null
          ttn_webhook_id?: string | null
          ttn_webhook_last_updated_at?: string | null
          ttn_webhook_last_updated_by?: string | null
          ttn_webhook_secret_encrypted?: string | null
          ttn_webhook_secret_last4?: string | null
          ttn_webhook_url?: string | null
          tts_base_url?: string | null
          tts_org_admin_added?: boolean | null
          tts_org_provisioned_at?: string | null
          tts_org_provisioning_status?: string | null
          tts_organization_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          app_rights_check_status?: string | null
          cluster_lock?: string | null
          created_at?: string | null
          created_by?: string | null
          credentials_last_rotated_at?: string | null
          credentials_rotation_count?: number | null
          id?: string
          is_enabled?: boolean | null
          last_connection_test_at?: string | null
          last_connection_test_result?: Json | null
          last_http_body?: string | null
          last_http_status?: number | null
          last_provisioning_attempt_at?: string | null
          last_ttn_correlation_id?: string | null
          last_ttn_error_name?: string | null
          last_ttn_error_namespace?: string | null
          last_ttn_http_status?: number | null
          organization_id?: string
          provisioning_attempt_count?: number
          provisioning_attempts?: number | null
          provisioning_can_retry?: boolean | null
          provisioning_error?: string | null
          provisioning_last_heartbeat_at?: string | null
          provisioning_last_step?: string | null
          provisioning_started_at?: string | null
          provisioning_status?: string | null
          provisioning_step?: string | null
          provisioning_step_details?: Json | null
          ttn_api_key_encrypted?: string | null
          ttn_api_key_id?: string | null
          ttn_api_key_last4?: string | null
          ttn_api_key_updated_at?: string | null
          ttn_application_id?: string | null
          ttn_application_name?: string | null
          ttn_application_provisioned_at?: string | null
          ttn_application_uid?: string | null
          ttn_credential_type?: string | null
          ttn_gateway_rights_checked_at?: string | null
          ttn_gateway_rights_verified?: boolean | null
          ttn_identity_server_url?: string | null
          ttn_last_test_source?: string | null
          ttn_last_updated_source?: string | null
          ttn_org_api_key_encrypted?: string | null
          ttn_org_api_key_id?: string | null
          ttn_org_api_key_last4?: string | null
          ttn_org_api_key_updated_at?: string | null
          ttn_owner_scope?: string | null
          ttn_region?: string | null
          ttn_stack_base_url?: string | null
          ttn_user_id?: string | null
          ttn_webhook_events?: string[] | null
          ttn_webhook_id?: string | null
          ttn_webhook_last_updated_at?: string | null
          ttn_webhook_last_updated_by?: string | null
          ttn_webhook_secret_encrypted?: string | null
          ttn_webhook_secret_last4?: string | null
          ttn_webhook_url?: string | null
          tts_base_url?: string | null
          tts_org_admin_added?: boolean | null
          tts_org_provisioned_at?: string | null
          tts_org_provisioning_status?: string | null
          tts_organization_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ttn_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ttn_deprovision_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          dev_eui: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_error_payload: Json | null
          max_attempts: number
          next_retry_at: string | null
          organization_id: string
          reason: string
          sensor_id: string | null
          sensor_name: string | null
          site_id: string | null
          status: string
          ttn_application_id: string
          ttn_device_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dev_eui: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_error_payload?: Json | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id: string
          reason: string
          sensor_id?: string | null
          sensor_name?: string | null
          site_id?: string | null
          status?: string
          ttn_application_id: string
          ttn_device_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          dev_eui?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_error_payload?: Json | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string
          reason?: string
          sensor_id?: string | null
          sensor_name?: string | null
          site_id?: string | null
          status?: string
          ttn_application_id?: string
          ttn_device_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ttn_deprovision_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ttn_provisioning_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_category: string | null
          id: string
          message: string | null
          organization_id: string
          payload: Json | null
          request_id: string | null
          status: string
          step: string
          ttn_endpoint: string | null
          ttn_http_status: number | null
          ttn_response_body: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_category?: string | null
          id?: string
          message?: string | null
          organization_id: string
          payload?: Json | null
          request_id?: string | null
          status: string
          step: string
          ttn_endpoint?: string | null
          ttn_http_status?: number | null
          ttn_response_body?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_category?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          payload?: Json | null
          request_id?: string | null
          status?: string
          step?: string
          ttn_endpoint?: string | null
          ttn_http_status?: number | null
          ttn_response_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ttn_provisioning_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ttn_provisioning_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          completed_steps: string[] | null
          created_at: string
          current_step: string | null
          error_code: string | null
          id: string
          last_error: string | null
          last_error_at: string | null
          max_attempts: number
          next_retry_at: string | null
          organization_id: string
          priority: number
          started_at: string | null
          status: string
          trigger_reason: string | null
          triggered_by: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          completed_steps?: string[] | null
          created_at?: string
          current_step?: string | null
          error_code?: string | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id: string
          priority?: number
          started_at?: string | null
          status?: string
          trigger_reason?: string | null
          triggered_by?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          completed_steps?: string[] | null
          created_at?: string
          current_step?: string | null
          error_code?: string | null
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string
          priority?: number
          started_at?: string | null
          status?: string
          trigger_reason?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ttn_provisioning_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_dashboard_layouts: {
        Row: {
          created_at: string
          id: string
          is_user_default: boolean | null
          layout_json: Json
          name: string
          organization_id: string
          shared_with_roles: Database["public"]["Enums"]["app_role"][] | null
          timeline_state_json: Json | null
          unit_id: string
          updated_at: string
          user_id: string
          visibility: string | null
          widget_prefs_json: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_user_default?: boolean | null
          layout_json?: Json
          name: string
          organization_id: string
          shared_with_roles?: Database["public"]["Enums"]["app_role"][] | null
          timeline_state_json?: Json | null
          unit_id: string
          updated_at?: string
          user_id: string
          visibility?: string | null
          widget_prefs_json?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          is_user_default?: boolean | null
          layout_json?: Json
          name?: string
          organization_id?: string
          shared_with_roles?: Database["public"]["Enums"]["app_role"][] | null
          timeline_state_json?: Json | null
          unit_id?: string
          updated_at?: string
          user_id?: string
          visibility?: string | null
          widget_prefs_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_dashboard_layouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_dashboard_layouts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      user_sync_log: {
        Row: {
          attempts: number | null
          created_at: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_annotations: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_all_audit_logs: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_contact_details: {
        Args: { _target_org_id: string; _viewer_id: string }
        Returns: boolean
      }
      check_impersonation_org_match: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      check_org_dirty: { Args: { p_org_id: string }; Returns: Json }
      check_slug_available:
        | { Args: { p_slug: string }; Returns: boolean }
        | {
            Args: { p_exclude_org_id?: string; p_slug: string }
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
        Returns: Json
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
      delete_user_account: { Args: { p_user_id: string }; Returns: Json }
      enqueue_deprovision_jobs_for_unit: {
        Args: { p_created_by?: string; p_reason: string; p_unit_id: string }
        Returns: number
      }
      expire_all_admin_impersonation_sessions: { Args: never; Returns: number }
      find_orphan_organizations: {
        Args: never
        Returns: {
          alerts_count: number
          areas_count: number
          event_logs_count: number
          gateways_count: number
          has_subscription: boolean
          org_created_at: string
          org_id: string
          org_name: string
          org_slug: string
          sensors_count: number
          sites_count: number
          units_count: number
        }[]
      }
      get_active_impersonation: {
        Args: never
        Returns: {
          expires_at: string
          session_id: string
          started_at: string
          target_org_id: string
          target_org_name: string
          target_user_email: string
          target_user_id: string
          target_user_name: string
        }[]
      }
      get_deprovision_job_stats: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_effective_alert_rules: { Args: { p_unit_id: string }; Returns: Json }
      get_effective_notification_policy: {
        Args: { p_alert_type: string; p_unit_id: string }
        Returns: Json
      }
      get_next_tts_provisioning_job: {
        Args: never
        Returns: {
          attempts: number
          current_step: string
          id: string
          org_name: string
          org_slug: string
          organization_id: string
        }[]
      }
      get_org_sync_payload: { Args: { p_org_id: string }; Returns: Json }
      get_platform_organization_stats: {
        Args: never
        Returns: {
          org_id: string
          site_count: number
          user_count: number
        }[]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      hard_delete_organization: { Args: { p_org_id: string }; Returns: Json }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_current_user_super_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: { check_user_id: string }; Returns: boolean }
      log_impersonated_action: {
        Args: {
          p_area_id?: string
          p_category?: string
          p_event_data?: Json
          p_event_type: string
          p_organization_id?: string
          p_severity?: string
          p_site_id?: string
          p_title?: string
          p_unit_id?: string
        }
        Returns: string
      }
      log_super_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_impersonated_user_id?: string
          p_target_id?: string
          p_target_org_id?: string
          p_target_type?: string
        }
        Returns: string
      }
      process_sensor_cleanup_queue: { Args: never; Returns: Json }
      soft_delete_organization: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      start_impersonation: {
        Args: {
          p_duration_minutes?: number
          p_target_org_id: string
          p_target_user_id: string
        }
        Returns: Json
      }
      stop_impersonation: { Args: never; Returns: undefined }
      update_tts_provisioning_job: {
        Args: {
          p_completed_steps?: string[]
          p_current_step?: string
          p_error?: string
          p_error_code?: string
          p_job_id: string
          p_status: string
        }
        Returns: undefined
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      watchdog_fail_stale_ttn_provisioning: { Args: never; Returns: number }
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
      gateway_status: "pending" | "online" | "offline" | "maintenance"
      lora_sensor_status: "pending" | "joining" | "active" | "offline" | "fault"
      lora_sensor_type:
        | "temperature"
        | "temperature_humidity"
        | "door"
        | "combo"
        | "contact"
        | "motion"
        | "leak"
        | "metering"
        | "gps"
        | "air_quality"
        | "multi_sensor"
      notification_channel: "push" | "email" | "sms"
      notification_status: "pending" | "sent" | "delivered" | "failed"
      pairing_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "failed"
        | "expired"
      platform_role: "SUPER_ADMIN"
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
      gateway_status: ["pending", "online", "offline", "maintenance"],
      lora_sensor_status: ["pending", "joining", "active", "offline", "fault"],
      lora_sensor_type: [
        "temperature",
        "temperature_humidity",
        "door",
        "combo",
        "contact",
        "motion",
        "leak",
        "metering",
        "gps",
        "air_quality",
        "multi_sensor",
      ],
      notification_channel: ["push", "email", "sms"],
      notification_status: ["pending", "sent", "delivered", "failed"],
      pairing_status: [
        "pending",
        "in_progress",
        "completed",
        "failed",
        "expired",
      ],
      platform_role: ["SUPER_ADMIN"],
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
