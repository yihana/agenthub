import axios from 'axios';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';

export interface EarRequestConfig {
  destinationName?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface EarInvokeOptions {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export const callEar = async (config: EarRequestConfig, options: EarInvokeOptions) => {
  const method = options.method.toLowerCase() as EarInvokeOptions['method'];

  if (config.destinationName) {
    const response = await executeHttpRequest(
      { destinationName: config.destinationName },
      {
        method,
        url: options.path,
        data: options.data,
        headers: options.headers
      }
    );

    return {
      status: response.status,
      data: response.data,
      headers: response.headers ?? {}
    };
  }

  if (!config.baseUrl) {
    throw new Error('EAR integration requires destinationName or baseUrl');
  }

  const normalizedBase = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
  const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`;
  const url = `${normalizedBase}${normalizedPath}`;

  const response = await axios.request({
    url,
    method,
    data: options.data,
    headers: options.headers,
    timeout: config.timeoutMs ?? 30_000
  });

  return {
    status: response.status,
    data: response.data,
    headers: response.headers ?? {}
  };
};
