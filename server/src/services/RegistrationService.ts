import { Division } from '@prisma/client';
import {
  assignAdminIdentity as assignAdminIdentityImpl,
  submitUserIdentity as submitUserIdentityImpl,
} from './RegistrationIdentityService';
import {
  assertDivisionAccess,
  getNextMemberId,
  getNextTeamId,
  invalidateDivisionCaches,
  lockActiveDivision,
} from './registrationHelpers';
import {
  RegistrationQueryService,
  type RegistrationSummary,
  type WorkflowDivision,
} from './RegistrationQueryService';
import {
  RegistrationWorkflowService,
  type JoinRequestOptions,
} from './RegistrationWorkflowService';

export type { RegistrationSummary, WorkflowDivision, JoinRequestOptions };

export class RegistrationService {
  static getNextMemberId = getNextMemberId;
  static getNextTeamId = getNextTeamId;
  static invalidateDivisionCaches = invalidateDivisionCaches;
  static lockActiveDivision = lockActiveDivision;
  static assertDivisionAccess = assertDivisionAccess;

  static getSummary = RegistrationQueryService.getSummary;
  static listAvailableTeams = RegistrationQueryService.listAvailableTeams;
  static searchUsersForIdentity = RegistrationQueryService.searchUsersForIdentity;

  static cancelPendingRegistrationRequest =
    RegistrationWorkflowService.cancelPendingRegistrationRequest;
  static submitTeamCreation = RegistrationWorkflowService.submitTeamCreation;
  static approveTeamCreation = RegistrationWorkflowService.approveTeamCreation;
  static submitJoinRequest = RegistrationWorkflowService.submitJoinRequest;
  static ownerReviewJoin = RegistrationWorkflowService.ownerReviewJoin;
  static adminReviewJoin = RegistrationWorkflowService.adminReviewJoin;
  static submitTransfer = RegistrationWorkflowService.submitTransfer;
  static adminReviewTransfer = RegistrationWorkflowService.adminReviewTransfer;
  static setSquadRoles = RegistrationWorkflowService.setSquadRoles;
  static addOwnerToRoster = RegistrationWorkflowService.addOwnerToRoster;
  static listPendingJoinsForOwner = RegistrationWorkflowService.listPendingJoinsForOwner;
  static listPendingWorkflows = RegistrationWorkflowService.listPendingWorkflows;
  static countPendingAdminActions = RegistrationWorkflowService.countPendingAdminActions;

  static async assignAdminIdentity(
    adminId: string,
    userId: string,
    seasonId: string,
    personalId: string,
    birthYear: string | number
  ) {
    return assignAdminIdentityImpl(
      adminId,
      userId,
      seasonId,
      personalId,
      birthYear,
      lockActiveDivision
    );
  }

  static async submitUserIdentity(
    userId: string,
    personalId: string,
    birthYear: string | number,
    division: Division
  ) {
    return submitUserIdentityImpl(userId, personalId, birthYear, division, {
      assertDivisionAccess,
      lockActiveDivision,
    });
  }
}
