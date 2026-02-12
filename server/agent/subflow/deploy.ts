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
}

const resolveFlowFilePath = (flowFilePath?: string) => {
  if (flowFilePath) {
    return path.isAbsolute(flowFilePath)
      ? flowFilePath
      : path.resolve(process.cwd(), flowFilePath);
  }

  return path.resolve(__dirname, 'node-red-2step-flow.json');
};

export const loadNodeRedFlowTemplate = async (flowFilePath?: string) => {
  const resolvedPath = resolveFlowFilePath(flowFilePath);
  const raw = await fs.readFile(resolvedPath, 'utf-8');
  return {
    path: resolvedPath,
    raw,
    json: JSON.parse(raw)
  };
};

export const deployFlowByAdminApi = async (options: NodeRedDeployOptions) => {
  const { path: resolvedPath, json } = await loadNodeRedFlowTemplate(options.flowFilePath);
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
