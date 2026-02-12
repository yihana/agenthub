import { promises as fs } from 'fs';
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
