export default interface PortalMetrics {
  total_requests: number;
  prev_total_requests: number;
  growth_rate_pct: number;
  completed_requests: number;
  pending_requests: number;
  avg_latency_ms: number;
  avg_queue_time_ms: number;
  error_rate_pct: number;
  quality_score: number;
  stability_score: number;
  task_success_rate_pct: number;
  sla_compliance_pct: number;
  user_coverage_pct: number;
  requests_processed: number;
  savings: {
    baseline_minutes_per_request: number;
    avg_response_minutes: number;
    time_savings_minutes: number;
    cost_savings: number;
    roi_ratio_pct: number;
  };
}
