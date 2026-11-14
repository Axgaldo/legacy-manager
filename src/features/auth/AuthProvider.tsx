import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

// ─── Whitelist ────────────────────────────────────────────────────────────────
// Add the Firebase UID of each authorised user here.
// You can find UIDs in Firebase Console → Authentication → Users.
const ALLOWED_UIDS: string[] = [
  'tAn1QIbfN0S40JTudP0XNcpSOcA2', // Administrador principal
]

// ─── Context ─────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null
  isAllowed: boolean
  loading: boolean
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const isAllowed =
    user !== null &&
    (ALLOWED_UIDS.length === 0 || ALLOWED_UIDS.includes(user.uid))
  //  ↑ During initial setup (empty list) all logged-in users pass.
  //    Once you add UIDs, only those UIDs are allowed.

  async function signIn() {
    await signInWithPopup(auth, googleProvider)
  }

  async function signOutUser() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, isAllowed, loading, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
