export type Role = 'WORKER' | 'EMPLOYER'

export type User = {
  id: string
  name: string
  phone: string
  area: string
  role: Role
  skill?: string
  businessName?: string
}

export type Job = {
  id: string
  title: string
  category: string
  type: string
  pay: number
  workersNeeded: number
  place: string
  latitude?: number
  longitude?: number
  employerName: string
  closed: boolean
}

export type Application = {
  id: string
  jobId: string
  jobTitle: string
  workerName: string
  status: string
}
