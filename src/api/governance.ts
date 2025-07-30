import { HoneygraphClient } from './honeygraph';

export interface Proposal {
  id: string;
  title: string;
  description: string;
  author: string;
  status: 'draft' | 'active' | 'passed' | 'failed' | 'executed';
  type: string;
  created: string;
  expires: string;
  votes: {
    yes: number;
    no: number;
    abstain: number;
  };
  quorum: number;
  threshold: number;
}

export interface ProposalDetails extends Proposal {
  parameters?: {
    current: Record<string, any>;
    proposed: Record<string, any>;
  };
  timeline: {
    created: string;
    votingStarts: string;
    votingEnds: string;
    execution?: string;
  };
  votes: {
    yes: number;
    no: number;
    abstain: number;
    total: number;
  };
  voters: Array<{
    voter: string;
    vote: string;
    power: number;
    timestamp: string;
    reason?: string;
  }>;
}

export interface VotingPower {
  username: string;
  votingPower: number;
  sources: {
    stakedLarynx: number;
    stakedSpk: number;
    delegated: number;
  };
  multipliers: {
    longevity: number;
    participation: number;
  };
  totalPower: number;
}

export interface Vote {
  voter: string;
  vote: 'yes' | 'no' | 'abstain';
  power: number;
  timestamp: string;
  reason?: string;
}

export interface ProposalVotes {
  proposalId: string;
  votes: Vote[];
  summary: {
    totalVoters: number;
    totalPower: number;
    distribution: {
      yes: { voters: number; power: number };
      no: { voters: number; power: number };
      abstain: { voters: number; power: number };
    };
  };
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  failedProposals: number;
  averageParticipation: number;
  totalVoters: number;
  topVoters: Array<{
    username: string;
    participationRate: number;
    votesCount: number;
  }>;
}

export interface ParameterChange {
  parameter: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
  block: number;
}

export interface VoterHistory {
  username: string;
  totalVotes: number;
  participationRate: number;
  recentVotes: Array<{
    proposalId: string;
    vote: string;
    timestamp: string;
  }>;
  votingPattern: {
    yes: number;
    no: number;
    abstain: number;
  };
}

export interface Delegation {
  delegate?: string;
  delegator?: string;
  power: number;
  topics: string[];
  expires: string | null;
}

export interface DelegationInfo {
  username: string;
  delegatedTo: Delegation[];
  delegatedFrom: Delegation[];
  totalDelegatedOut: number;
  totalDelegatedIn: number;
}

export interface UpcomingProposal {
  proposalId: string;
  title: string;
  votingStarts: string;
  votingEnds: string;
  type: string;
  impact: string;
}

export class GovernanceAPI {
  private client: HoneygraphClient;

  constructor(client: HoneygraphClient) {
    this.client = client;
  }

  /**
   * Get governance proposals
   */
  async getProposals(status?: string): Promise<Proposal[]> {
    return this.client.getProposals(status);
  }

  /**
   * Get detailed proposal information
   */
  async getProposalDetails(proposalId: string): Promise<ProposalDetails> {
    return this.client.get(`/api/spk/governance/proposal/${proposalId}`);
  }

  /**
   * Get user's voting power
   */
  async getVotingPower(username: string): Promise<VotingPower> {
    return this.client.get(`/api/spk/governance/voting-power/${username}`);
  }

  /**
   * Get votes for a proposal
   */
  async getProposalVotes(proposalId: string): Promise<ProposalVotes> {
    return this.client.get(`/api/spk/governance/proposal/${proposalId}/votes`);
  }

  /**
   * Get governance statistics
   */
  async getGovernanceStats(): Promise<GovernanceStats> {
    return this.client.get('/api/spk/governance/stats');
  }

  /**
   * Get parameter change history
   */
  async getParameterHistory(parameter: string): Promise<ParameterChange[]> {
    const result = await this.client.get(`/api/spk/governance/parameters/${parameter}/history`);
    return result.history || [];
  }

  /**
   * Get voter participation history
   */
  async getVoterHistory(username: string): Promise<VoterHistory> {
    return this.client.get(`/api/spk/governance/voter/${username}/history`);
  }

  /**
   * Get governance delegations
   */
  async getDelegations(username: string): Promise<DelegationInfo> {
    return this.client.get(`/api/spk/governance/delegations/${username}`);
  }

  /**
   * Get upcoming proposal votes
   */
  async getUpcomingVotes(days: number = 7): Promise<UpcomingProposal[]> {
    const result = await this.client.get('/api/spk/governance/upcoming', { days });
    return result.proposals || [];
  }

  /**
   * Get governance parameters
   */
  async getGovernanceParameters(): Promise<Record<string, any>> {
    return this.client.get('/api/spk/governance/parameters');
  }

  /**
   * Get proposal impact analysis
   */
  async getProposalImpact(proposalId: string): Promise<{
    economic: any;
    technical: any;
    social: any;
    riskLevel: string;
  }> {
    return this.client.get(`/api/spk/governance/proposal/${proposalId}/impact`);
  }

  /**
   * Get voting recommendations
   */
  async getVotingRecommendations(username: string): Promise<Array<{
    proposalId: string;
    recommendation: 'yes' | 'no' | 'abstain';
    reasoning: string;
    confidence: number;
  }>> {
    const result = await this.client.get(`/api/spk/governance/recommendations/${username}`);
    return result.recommendations || [];
  }

  /**
   * Get governance forum discussions
   */
  async getProposalDiscussions(proposalId: string): Promise<Array<{
    id: string;
    author: string;
    message: string;
    timestamp: string;
    replies: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>> {
    const result = await this.client.get(`/api/spk/governance/proposal/${proposalId}/discussions`);
    return result.discussions || [];
  }

  /**
   * Get quorum status for active proposals
   */
  async getQuorumStatus(): Promise<Array<{
    proposalId: string;
    currentQuorum: number;
    requiredQuorum: number;
    percentage: number;
    timeRemaining: string;
  }>> {
    const result = await this.client.get('/api/spk/governance/quorum-status');
    return result.proposals || [];
  }
}