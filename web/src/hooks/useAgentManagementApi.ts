import { useCallback } from 'react';

interface AgentPayload {
  name: string;
  description?: string;
  type: string;
  status?: string;
  envConfig?: Record<string, any> | null;
  maxConcurrency?: number;
  tags?: string[];
  roles?: string[];
}

export const useAgentManagementApi = () => {
  const request = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    const token = localStorage.getItem('token');
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '요청 처리 중 오류가 발생했습니다.');
    }

    return response.json();
  }, []);

  const getSummary = useCallback(() => request('/api/agents/summary'), [request]);

  const listAgents = useCallback(
    (params: Record<string, string | number | undefined>) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      return request(`/api/agents?${searchParams.toString()}`);
    },
    [request]
  );

  const getAgent = useCallback((id: string | number) => request(`/api/agents/${id}`), [request]);

  const createAgent = useCallback((payload: AgentPayload) => {
    return request('/api/agents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }, [request]);

  const updateAgent = useCallback((id: string | number, payload: Partial<AgentPayload>) => {
    return request(`/api/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }, [request]);

  const deleteAgent = useCallback((id: string | number) => {
    return request(`/api/agents/${id}`, {
      method: 'DELETE'
    });
  }, [request]);

  const getMetrics = useCallback((id: string | number) => {
    return request(`/api/agents/${id}/metrics`);
  }, [request]);

  const getTasks = useCallback((id: string | number) => {
    return request(`/api/agents/${id}/tasks`);
  }, [request]);

  const listJobs = useCallback(() => request('/api/jobs'), [request]);

  const createJob = useCallback((payload: { payload: any; priority?: number; scheduledAt?: string; assignedAgentId?: number | null; }) => {
    return request('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }, [request]);

  return {
    getSummary,
    listAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    getMetrics,
    getTasks,
    listJobs,
    createJob
  };
};
