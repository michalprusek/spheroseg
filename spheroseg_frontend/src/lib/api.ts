import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// API endpoints
export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    me: '/auth/me'
  },
  projects: {
    list: '/projects',
    create: '/projects',
    get: (id: string) => `/projects/${id}`,
    update: (id: string) => `/projects/${id}`,
    delete: (id: string) => `/projects/${id}`
  },
  analysis: {
    analyze: '/analysis/process',
    results: (id: string) => `/analysis/${id}/results`,
    export: (id: string) => `/analysis/${id}/export`
  }
}

// Type definitions
export interface Project {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
  status: 'active' | 'archived'
  image_count: number
  owner_id: string
}

export interface AnalysisResult {
  id: string
  project_id: string
  image_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  results: {
    spheroids: Array<{
      id: string
      x: number
      y: number
      diameter: number
      confidence: number
    }>
  }
  created_at: string
  completed_at?: string
}