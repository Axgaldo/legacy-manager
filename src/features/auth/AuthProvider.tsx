import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'

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
  const [isAllowed, setIsAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let accessCheck = 0

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentCheck = ++accessCheck
      setUser(firebaseUser)
      setIsAllowed(false)
      setLoading(true)

      if (!firebaseUser) {
        setLoading(false)
        return
      }

      try {
        const accessDoc = await getDoc(doc(db, 'authorizedUsers', firebaseUser.uid))
        if (!active || currentCheck !== accessCheck) return
        setIsAllowed(accessDoc.exists() && accessDoc.data().enabled === true)
      } catch (error) {
        console.error('Could not verify the signed-in user access.', error)
        if (!active || currentCheck !== accessCheck) return
        setIsAllowed(false)
      } finally {
        if (active && currentCheck === accessCheck) setLoading(false)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

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
