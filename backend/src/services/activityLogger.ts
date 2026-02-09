import prisma from "../db/index.js";

export type ActivityActionType =
  | "INVOICE_UPLOADED"
  | "INVOICE_APPROVED"
  | "INVOICE_MOVED"
  | "INVOICE_DELETED"
  | "FOLDER_CREATED"
  | "FOLDER_RENAMED"
  | "FOLDER_DELETED";

export type ActivityEntityType = "INVOICE" | "FOLDER" | "DOCUMENT";

export interface LogActivityParams {
  organizationId: string;
  userId: string;
  userName?: string | null;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId?: string | null;
  entityName?: string | null;
  metadata?: unknown;
  timestamp?: Date;
}

/**
 * Fire-and-forget activity logger.
 * Never throws; main request flow must not depend on this.
 */
export function logActivity(params: LogActivityParams): void {
  const {
    organizationId,
    userId,
    userName,
    actionType,
    entityType,
    entityId,
    entityName,
    metadata,
    timestamp,
  } = params;

  if (!organizationId || !userId || !actionType || !entityType) {
    return;
  }

  // Non-blocking: schedule async write, ignore result in caller
  Promise.resolve().then(async () => {
    try {
      await (prisma as any).activity.create({
        data: {
          organizationId,
          userId,
          userName: userName ?? null,
          actionType,
          entityType,
          entityId: entityId ?? null,
          entityName: entityName ?? null,
          metadata: metadata ?? null,
          timestamp: timestamp ?? new Date(),
        },
      });
    } catch (err) {
      // Never rethrow: logging failures should not affect main flow
      console.error("Failed to log activity", err);
    }
  });
}

