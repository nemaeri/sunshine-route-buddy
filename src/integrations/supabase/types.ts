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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          target_class_id: string | null
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_class_id?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_class_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores: {
        Row: {
          assessment_id: string
          comment: string | null
          created_at: string
          id: string
          performance_level: string | null
          recorded_by: string | null
          score: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          comment?: string | null
          created_at?: string
          id?: string
          performance_level?: string | null
          recorded_by?: string | null
          score?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          performance_level?: string | null
          recorded_by?: string | null
          score?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          assessment_date: string
          assessment_type: string
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          max_score: number
          name: string
          subject_id: string
          term_id: string
        }
        Insert: {
          assessment_date?: string
          assessment_type?: string
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_score?: number
          name: string
          subject_id: string
          term_id: string
        }
        Update: {
          assessment_date?: string
          assessment_type?: string
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_score?: number
          name?: string
          subject_id?: string
          term_id?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_positions: {
        Row: {
          assignment_id: string
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed_kph: number | null
        }
        Insert: {
          assignment_id: string
          heading?: number | null
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          speed_kph?: number | null
        }
        Update: {
          assignment_id?: string
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_positions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "route_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: number
          class_teacher_id: string | null
          created_at: string
          grade_level: string
          id: string
          name: string
          stream: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: number
          class_teacher_id?: string | null
          created_at?: string
          grade_level: string
          id?: string
          name: string
          stream?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          class_teacher_id?: string | null
          created_at?: string
          grade_level?: string
          id?: string
          name?: string
          stream?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fee_items: {
        Row: {
          amount: number
          applies_to: string
          created_at: string
          grade_from: string | null
          grade_level: string | null
          grade_to: string | null
          id: string
          item_name: string
          kind: string
          term_id: string
        }
        Insert: {
          amount?: number
          applies_to?: string
          created_at?: string
          grade_from?: string | null
          grade_level?: string | null
          grade_to?: string | null
          id?: string
          item_name: string
          kind?: string
          term_id: string
        }
        Update: {
          amount?: number
          applies_to?: string
          created_at?: string
          grade_from?: string | null
          grade_level?: string | null
          grade_to?: string | null
          id?: string
          item_name?: string
          kind?: string
          term_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          balance: number
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          status: string
          student_id: string
          term_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          term_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          term_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      leave_entitlements: {
        Row: {
          carried_over_days: number
          created_at: string
          entitled_days: number | null
          id: string
          leave_type: string
          note: string | null
          staff_id: string
          updated_at: string
          year: number
        }
        Insert: {
          carried_over_days?: number
          created_at?: string
          entitled_days?: number | null
          id?: string
          leave_type: string
          note?: string | null
          staff_id: string
          updated_at?: string
          year: number
        }
        Update: {
          carried_over_days?: number
          created_at?: string
          entitled_days?: number | null
          id?: string
          leave_type?: string
          note?: string | null
          staff_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      leave_policies: {
        Row: {
          carryover_pct: number
          created_at: string
          default_days: number | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          leave_type: string
          max_carryover_days: number | null
          staff_category: Database["public"]["Enums"]["staff_category"]
          updated_at: string
        }
        Insert: {
          carryover_pct?: number
          created_at?: string
          default_days?: number | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          leave_type: string
          max_carryover_days?: number | null
          staff_category?: Database["public"]["Enums"]["staff_category"]
          updated_at?: string
        }
        Update: {
          carryover_pct?: number
          created_at?: string
          default_days?: number | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          leave_type?: string
          max_carryover_days?: number | null
          staff_category?: Database["public"]["Enums"]["staff_category"]
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          staff_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "leave_balances"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          paid_on: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_month: number
          period_year: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_month: number
          period_year: number
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_month?: number
          period_year?: number
          status?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          allowances: number
          basic_salary: number
          created_at: string
          gross_pay: number
          housing_levy: number
          id: string
          net_pay: number
          nhif: number
          nssf: number
          other_deductions: number
          paid_amount: number | null
          paid_by: string | null
          paid_method: string | null
          paid_on: string | null
          paid_reference: string | null
          paye: number
          payroll_run_id: string
          staff_id: string
        }
        Insert: {
          allowances?: number
          basic_salary?: number
          created_at?: string
          gross_pay?: number
          housing_levy?: number
          id?: string
          net_pay?: number
          nhif?: number
          nssf?: number
          other_deductions?: number
          paid_amount?: number | null
          paid_by?: string | null
          paid_method?: string | null
          paid_on?: string | null
          paid_reference?: string | null
          paye?: number
          payroll_run_id: string
          staff_id: string
        }
        Update: {
          allowances?: number
          basic_salary?: number
          created_at?: string
          gross_pay?: number
          housing_levy?: number
          id?: string
          net_pay?: number
          nhif?: number
          nssf?: number
          other_deductions?: number
          paid_amount?: number | null
          paid_by?: string | null
          paid_method?: string | null
          paid_on?: string | null
          paid_reference?: string | null
          paye?: number
          payroll_run_id?: string
          staff_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      route_assignments: {
        Row: {
          created_at: string
          driver_id: string
          ended_at: string | null
          id: string
          route_id: string
          service_date: string
          shift: string
          started_at: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          ended_at?: string | null
          id?: string
          route_id: string
          service_date?: string
          shift?: string
          started_at?: string | null
          status?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          route_id?: string
          service_date?: string
          shift?: string
          started_at?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      school_settings: {
        Row: {
          bank_details: string | null
          created_at: string
          current_term_id: string | null
          email: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          motto: string | null
          name: string
          p_o_box: string | null
          paybill: string | null
          phone: string | null
          tagline: string | null
          theme_color: string | null
          town: string | null
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          created_at?: string
          current_term_id?: string | null
          email?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          motto?: string | null
          name?: string
          p_o_box?: string | null
          paybill?: string | null
          phone?: string | null
          tagline?: string | null
          theme_color?: string | null
          town?: string | null
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          created_at?: string
          current_term_id?: string | null
          email?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          motto?: string | null
          name?: string
          p_o_box?: string | null
          paybill?: string | null
          phone?: string | null
          tagline?: string | null
          theme_color?: string | null
          town?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          basic_salary: number | null
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          hired_on: string | null
          id: string
          kra_pin: string | null
          last_name: string
          nhif_no: string | null
          nssf_no: string | null
          phone: string | null
          staff_category: Database["public"]["Enums"]["staff_category"]
          staff_no: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          basic_salary?: number | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          hired_on?: string | null
          id?: string
          kra_pin?: string | null
          last_name: string
          nhif_no?: string | null
          nssf_no?: string | null
          phone?: string | null
          staff_category?: Database["public"]["Enums"]["staff_category"]
          staff_no: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          basic_salary?: number | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          hired_on?: string | null
          id?: string
          kra_pin?: string | null
          last_name?: string
          nhif_no?: string | null
          nssf_no?: string | null
          phone?: string | null
          staff_category?: Database["public"]["Enums"]["staff_category"]
          staff_no?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          role_label: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          role_label: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          role_label?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "leave_balances"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_roles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_events: {
        Row: {
          assignment_id: string
          event_type: string
          id: string
          note: string | null
          recorded_at: string
          stop_id: string
        }
        Insert: {
          assignment_id: string
          event_type: string
          id?: string
          note?: string | null
          recorded_at?: string
          stop_id: string
        }
        Update: {
          assignment_id?: string
          event_type?: string
          id?: string
          note?: string | null
          recorded_at?: string
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "route_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_events_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          route_id: string
          scheduled_dropoff: string | null
          scheduled_pickup: string | null
          sequence: number
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          route_id: string
          scheduled_dropoff?: string | null
          scheduled_pickup?: string | null
          sequence?: number
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          route_id?: string
          scheduled_dropoff?: string | null
          scheduled_pickup?: string | null
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          parent_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_id: string
          relationship?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_stop_assignments: {
        Row: {
          created_at: string
          id: string
          shift: string
          stop_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shift?: string
          stop_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shift?: string
          stop_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_stop_assignments_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_stop_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          admission_no: string
          boarding: boolean
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          enrolled_on: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          home_address: string | null
          id: string
          last_name: string
          lunch: boolean
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          photo_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          admission_no: string
          boarding?: boolean
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrolled_on?: string
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          home_address?: string | null
          id?: string
          last_name: string
          lunch?: boolean
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          admission_no?: string
          boarding?: boolean
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrolled_on?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          home_address?: string | null
          id?: string
          last_name?: string
          lunch?: boolean
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          grade_levels: string[]
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          grade_levels?: string[]
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          grade_levels?: string[]
          id?: string
          name?: string
        }
        Relationships: []
      }
      terms: {
        Row: {
          academic_year: number
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          start_date: string
          term_number: number
        }
        Insert: {
          academic_year: number
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          start_date: string
          term_number: number
        }
        Update: {
          academic_year?: number
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          start_date?: string
          term_number?: number
        }
        Relationships: []
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          subject_id: string | null
          teacher_id: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          subject_id?: string | null
          teacher_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          subject_id?: string | null
          teacher_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          id: string
          label: string | null
          plate_no: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          label?: string | null
          plate_no: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          label?: string | null
          plate_no?: string
        }
        Relationships: []
      }
    }
    Views: {
      leave_balances: {
        Row: {
          carried_over_days: number | null
          entitled_days: number | null
          leave_type: string | null
          remaining_days: number | null
          staff_id: string | null
          used_days: number | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _student: string; _user: string }
        Returns: boolean
      }
      teaches_student: {
        Args: { _student: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "parent"
        | "driver"
        | "finance"
        | "head_teacher"
      attendance_status: "present" | "absent" | "late" | "excused"
      employment_type: "permanent" | "contract"
      gender: "male" | "female"
      staff_category: "teaching" | "non_teaching" | "support"
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
      app_role: [
        "admin",
        "teacher",
        "parent",
        "driver",
        "finance",
        "head_teacher",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      employment_type: ["permanent", "contract"],
      gender: ["male", "female"],
      staff_category: ["teaching", "non_teaching", "support"],
    },
  },
} as const
