export type AuthMode = "login" | "register" | "forgot" | "reset" | "upgrade" | "resend";
export type AuthActionState = {
  error?: string;
  message?: string;
  redirectTo?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "confirmPassword" | "fullName", string>>;
};

export type AccountProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  email_verified_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};
