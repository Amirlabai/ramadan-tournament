"""Offline analytics CSV → HTML dashboard pipeline."""

from analytics_report.metrics import DashboardData, compute_metrics, compute_metrics_from_csv
from analytics_report.render import write_dashboard

__all__ = [
    "DashboardData",
    "compute_metrics",
    "compute_metrics_from_csv",
    "write_dashboard",
]
