import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { API_URL, DEMO_CREDENTIALS, API_ENDPOINTS } from '../utils/config'

// Types
interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: string
  organization_id: string
  is_active: boolean
  email_verified: boolean
  avatar_url?: string
  created_at: string
}

interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

interface LoginData {
  email: string
  password: string
}

interface RegisterData {
  email: string
  username: string
  password: string
  confirm_password: string
  first_name: string
  last_name: string
  organization_id: string
  phone?: string
  bio?: string
}

interface AuthContextType {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginData) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth provider component
interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedTokens = localStorage.getItem('auth_tokens')
        const storedUser = localStorage.getItem('auth_user')

        if (storedTokens && storedUser) {
          try {
            const parsedTokens = JSON.parse(storedTokens) as AuthTokens
            const parsedUser = JSON.parse(storedUser) as User
            
            // Basic validation of stored data
            if (!parsedTokens.access_token || !parsedUser.id) {
              throw new Error('Invalid stored auth data')
            }
            
            setTokens(parsedTokens)
            setUser(parsedUser)
            
            // Verify token is still valid with timeout
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Auth verification timeout')), 10000)
            )
            
            await Promise.race([
              fetchUserProfile(parsedTokens.access_token),
              timeoutPromise
            ])
            
            console.log('✅ Authentication initialized successfully')
          } catch (error) {
            console.error('Failed to initialize auth, attempting token refresh:', error)
            
            // Try to refresh token if we have a refresh token and user data
            try {
              const parsedTokens = JSON.parse(storedTokens) as AuthTokens
              const parsedUser = JSON.parse(storedUser) as User
              
              if (parsedTokens?.refresh_token && parsedUser?.id) {
                console.log('🔄 Attempting token refresh during initialization...')
                await refreshTokenInternal(parsedTokens.refresh_token, parsedUser)
                console.log('✅ Token refresh successful during initialization')
              } else {
                throw new Error('No valid refresh token available')
              }
            } catch (refreshError) {
              console.error('❌ Token refresh during initialization failed:', refreshError)
              clearAuthData()
            }
          }
        } else {
          console.log('🚫 No stored authentication data found')
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        clearAuthData()
      } finally {
        setIsLoading(false)
        console.log('🏁 Auth initialization complete')
      }
    }

    // Add a small delay to prevent React strict mode double execution issues
    const timeoutId = setTimeout(initAuth, 100)
    return () => clearTimeout(timeoutId)
  }, [])

  // Helper function to clear auth data
  const clearAuthData = () => {
    console.log('🧹 Clearing authentication data')
    setUser(null)
    setTokens(null)
    
    // Clear all possible auth-related localStorage keys
    try {
      localStorage.removeItem('auth_tokens')
      localStorage.removeItem('auth_user')
      // Also clear any other auth-related keys that might exist
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('auth_') || key.startsWith('token_') || key.includes('session'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }

  // Helper function to store auth data
  const storeAuthData = (tokens: AuthTokens, user: User) => {
    setTokens(tokens)
    setUser(user)
    localStorage.setItem('auth_tokens', JSON.stringify(tokens))
    localStorage.setItem('auth_user', JSON.stringify(user))
  }

  // Fetch user profile
  const fetchUserProfile = async (accessToken: string): Promise<User> => {
    try {
      console.log('👤 Fetching user profile...')
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(API_ENDPOINTS.auth.me, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: HTTP ${response.status}`)
      }

      const user = await response.json()
      
      // Validate user data
      if (!user || !user.id) {
        throw new Error('Invalid user profile data received')
      }
      
      console.log('✅ User profile fetched successfully:', user.email)
      return user
    } catch (error) {
      console.error('❌ Failed to fetch user profile:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Profile fetch timed out')
      }
      throw error
    }
  }

  // Login function
  const login = async (data: LoginData) => {
    try {
      console.log('🔑 Attempting login for:', data.email)
      
      // Add timeout to login request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
      
      const response = await fetch(API_ENDPOINTS.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorDetail = errorData.detail || errorDetail
        } catch {
          // If can't parse error JSON, use default message
        }
        throw new Error(errorDetail)
      }

      const result = await response.json()
      
      // Validate response structure
      if (!result.tokens || !result.user) {
        throw new Error('Invalid login response format')
      }
      
      const { tokens, user } = result

      // Validate required fields
      if (!tokens.access_token || !user.id) {
        throw new Error('Invalid authentication data received')
      }

      storeAuthData(tokens, user)
      console.log('✅ Login successful for:', user.email)
      toast.success('Login successful!')
    } catch (error) {
      console.error('❌ Login error:', error)
      
      let message = 'Login failed'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message = 'Login request timed out. Please try again.'
        } else {
          message = error.message
        }
      }
      
      toast.error(message)
      throw error
    }
  }

  // Register function
  const register = async (data: RegisterData) => {
    try {
      const response = await fetch(API_ENDPOINTS.auth.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Registration failed')
      }

      const result = await response.json()
      toast.success(result.message || 'Registration successful! Please check your email to verify your account.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      toast.error(message)
      throw error
    }
  }

  // Logout function
  const logout = async () => {
    try {
      if (tokens) {
        await fetch(API_ENDPOINTS.auth.logout, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
        })
      }
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      clearAuthData()
      toast.success('Logged out successfully')
    }
  }

  // Internal refresh token function
  const refreshTokenInternal = async (refreshTokenValue: string, currentUser: User) => {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${refreshTokenValue}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed with status ${response.status}`)
    }

    const newTokens = await response.json()
    storeAuthData(newTokens, currentUser)
    return newTokens
  }

  // Public refresh token function
  const refreshToken = async () => {
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available')
    }

    if (!user) {
      throw new Error('No user data available')
    }

    try {
      console.log('AuthContext: Refreshing token...')
      await refreshTokenInternal(tokens.refresh_token, user)
      console.log('AuthContext: Token refresh successful')
    } catch (error) {
      console.error('AuthContext: Token refresh failed:', error)
      clearAuthData()
      throw error
    }
  }

  // Update profile function
  const updateProfile = async (data: Partial<User>) => {
    if (!tokens) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await fetch(API_ENDPOINTS.auth.me, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Profile update failed')
      }

      const updatedUser = await response.json()
      
      // Update stored user data
      setUser(updatedUser)
      localStorage.setItem('auth_user', JSON.stringify(updatedUser))
      
      toast.success('Profile updated successfully!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Profile update failed'
      toast.error(message)
      throw error
    }
  }

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}