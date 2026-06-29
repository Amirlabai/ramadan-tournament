/** Mirrors server countPendingAdminActionsForSeason / RegistrationWorkflowAdmin queues. */
export interface WorkflowQueueSnapshot {
    awaitingIdentity?: unknown[];
    awaitingInvoice?: unknown[];
    creations?: unknown[];
    joins?: Array<{ status?: string; registrationStatus?: string }>;
    transfers?: unknown[];
}

function dedupeIdentityRows(rows: unknown[]): unknown[] {
    const seen = new Set<string>();
    const merged: unknown[] = [];
    for (const row of rows) {
        const userId = (row as { userId?: string }).userId;
        const key = userId ?? JSON.stringify(row);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
    }
    return merged;
}

/** Same merge as RegistrationWorkflowAdmin when legacy and current fields are present. */
export function mergedIdentityQueue(data: WorkflowQueueSnapshot): unknown[] {
    const primary = data.awaitingIdentity;
    const legacy = data.awaitingInvoice;
    const rows = [
        ...(primary?.length ? primary : []),
        ...(legacy?.length ? legacy : []),
    ];
    if (!rows.length) return [];
    return dedupeIdentityRows(rows);
}

export function countAdminActionsInWorkflowData(data: WorkflowQueueSnapshot): number {
    const awaiting = mergedIdentityQueue(data);
    const adminJoins = (data.joins ?? []).filter((j) => j.status === 'owner_approved').length;
    return (
        awaiting.length +
        (data.creations?.length ?? 0) +
        adminJoins +
        (data.transfers?.length ?? 0)
    );
}
