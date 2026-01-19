// Cloudflare Bindings
export type Bindings = {
  DB: D1Database;
};

// User types
export interface User {
  user_id: number;
  email: string;
  password_hash: string;
  name: string;
  current_plan: 'free' | 'premium';
  templates_created: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  subscription_id: number;
  user_id: number;
  plan_type: 'free' | 'premium';
  template_limit: number;
  start_date: string;
  expiry_date: string | null;
  payment_status: 'active' | 'canceled' | 'expired';
  stripe_subscription_id: string | null;
  created_at: string;
}

// Template types
export interface Template {
  template_id: number;
  user_id: number;
  template_name: string;
  file_path: string;
  file_type: 'xlsx' | 'xls' | 'pdf';
  file_size: number;
  quotes_created: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateField {
  field_id: number;
  template_id: number;
  field_name: string;
  field_type: 'input' | 'calc' | 'fixed';
  data_type: 'text' | 'number' | 'date';
  cell_position: string;
  calculation_formula: string | null;
  fixed_value: string | null;
  is_required: number;
  display_order: number;
  created_at: string;
}

// Form types
export interface Form {
  form_id: number;
  template_id: number;
  user_id: number;
  form_url: string;
  form_title: string;
  form_description: string | null;
  is_active: number;
  access_count: number;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

// Quote types
export interface Quote {
  quote_id: number;
  form_id: number;
  template_id: number;
  user_id: number;
  input_data: string; // JSON string
  calculated_data: string | null; // JSON string
  file_path: string;
  file_name: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// JWT Payload
export interface JWTPayload {
  user_id: number;
  email: string;
  current_plan: 'free' | 'premium';
  iat?: number;
  exp?: number;
}
