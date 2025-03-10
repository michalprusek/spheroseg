import { create } from 'zustand'
import { WebSocket } from '@/lib/websocket'

interface CollaborationState {
  connected: boolean
  users: Set<string>
  currentProject: string | null
  connect: (projectId: string) => Promise<void>
  disconnect: () => void
  sendUpdate: (data: any) => void
}

export const useCollaboration = create<CollaborationState>((set, get) => ({
  connected: false,
  users: new Set(),
  currentProject: null,
  
  connect: async (projectId: string) => {
    const ws = new WebSocket(`/api/ws/projects/${projectId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      switch (data.type) {
        case 'user_joined':
          set(state => ({
            users: new Set([...state.users, data.user])
          }))
          break
        case 'user_left':
          set(state => {
            const users = new Set(state.users)
            users.delete(data.user)
            return { users }
          })
          break
        case 'update':
          // Handle various update types
          break
      }
    }

    set({ connected: true, currentProject: projectId })
  },
  
  disconnect: () => {
    set({ connected: false, currentProject: null, users: new Set() })
  },
  
  sendUpdate: (data: any) => {
    if (get().connected && get().currentProject) {
      ws.send(JSON.stringify(data))
    }
  }
}))