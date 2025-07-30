import { GovernanceAPI } from '../../../src/api/governance';
import { HoneygraphClient } from '../../../src/api/honeygraph';

// Mock the HoneygraphClient
jest.mock('../../../src/api/honeygraph');

describe('GovernanceAPI', () => {
  let governanceAPI: GovernanceAPI;
  let mockClient: jest.Mocked<HoneygraphClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new HoneygraphClient() as jest.Mocked<HoneygraphClient>;
    governanceAPI = new GovernanceAPI(mockClient);
  });

  describe('getProposals', () => {
    it('should get governance proposals', async () => {
      const mockProposals = [
        {
          id: 'proposal-1',
          title: 'Increase storage rewards',
          description: 'Proposal to increase storage node rewards by 10%',
          author: 'alice',
          status: 'active',
          type: 'parameter_change',
          created: '2024-01-01T00:00:00Z',
          expires: '2024-01-15T00:00:00Z',
          votes: {
            yes: 1500000,
            no: 500000,
            abstain: 100000
          },
          quorum: 1000000,
          threshold: 0.66
        }
      ];

      mockClient.getProposals.mockResolvedValueOnce(mockProposals);

      const result = await governanceAPI.getProposals('active');

      expect(mockClient.getProposals).toHaveBeenCalledWith('active');
      expect(result).toEqual(mockProposals);
    });

    it('should get all proposals when no status specified', async () => {
      mockClient.getProposals.mockResolvedValueOnce([]);

      await governanceAPI.getProposals();

      expect(mockClient.getProposals).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getProposalDetails', () => {
    it('should get detailed proposal information', async () => {
      const mockDetails = {
        id: 'proposal-1',
        title: 'Increase storage rewards',
        description: 'Detailed description...',
        author: 'alice',
        status: 'active',
        parameters: {
          current: { storageRewardRate: 100 },
          proposed: { storageRewardRate: 110 }
        },
        timeline: {
          created: '2024-01-01T00:00:00Z',
          votingStarts: '2024-01-02T00:00:00Z',
          votingEnds: '2024-01-15T00:00:00Z',
          execution: '2024-01-16T00:00:00Z'
        },
        votes: {
          yes: 1500000,
          no: 500000,
          abstain: 100000,
          total: 2100000
        },
        voters: []
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockDetails);

      const result = await governanceAPI.getProposalDetails('proposal-1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/proposal/proposal-1');
      expect(result).toEqual(mockDetails);
    });
  });

  describe('getVotingPower', () => {
    it('should get user voting power', async () => {
      const mockPower = {
        username: 'alice',
        votingPower: 150000,
        sources: {
          stakedLarynx: 100000,
          stakedSpk: 50000,
          delegated: 0
        },
        multipliers: {
          longevity: 1.2,
          participation: 1.1
        },
        totalPower: 150000
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockPower);

      const result = await governanceAPI.getVotingPower('alice');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/voting-power/alice');
      expect(result).toEqual(mockPower);
    });
  });

  describe('getProposalVotes', () => {
    it('should get votes for a proposal', async () => {
      const mockVotes = {
        proposalId: 'proposal-1',
        votes: [
          {
            voter: 'alice',
            vote: 'yes',
            power: 150000,
            timestamp: '2024-01-02T12:00:00Z',
            reason: 'Good for the network'
          },
          {
            voter: 'bob',
            vote: 'no',
            power: 80000,
            timestamp: '2024-01-02T13:00:00Z'
          }
        ],
        summary: {
          totalVoters: 125,
          totalPower: 2100000,
          distribution: {
            yes: { voters: 80, power: 1500000 },
            no: { voters: 40, power: 500000 },
            abstain: { voters: 5, power: 100000 }
          }
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockVotes);

      const result = await governanceAPI.getProposalVotes('proposal-1');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/proposal/proposal-1/votes');
      expect(result).toEqual(mockVotes);
    });
  });

  describe('getGovernanceStats', () => {
    it('should get governance statistics', async () => {
      const mockStats = {
        totalProposals: 45,
        activeProposals: 3,
        passedProposals: 38,
        failedProposals: 4,
        averageParticipation: 65.5,
        totalVoters: 1250,
        topVoters: [
          {
            username: 'alice',
            participationRate: 95.5,
            votesCount: 43
          }
        ]
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockStats);

      const result = await governanceAPI.getGovernanceStats();

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getParameterHistory', () => {
    it('should get parameter change history', async () => {
      const mockHistory = [
        {
          parameter: 'storageRewardRate',
          oldValue: 90,
          newValue: 100,
          changedBy: 'proposal-0',
          changedAt: '2023-12-01T00:00:00Z',
          block: 95000000
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ history: mockHistory });

      const result = await governanceAPI.getParameterHistory('storageRewardRate');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/parameters/storageRewardRate/history');
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getVoterHistory', () => {
    it('should get voter participation history', async () => {
      const mockHistory = {
        username: 'alice',
        totalVotes: 43,
        participationRate: 95.5,
        recentVotes: [
          {
            proposalId: 'proposal-1',
            vote: 'yes',
            timestamp: '2024-01-02T12:00:00Z'
          }
        ],
        votingPattern: {
          yes: 35,
          no: 6,
          abstain: 2
        }
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockHistory);

      const result = await governanceAPI.getVoterHistory('alice');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/voter/alice/history');
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getDelegations', () => {
    it('should get governance delegations', async () => {
      const mockDelegations = {
        username: 'alice',
        delegatedTo: [
          {
            delegate: 'bob',
            power: 50000,
            topics: ['technical'],
            expires: '2024-06-01T00:00:00Z'
          }
        ],
        delegatedFrom: [
          {
            delegator: 'charlie',
            power: 25000,
            topics: ['all'],
            expires: null
          }
        ],
        totalDelegatedOut: 50000,
        totalDelegatedIn: 25000
      };

      mockClient.get = jest.fn().mockResolvedValueOnce(mockDelegations);

      const result = await governanceAPI.getDelegations('alice');

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/delegations/alice');
      expect(result).toEqual(mockDelegations);
    });
  });

  describe('getUpcomingVotes', () => {
    it('should get upcoming proposal votes', async () => {
      const mockUpcoming = [
        {
          proposalId: 'proposal-2',
          title: 'Update fee structure',
          votingStarts: '2024-01-05T00:00:00Z',
          votingEnds: '2024-01-20T00:00:00Z',
          type: 'fee_change',
          impact: 'high'
        }
      ];

      mockClient.get = jest.fn().mockResolvedValueOnce({ proposals: mockUpcoming });

      const result = await governanceAPI.getUpcomingVotes(7);

      expect(mockClient.get).toHaveBeenCalledWith('/api/spk/governance/upcoming', { days: 7 });
      expect(result).toEqual(mockUpcoming);
    });
  });
});