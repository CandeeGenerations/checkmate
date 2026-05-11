import type {Frequency, PeriodRange} from './date'

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: {'Content-Type': 'application/json'},
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ---------- Auth ----------

export interface AuthStatus {
  authRequired: boolean
  authenticated: boolean
}

export function login(password: string) {
  return request<{success: boolean}>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({password}),
  })
}

export function logout() {
  return request<{success: boolean}>('/auth/logout', {method: 'POST'})
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${BASE_URL}/auth/status`, {credentials: 'include'})
  return res.json()
}

// ---------- Items ----------

export interface Item {
  id: number
  title: string
  frequency: Frequency
  dayOfWeek: number | null
  dayOfMonth: number | null
  monthOfQuarter: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ItemInput {
  title: string
  frequency: Frequency
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  monthOfQuarter?: number | null
}

export function fetchItems() {
  return request<Item[]>('/items')
}

export function createItem(input: ItemInput) {
  return request<Item>('/items', {method: 'POST', body: JSON.stringify(input)})
}

export function updateItem(id: number, input: ItemInput) {
  return request<Item>(`/items/${id}`, {method: 'PUT', body: JSON.stringify(input)})
}

export function deleteItem(id: number) {
  return request<{success: boolean}>(`/items/${id}`, {method: 'DELETE'})
}

export interface ReorderItemRow {
  id: number
  frequency: Frequency
  sortOrder: number
  dayOfWeek?: number | null
}

export function reorderItems(items: ReorderItemRow[]) {
  return request<{success: boolean}>('/items/reorder', {method: 'PUT', body: JSON.stringify({items})})
}

// ---------- Completions ----------

export function completeItem(itemId: number, date?: string) {
  return request<{success: boolean}>('/completions', {
    method: 'POST',
    body: JSON.stringify({itemId, date}),
  })
}

export function uncompleteItem(itemId: number, date?: string) {
  return request<{success: boolean}>('/completions', {
    method: 'DELETE',
    body: JSON.stringify({itemId, date}),
  })
}

// ---------- Period view ----------

export interface PeriodItem extends Item {
  dueDate: string | null
  completed: boolean
}

export interface PeriodView {
  frequency: Frequency
  date: string
  range: PeriodRange
  items: PeriodItem[]
}

export function fetchPeriod(frequency: Frequency, date: string) {
  return request<PeriodView>(`/period/${frequency}?date=${encodeURIComponent(date)}`)
}
