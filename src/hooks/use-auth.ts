import {checkAuthStatus, login as apiLogin, logout as apiLogout} from '@/lib/api'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

export const AUTH_KEY = ['auth-status'] as const

export function useAuth() {
  const qc = useQueryClient()
  const status = useQuery({queryKey: AUTH_KEY, queryFn: checkAuthStatus})

  const login = useMutation({
    mutationFn: apiLogin,
    // After login: refetch every query. Anything that 401'd while logged out (items, period
    // views) is now serveable, and the auth status flips to authenticated.
    onSuccess: () => qc.invalidateQueries(),
  })

  const logout = useMutation({
    mutationFn: apiLogout,
    // After logout: clear the cache so previously-fetched private data isn't shown to the
    // next session, and refresh auth status.
    onSuccess: () => {
      qc.clear()
      qc.invalidateQueries({queryKey: AUTH_KEY})
    },
  })

  return {
    authRequired: status.data?.authRequired ?? true,
    authenticated: status.data?.authenticated ?? false,
    isLoading: status.isLoading,
    login,
    logout,
  }
}
