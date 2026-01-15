import React, { useMemo, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import TagPill from '../../components/portal-dashboard/TagPill';

interface AgentRecord {
  id: string;
  name: string;
  owner: string;
  status: '운영' | '점검' | '보류';
  category: string;
  risk: '낮음' | '중간' | '높음';
  lastUpdated: string;
}

const STORAGE_KEY = 'portal-agent-list';

const defaultAgents: AgentRecord[] = [
  {
    id: 'PORTAL-1021',
    name: 'Finance Insight',
    owner: '재무팀',
    status: '운영',
    category: '재무',
    risk: '낮음',
    lastUpdated: '2024-06-28'
  },
  {
    id: 'PORTAL-1037',
    name: 'Policy Guard',
    owner: '보안실',
    status: '점검',
    category: '거버넌스',
    risk: '중간',
    lastUpdated: '2024-06-26'
  },
  {
    id: 'PORTAL-1042',
    name: 'Support Copilot',
    owner: '고객지원',
    status: '운영',
    category: 'CS',
    risk: '낮음',
    lastUpdated: '2024-06-25'
  },
  {
    id: 'PORTAL-1058',
    name: 'HR Document Helper',
    owner: '인사팀',
    status: '보류',
    category: '인사',
    risk: '높음',
    lastUpdated: '2024-06-18'
  }
];

const statusToneMap: Record<AgentRecord['status'], 'success' | 'warning' | 'neutral'> = {
  운영: 'success',
  점검: 'warning',
  보류: 'neutral'
};

const riskToneMap: Record<AgentRecord['risk'], 'success' | 'warning' | 'neutral'> = {
  낮음: 'success',
  중간: 'warning',
  높음: 'neutral'
};

const loadAgents = () => {
  if (typeof window === 'undefined') {
    return defaultAgents;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultAgents;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return defaultAgents;
    }
    return parsed as AgentRecord[];
  } catch {
    return defaultAgents;
  }
};

const PortalAgentListPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentRecord[]>(() => loadAgents());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [riskFilter, setRiskFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [formValues, setFormValues] = useState({
    name: '',
    owner: '',
    category: '재무',
    status: '운영' as AgentRecord['status'],
    risk: '낮음' as AgentRecord['risk']
  });

  const persistAgents = (updater: (prev: AgentRecord[]) => AgentRecord[]) => {
    setAgents((prev) => {
      const nextAgents = updater(prev);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAgents));
      }
      return nextAgents;
    });
  };

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === '전체' || agent.status === statusFilter;
      const matchesRisk = riskFilter === '전체' || agent.risk === riskFilter;
      const matchesCategory = categoryFilter === '전체' || agent.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesRisk && matchesCategory;
    });
  }, [agents, categoryFilter, riskFilter, search, statusFilter]);

  const handleFormChange = (field: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddAgent = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formValues.name.trim() || !formValues.owner.trim()) {
      window.alert('에이전트 이름과 담당 조직을 입력해 주세요.');
      return;
    }

    const nextAgent: AgentRecord = {
      id: `PORTAL-${Date.now().toString().slice(-4)}`,
      name: formValues.name.trim(),
      owner: formValues.owner.trim(),
      status: formValues.status,
      category: formValues.category,
      risk: formValues.risk,
      lastUpdated: new Date().toISOString().slice(0, 10)
    };


    persistAgents((prev) => [nextAgent, ...prev]);
    setFormValues((prev) => ({
      ...prev,
      name: '',
      owner: ''
    }));
  };

  return (
    <PortalDashboardLayout
      title="에이전트 목록"
      subtitle="운영 중인 에이전트를 상태와 리스크 기준으로 필터링합니다."
      actions={<button className="ear-primary">에이전트 등록</button>}
    >
      <div className="ear-grid ear-grid--sidebar">
        <aside className="ear-filter">
          <h3>필터</h3>
          <label>
            검색
            <input
              type="text"
              placeholder="에이전트 이름 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            상태
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="전체">전체</option>
              <option value="운영">운영</option>
              <option value="점검">점검</option>
              <option value="보류">보류</option>
            </select>
          </label>
          <label>
            리스크
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="전체">전체</option>
              <option value="낮음">낮음</option>
              <option value="중간">중간</option>
              <option value="높음">높음</option>
            </select>
          </label>
          <label>
            유형
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="전체">전체</option>
              <option value="재무">재무</option>
              <option value="거버넌스">거버넌스</option>
              <option value="CS">CS</option>
              <option value="인사">인사</option>
            </select>
          </label>
          <button className="ear-secondary">필터 저장</button>
          <form className="ear-form" onSubmit={handleAddAgent}>
            <h3>에이전트 등록</h3>
            <label>
              에이전트 이름
              <input
                type="text"
                placeholder="예: Finance Insight"
                value={formValues.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
              />
            </label>
            <label>
              담당 조직
              <input
                type="text"
                placeholder="예: 재무팀"
                value={formValues.owner}
                onChange={(event) => handleFormChange('owner', event.target.value)}
              />
            </label>
            <label>
              상태
              <select
                value={formValues.status}
                onChange={(event) => handleFormChange('status', event.target.value)}
              >
                <option value="운영">운영</option>
                <option value="점검">점검</option>
                <option value="보류">보류</option>
              </select>
            </label>
            <label>
              리스크
              <select
                value={formValues.risk}
                onChange={(event) => handleFormChange('risk', event.target.value)}
              >
                <option value="낮음">낮음</option>
                <option value="중간">중간</option>
                <option value="높음">높음</option>
              </select>
            </label>
            <label>
              유형
              <select
                value={formValues.category}
                onChange={(event) => handleFormChange('category', event.target.value)}
              >
                <option value="재무">재무</option>
                <option value="거버넌스">거버넌스</option>
                <option value="CS">CS</option>
                <option value="인사">인사</option>
              </select>
            </label>
            <button type="submit" className="ear-primary">등록 저장</button>
          </form>
        </aside>

        <section className="ear-table-card">
          <div className="ear-table-card__header">
            <div>
              <h3>에이전트 목록</h3>
              <p>총 {filteredAgents.length}개 에이전트</p>
            </div>
            <div className="ear-table-card__actions">
              <button className="ear-ghost">CSV 내보내기</button>
              <button className="ear-secondary">정렬</button>
            </div>
          </div>
          <table className="ear-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>소유 조직</th>
                <th>상태</th>
                <th>리스크</th>
                <th>최근 업데이트</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.id}</td>
                  <td>
                    <strong>{agent.name}</strong>
                    <span className="ear-muted">{agent.category}</span>
                  </td>
                  <td>{agent.owner}</td>
                  <td>
                    <TagPill label={agent.status} tone={statusToneMap[agent.status]} />
                  </td>
                  <td>
                    <TagPill label={agent.risk} tone={riskToneMap[agent.risk]} />
                  </td>
                  <td>{agent.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalAgentListPage;
