import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {useAuth} from '@/hooks/use-auth'
import {useState} from 'react'

interface LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginDialog({open, onOpenChange}: LoginDialogProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const {login} = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login.mutateAsync(password)
      setPassword('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Sign in</DialogTitle>
          <DialogDescription>Enter the password to access Checkmate.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={login.isPending || !password}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
