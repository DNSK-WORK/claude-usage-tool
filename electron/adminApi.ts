const BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

export interface UsageResult {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  cache_creation?: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  server_tool_use?: {
    web_search_requests: number;
  };
  model?: string;
  workspace_id?: string;
}

export interface TimeBucket {
  starting_at: string;
  ending_at: string;
  results: UsageResult[];
}

export interface UsageReportResponse {
  data: TimeBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface CostResult {
  amount: string;
  currency: 'USD';
  model: string | null;
  cost_type: 'tokens' | 'web_search' | 'code_execution' | null;
  service_tier: 'standard' | 'batch' | null;
  workspace_id: string | null;
  description?: string | null;
}

export interface CostTimeBucket {
  starting_at: string;
  ending_at: string;
  results: CostResult[];
}

export interface CostReportResponse {
  data: CostTimeBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface CreditBalance {
  available_credit: string;
  currency: 'USD';
}

export interface ApiData {
  usageReport: UsageReportResponse | null;
  costReport: CostReportResponse | null;
  creditBalance: CreditBalance | null;
}

interface UsageReportParams {
  starting_at: string;
  ending_at?: string;
  bucket_width?: '1d' | '1m' | '1h';
  group_by?: Array<'api_key_id' | 'workspace_id' | 'model' | 'service_tier' | 'context_window'>;
  limit?: number;
  page?: string;
}

interface CostReportParams {
  starting_at: string;
  ending_at?: string;
  bucket_width?: '1d';
  group_by?: Array<'workspace_id' | 'description'>;
  limit?: number;
  page?: string;
}

function buildUrl(endpoint: string, params: Record<string, unknown>): string {
  const url = new URL(`${BASE_URL}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
    } else {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
}

async function fetchApi<T>(adminKey: string, endpoint: string, params: Record<string, unknown>): Promise<T> {
  const url = buildUrl(endpoint, params);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': adminKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Admin API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function getUsageReport(
  adminKey: string,
  params: UsageReportParams
): Promise<UsageReportResponse> {
  return fetchApi<UsageReportResponse>(
    adminKey,
    '/v1/organizations/usage_report/messages',
    params as unknown as Record<string, unknown>
  );
}

export async function getCostReport(
  adminKey: string,
  params: CostReportParams
): Promise<CostReportResponse> {
  return fetchApi<CostReportResponse>(
    adminKey,
    '/v1/organizations/cost_report',
    params as unknown as Record<string, unknown>
  );
}

export async function getCreditBalance(adminKey: string): Promise<CreditBalance> {
  return fetchApi<CreditBalance>(
    adminKey,
    '/v1/organizations/credit_balance',
    {}
  );
}

// Utility function to calculate total cost from a cost report
export function calculateTotalCost(costReport: CostReportResponse): number {
  let total = 0;
  for (const bucket of costReport.data) {
    for (const result of bucket.results) {
      total += parseFloat(result.amount) || 0;
    }
  }
  return total;
}

// Utility function to get cost breakdown by model
export function getCostByModel(costReport: CostReportResponse): Record<string, number> {
  const byModel: Record<string, number> = {};

  for (const bucket of costReport.data) {
    for (const result of bucket.results) {
      const model = result.model || 'unknown';
      byModel[model] = (byModel[model] || 0) + (parseFloat(result.amount) || 0);
    }
  }

  return byModel;
}

// Utility function to get token totals from usage report
export function getTokenTotals(usageReport: UsageReportResponse): {
  input: number;
  output: number;
  cached: number;
  total: number;
} {
  let input = 0;
  let output = 0;
  let cached = 0;

  for (const bucket of usageReport.data) {
    for (const result of bucket.results) {
      input += result.uncached_input_tokens || 0;
      output += result.output_tokens || 0;
      cached += result.cache_read_input_tokens || 0;
    }
  }

  return { input, output, cached, total: input + output + cached };
}

// Utility function to get usage breakdown by model
export function getUsageByModel(usageReport: UsageReportResponse): Record<string, {
  input: number;
  output: number;
  cached: number;
  total: number;
}> {
  const byModel: Record<string, { input: number; output: number; cached: number; total: number }> = {};

  for (const bucket of usageReport.data) {
    for (const result of bucket.results) {
      const model = result.model || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { input: 0, output: 0, cached: 0, total: 0 };
      }
      byModel[model].input += result.uncached_input_tokens || 0;
      byModel[model].output += result.output_tokens || 0;
      byModel[model].cached += result.cache_read_input_tokens || 0;
      byModel[model].total = byModel[model].input + byModel[model].output + byModel[model].cached;
    }
  }

  return byModel;
}
