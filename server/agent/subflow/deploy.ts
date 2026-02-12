import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface NodeRedDeployOptions {
  adminUrl: string;
  flowFilePath?: string;
  token?: string;
  flowJson?: unknown;
}

export interface NodeRedFlowValidationResult {
  valid: boolean;
  errors: string[];
  node_count: number;
  tab_count: number;
  has_rev: boolean;
}

const findExistingPath = async (candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
};

const resolveFlowFilePath = async (flowFilePath?: string) => {
  const defaultPath = path.resolve(__dirname, 'node-red-2step-flow.json');

  if (!flowFilePath) {
    return defaultPath;
  }

  if (path.isAbsolute(flowFilePath)) {
    return flowFilePath;
  }

  const cwd = process.cwd();
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const normalized = flowFilePath.replace(/^\.\//, '');

  const candidates = [
    path.resolve(cwd, normalized),
    path.resolve(cwd, '..', normalized),
    path.resolve(repoRoot, normalized),
    normalized.startsWith('server/')
      ? path.resolve(repoRoot, normalized.replace(/^server\//, ''))
      : ''
  ].filter(Boolean);

  const matched = await findExistingPath(candidates as string[]);
  if (matched) {
    return matched;
  }

  return path.resolve(cwd, normalized);
};


const resolveGenericPath = async (filePath: string) => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const cwd = process.cwd();
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const normalized = filePath.replace(/^\.\//, '');

  const candidates = [
    path.resolve(cwd, normalized),
    path.resolve(cwd, '..', normalized),
    path.resolve(repoRoot, normalized),
    normalized.startsWith('server/')
      ? path.resolve(repoRoot, normalized.replace(/^server\//, ''))
      : ''
  ].filter(Boolean) as string[];

  const matched = await findExistingPath(candidates);
  return matched ?? path.resolve(cwd, normalized);
};

export const loadNodeRedFlowTemplate = async (flowFilePath?: string) => {
  const resolvedPath = await resolveFlowFilePath(flowFilePath);
  const raw = await fs.readFile(resolvedPath, 'utf-8');
  return {
    path: resolvedPath,
    raw,
    json: JSON.parse(raw)
  };
};

const resolveFlowJson = async (options: NodeRedDeployOptions) => {
  if (options.flowJson) {
    return {
      path: options.flowFilePath ?? 'inline-flow-json',
      json: options.flowJson
    };
  }

  const loaded = await loadNodeRedFlowTemplate(options.flowFilePath);
  return {
    path: loaded.path,
    json: loaded.json
  };
};

const toFlowArray = (flowJson: unknown): { flows: any[]; hasRev: boolean; errors: string[] } => {
  if (Array.isArray(flowJson)) {
    return { flows: flowJson, hasRev: false, errors: [] };
  }

  if (flowJson && typeof flowJson === 'object') {
    const envelope = flowJson as any;
    if (Array.isArray(envelope.flows)) {
      return { flows: envelope.flows, hasRev: typeof envelope.rev === 'string', errors: [] };
    }
    return { flows: [], hasRev: false, errors: ['flow json object must include a flows array'] };
  }

  return { flows: [], hasRev: false, errors: ['flow json must be an array or an object with flows'] };
};

export const validateNodeRedFlowJson = (flowJson: unknown): NodeRedFlowValidationResult => {
  const normalized = toFlowArray(flowJson);
  const errors = [...normalized.errors];

  normalized.flows.forEach((node: any, index: number) => {
    if (!node || typeof node !== 'object') {
      errors.push(`flows[${index}] must be an object`);
      return;
    }

    if (typeof node.id !== 'string' || !node.id.trim()) {
      errors.push(`flows[${index}].id is required`);
    }

    if (typeof node.type !== 'string' || !node.type.trim()) {
      errors.push(`flows[${index}].type is required`);
    }

    if (node.z != null && typeof node.z !== 'string') {
      errors.push(`flows[${index}].z must be a string when provided`);
    }
  });

  const tabCount = normalized.flows.filter((node: any) => node?.type === 'tab').length;

  return {
    valid: errors.length === 0,
    errors,
    node_count: normalized.flows.length,
    tab_count: tabCount,
    has_rev: normalized.hasRev
  };
};

export const fetchNodeRedFlows = async (adminUrl: string, token?: string) => {
  const normalizedUrl = adminUrl.replace(/\/$/, '');
  const response = await axios.get(`${normalizedUrl}/flows`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    timeout: 15_000
  });

  return {
    admin_url: normalizedUrl,
    status: response.status,
    data: response.data
  };
};

export const readNodeRedFlowsFile = async (flowsFilePath?: string) => {
  const defaultPath = path.resolve(os.homedir(), '.node-red', 'flows.json');
  const resolvedPath = flowsFilePath ? await resolveGenericPath(flowsFilePath) : defaultPath;

  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const json = JSON.parse(raw);

  return {
    flows_file_path: resolvedPath,
    node_count: Array.isArray(json) ? json.length : Array.isArray(json?.flows) ? json.flows.length : 0,
    data: json
  };
};


export const saveFlowJsonToFile = async (targetFilePath: string, flowJson: unknown) => {
  const resolvedPath = path.isAbsolute(targetFilePath)
    ? targetFilePath
    : path.resolve(process.cwd(), targetFilePath);

  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, JSON.stringify(flowJson, null, 2), 'utf-8');

  return {
    target_file_path: resolvedPath
  };
};

export const exportNodeRedFlowsToFile = async (adminUrl: string, targetFilePath: string, token?: string) => {
  const flows = await fetchNodeRedFlows(adminUrl, token);
  const saved = await saveFlowJsonToFile(targetFilePath, flows.data);

  return {
    admin_url: flows.admin_url,
    status: flows.status,
    ...saved,
    node_count: Array.isArray(flows.data) ? flows.data.length : Array.isArray((flows.data as any)?.flows) ? (flows.data as any).flows.length : 0
  };
};

export const deployFlowByAdminApi = async (options: NodeRedDeployOptions) => {
  const { path: resolvedPath, json } = await resolveFlowJson(options);

  const adminUrl = options.adminUrl.replace(/\/$/, '');

  const response = await axios.post(`${adminUrl}/flows`, json, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    timeout: 15_000
  });

  return {
    method: 'admin-api',
    flow_path: resolvedPath,
    admin_url: adminUrl,
    status: response.status,
    data: response.data
  };
};

export const deployFlowByCli = async (options: NodeRedDeployOptions) => {
  const { path: resolvedPath } = await loadNodeRedFlowTemplate(options.flowFilePath);
  const adminUrl = options.adminUrl.replace(/\/$/, '');

  const args = ['admin', 'import', resolvedPath, '-u', adminUrl];
  const { stdout, stderr } = await execFileAsync('node-red', args, {
    timeout: 20_000
  });

  return {
    method: 'cli',
    flow_path: resolvedPath,
    admin_url: adminUrl,
    command: `node-red ${args.join(' ')}`,
    stdout,
    stderr
  };
};
