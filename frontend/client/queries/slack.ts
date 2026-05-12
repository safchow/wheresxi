import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/client/client'

export type LinkSlackResponse = {
  slackAccount: {
    id: string
    slackUserId: string
    teamId: string
  }
}

export function useLinkSlackAccount() {
  return useMutation({
    mutationFn: (input: { code: string }) =>
      apiClient.post<LinkSlackResponse>('/api/slack/link', input),
  })
}
