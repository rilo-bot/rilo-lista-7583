/**
 * AUTO-GENERATED — DO NOT EDIT.
 * This is the shared API contract for this app, regenerated from the plan on
 * every build. Both the frontend (@/contract) and the backend (./contract)
 * import these types so the request/response shapes can never drift.
 */


// ── feature: auth — Sign in with email code ──

export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** ISO timestamp of account creation */
  createdAt: string;
}

export interface OtpCode {
  /** Unique OTP record identifier */
  id: string;
  /** Email address the code was sent to */
  email: string;
  /** The one-time code */
  code: string;
  /** ISO timestamp when the code expires */
  expiresAt: string;
  /** ISO timestamp when the code was created */
  createdAt: string;
}

// ── feature: todo-board — Todo board ──

export interface Todo {
  /** Unique todo identifier */
  id: string;
  /** Owner user id */
  userId: string;
  /** Task title */
  title: string;
  /** Optional longer description or notes */
  notes?: string;
  /** Task priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** ISO date string for the due date, or null if none */
  dueDate: string | null;
  /** Whether the task is marked complete */
  completed: boolean;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

export interface ApiContract {
  "auth-request-code": { method: "POST"; path: "/api/auth/request-code"; request: { email: string }; response: { ok: boolean } };
  "auth-verify-code": { method: "POST"; path: "/api/auth/verify-code"; request: { email: string; code: string }; response: { token: string; user: User } };
  "auth-me": { method: "GET"; path: "/api/auth/me"; request: void; response: User };
  "list-todos": { method: "GET"; path: "/api/todos"; request: void; response: Todo[] };
  "create-todo": { method: "POST"; path: "/api/todos"; request: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>; response: Todo };
  "update-todo": { method: "PATCH"; path: "/api/todos/:id"; request: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>; response: Todo };
  "delete-todo": { method: "DELETE"; path: "/api/todos/:id"; request: void; response: { ok: boolean } };
}

export const API_ROUTES = {
  "auth-request-code": { method: "POST", path: "/api/auth/request-code" },
  "auth-verify-code": { method: "POST", path: "/api/auth/verify-code" },
  "auth-me": { method: "GET", path: "/api/auth/me" },
  "list-todos": { method: "GET", path: "/api/todos" },
  "create-todo": { method: "POST", path: "/api/todos" },
  "update-todo": { method: "PATCH", path: "/api/todos/:id" },
  "delete-todo": { method: "DELETE", path: "/api/todos/:id" },
} as const;
