// contracts/CollectorDAO.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "./CToken.sol";

contract CollectorDAO {

    // Memberships
    event Join(address indexed sender, string message);

    uint private constant MINIMUM_MEMBERSHIP_FEE = 1 ether; // 0.01 %

    CToken private _ctoken;

    mapping (address => bool) private _members;
    uint private balance;
    address owner;


    // // Governance Properties
    string public constant NAME = "Collector DAO";

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    function quorumVotes() public pure returns (uint) { return 3; } // 25 % of CToken
    
    /// @notice The maximum number of actions that can be included in a proposal
    function proposalMaxOperations() public pure returns (uint) { return 10; } // 10 actions

    /// @notice The delay before voting on a proposal may take place, once proposed
    function votingDelay() public pure returns (uint) { return 1; } // 1 block

    /// @notice The duration of voting on a proposal, in blocks
    function votingPeriod() public pure returns (uint) { return 17280; } // ~3 days in blocks (assuming 15s blocks)

    /// @notice The total number of proposals
    uint public proposalCount;

    struct Proposal {
        /// @notice Unique id for looking up a proposal
        uint id;

        /// @notice Creator of the proposal
        address proposer;

        /// @notice the ordered list of target addresses for calls to be made
        address[] targets;

        /// @notice The ordered list of values (i.e. msg.value) to be passed to the calls to be made
        uint[] values;

        /// @notice The ordered list of function signatures to be called
        string[] signatures;

        /// @notice The ordered list of calldata to be passed to each call
        bytes[] calldatas;

        /// @notice The block at which voting begins: holders must delegate their votes prior to this block
        uint startBlock;

        /// @notice The block at which voting ends: votes must be cast prior to this block
        uint endBlock;

        /// @notice Current number of votes in favor of this proposal
        uint forVotes;

        /// @notice Current number of votes in opposition to this proposal
        uint againstVotes;

        /// @notice Flag marking whether the proposal has been executed
        bool executed;
    }

    /// @notice Receipts of ballots for the entire set of voters 
    mapping (uint => mapping(address => Receipt)) proposalReceipts;

    /// @notice Ballot receipt record for a voter
    struct Receipt {
        /// @notice Whether or not a vote has been cast
        bool hasVoted;

        /// @notice Whether or not the voter supports the proposal
        bool support;
    }

    /// @notice Possible states that a proposal may be in
    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    /// @notice The official record of all proposals ever proposed
    mapping (uint => Proposal) public proposals;

    /// @notice The latest proposal for each proposer
    mapping (address => uint) public latestProposalIds;

    /// @notice An event emitted when a new proposal is created
    event ProposalCreated(uint id, address proposer, address[] targets, uint[] values, string[] signatures, bytes[] calldatas, uint startBlock, uint endBlock, string description);

    /// @notice An event emitted when a vote has been cast on a proposal
    event VoteCast(address voter, uint proposalId, bool support);

    /// @notice An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint id);


    // // Governance Methods

    constructor() {
        _ctoken = new CToken();
        owner = msg.sender;
    }

    function getTokenAddress() external view returns (CToken) {
        return _ctoken;
    }

    function tokenBalance(address member) external view returns (uint) {
        return _ctoken.balanceOf(member);
    }

    function join() external payable returns (bool) {

        // sender is already a member
        require(_members[msg.sender] == false, "NOT_A_NEW_MEMBER");

        // sender needs to send minium membership fee
        require(msg.value >= MINIMUM_MEMBERSHIP_FEE, "MINIMUM_MEMBERSHIP_FEE_REQUIRED");

        // Join the DAO
        _members[msg.sender] = true;
        balance += msg.value;

        // Transfer the DAO token
        _ctoken.transfer(msg.sender, 1 * (10 ** 18));

        // Emit event
        emit Join(msg.sender, "Member Joined");

        return true;
    }

    function propose(address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public payable returns (uint) {
        require(_members[msg.sender] == true, "MEMBER_NOT_REGISTERED");
        require(targets.length != 0, "PROPOSAL_MUST_PROVIDE_ACTIONS");
        require(targets.length == signatures.length && targets.length == calldatas.length, "PROPOSAL_FUNCTION_ARITY_MISMATCH");
        require(targets.length <= proposalMaxOperations(), "PROPOSAL_PROVIDED_TOO_MANY_ACTIONS");

        uint startBlock = block.number + votingDelay();
        uint endBlock = startBlock + votingPeriod();

        proposalCount++;
        Proposal memory newProposal = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            targets: targets,
            values: values,
            signatures: signatures,
            calldatas: calldatas,
            startBlock: startBlock,
            endBlock: endBlock,
            forVotes: 0,
            againstVotes: 0,
            executed: false
        });

        proposals[newProposal.id] = newProposal;
        latestProposalIds[newProposal.proposer] = newProposal.id;

        emit ProposalCreated(newProposal.id, msg.sender, targets, values, signatures, calldatas, startBlock, endBlock, description);
        return newProposal.id;
    }

    function state(uint proposalId) public view returns (ProposalState) {
        require(proposalCount >= proposalId && proposalId > 0, "INVALID_PROPOSAL_ID");

        Proposal storage proposal = proposals[proposalId];
        if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes() ) {
            return ProposalState.Defeated;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else {
            return ProposalState.Queued;
        }

        //  } else if (block.timestamp >= proposal.eta + 1) { //timelock.GRACE_PERIOD()
        //     return ProposalState.Expired;
    }

    function castVote(uint proposalId, bool support) public {
        require(_members[msg.sender] == true, "VOTER_NOT_REGISTERED");
        require(state(proposalId) == ProposalState.Active, "VOTING_LINES_ARE_NOT_OPEN");

        address voter = msg.sender;
        Receipt storage receipt = proposalReceipts[proposalId][voter];
        require(receipt.hasVoted == false, "ALREADY_VOTED");
        
        Proposal storage proposal = proposals[proposalId];
        if (support) {
            proposal.forVotes = proposal.forVotes + 1;
        } else {
            proposal.againstVotes = proposal.againstVotes + 1;
        }

        receipt.hasVoted = true;
        receipt.support = support;

        emit VoteCast(voter, proposalId, support);

        if (state(proposalId) == ProposalState.Queued) {
            execute(proposalId);
        }
    }

    function getReceipt(uint proposalId, address voter) public view returns (Receipt memory) {
        return proposalReceipts[proposalId][voter];
    }

    function execute(uint proposalId) public payable {
        require(owner == msg.sender, "RESTRICTED_ACCESS");

        Proposal storage proposal = proposals[proposalId];

        if (state(proposalId) == ProposalState.Defeated) require(false, "PROPOSAL_DEFEATED");
        require(state(proposalId) == ProposalState.Queued, "PROPOSAL_IN_QUEUE");
        
        for (uint i = 0; i < proposal.targets.length; i++) {
            executeTransaction(proposal.targets[i], proposal.values[i], proposal.calldatas[i]);
        }

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    function executeTransaction(address target, uint value, bytes memory callData) public payable returns (bytes memory) {
        require(owner == msg.sender, "RESTRICTED_ACCESS");

        (bool success, bytes memory returnData) = target.call(callData);
        require(success, "EXECUTE_TRANSACTION_FAILED.");
    }
}
