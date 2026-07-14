"""Threshold-based narrative insights from DashboardData."""

from __future__ import annotations

from analytics_report.metrics import DashboardData


def _count_map(rows: list[dict]) -> dict[str, int]:
    return {str(r["name"]): int(r["count"]) for r in rows}


def build_insights(data: DashboardData, *, extra: list[str] | None = None) -> list[str]:
    k = data.kpis
    auth = _count_map(data.auth_events)
    platforms = _count_map(data.session_lost_by_platform)
    identity = _count_map(data.identity_funnel)
    insights: list[str] = []

    total = k["total_events"]
    lost = k["auth_session_lost"]
    google_ok = k["google_login_success"]
    login_ok = k["login_success"]
    login_fail = k["login_failed"]
    successes = google_ok + login_ok

    insights.append(
        f"Dataset covers {k['day_count']} days ({k['date_min']} → {k['date_max']}) "
        f"with {total:,} events across {k['unique_sessions']:,} client sessions "
        f"(load mode: {data.load_mode}"
        + (f", chunksize={data.chunksize}" if data.chunksize else "")
        + ")."
    )

    if k.get("peak_day"):
        insights.append(
            f"Peak traffic day is {k['peak_day']} with {k['peak_day_count']:,} events "
            f"({100 * k['peak_day_count'] / max(total, 1):.1f}% of all events)."
        )

    if lost:
        ratio = lost / max(successes, 1)
        lpv = k.get("lost_per_page_view")
        corr = k.get("lost_vs_page_view_hourly_corr")
        corr_note = (
            f" Hourly vs page_view correlation={corr}."
            if corr is not None
            else ""
        )
        insights.append(
            f"auth_session_lost ({lost:,}) is {ratio:.1f}× combined login successes "
            f"(Google {google_ok:,} + password {login_ok:,})"
            + (f"; ~{lpv} per page_view." if lpv is not None else ".")
            + corr_note
            + " Important: AuthContext emits this on any /me 401, including anonymous first "
            "loads — so most events are “no session”, not “lost after login”."
        )

    if platforms and lost:
        top_plat = max(platforms, key=platforms.get)
        top_n = platforms[top_plat]
        insights.append(
            f"Session-lost is heaviest on {top_plat} "
            f"({top_n:,} / {lost:,} = {100 * top_n / lost:.0f}%). "
            + ", ".join(f"{p}: {n:,}" for p, n in sorted(platforms.items(), key=lambda x: -x[1]))
            + "."
        )

    if data.session_lost_by_path:
        top_path = data.session_lost_by_path[0]
        insights.append(
            f"Most common path at session-lost is {top_path['name']} "
            f"({top_path['count']:,} events)."
        )

    probe = _count_map(data.probe_outcomes)
    probe_total = sum(probe.values())
    if probe_total:
        ok = probe.get("ok", 0)
        insights.append(
            f"Post-login auth_session_probe: {ok:,} ok / {probe_total:,} total "
            f"({100 * ok / probe_total:.0f}% sticky). "
            f"Outcomes: {dict(probe)}."
        )

    g_click = auth.get("google_login_click", 0)
    g_fail = auth.get("google_login_failed", 0)
    if g_click or google_ok:
        click_note = (
            f"{g_click:,} client clicks; "
            if g_click
            else "no client clicks logged; "
        )
        insights.append(
            f"Google login: {click_note}{google_ok:,} server successes; "
            f"{g_fail:,} client-tracked failures. "
            "(Click and success counts can diverge because they come from different sources.)"
        )

    submit = auth.get("login_submit", 0)
    if submit:
        insights.append(
            f"Password login: {submit:,} submits → {login_ok:,} success / {login_fail:,} failed "
            f"({100 * login_fail / submit:.0f}% fail rate on tracked submits)."
        )

    form_open = identity.get("identity_form_open", 0)
    submitted = identity.get("identity_submitted", 0)
    mismatch = identity.get("identity_mismatch", 0)
    if form_open:
        insights.append(
            f"Identity funnel: {form_open:,} form opens → {submitted:,} submitted "
            f"({100 * submitted / form_open:.0f}% of opens); "
            f"{mismatch:,} mismatch(es)."
        )

    sess = data.session_stats
    if sess.get("sessions_with_lost"):
        insights.append(
            f"{sess['sessions_with_lost']:,} sessions recorded at least one session-lost "
            f"({sess['sessions_multi_lost']:,} had 2+); "
            f"median events/session = {sess['median_events']}."
        )

    if data.top_paths:
        top3 = data.top_paths[:3]
        insights.append(
            "Top paths: "
            + ", ".join(f"{r['name']} ({r['count']:,})" for r in top3)
            + "."
        )

    if extra:
        insights.extend(extra)

    return insights
