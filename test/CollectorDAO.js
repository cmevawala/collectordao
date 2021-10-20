const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  formatEther,
  parseEther,
  hexValue,
  formatUnits,
} = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

describe("CollectorDAO", function () {
  let CollectorDAOContract;
  let collectorDAO;
  let CTokenContract;
  let cToken;
  let RareNFTContract;
  let rareNFT;
  let owner, m1, m2;
  let overrides;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner, m1, m2] = await ethers.getSigners();

    CollectorDAOContract = await ethers.getContractFactory("CollectorDAO");
    collectorDAO = await CollectorDAOContract.deploy();

    CTokenContract = await collectorDAO.getTokenAddress();
    cToken = await ethers.getContractAt("CToken", CTokenContract);

    RareNFTContract = await ethers.getContractFactory("RareNFT");
    rareNFT = await RareNFTContract.deploy();
  });

  it("should have initalized DAO token with 10 Tokens", async function () {
    expect(
      formatEther(await collectorDAO.tokenBalance(collectorDAO.address))
    ).to.equal("10.0");
  });

  it("should fail to join the DAO if minium ETH is not provided", async function () {
    overrides = { value: parseEther("0.0001") };

    await expect(collectorDAO.connect(m1).join(overrides)).to.be.revertedWith(
      "MINIMUM_MEMBERSHIP_FEE_REQUIRED"
    );
  });

  describe("CollectorDAO - Joining DAO", function () {
    let targets;
    let values;
    let signatures;
    let calldatas;

    beforeEach(async function () {
      overrides = { value: parseEther("0.001") };
      await collectorDAO.connect(m1).join(overrides);

      targets = [rareNFT.address];
      values = [];
      signatures = ["5328920c"];
      calldatas = [collectorDAO.address];
    });

    it("should have allowed a new member to join the DAO", async function () {
      expect(formatEther(await cToken.balanceOf(m1.address))).to.equal("1.0");
    });

    it("should not allow the same member to join the DAO again", async function () {
      await expect(collectorDAO.connect(m1).join(overrides)).to.be.revertedWith(
        "NOT_A_NEW_MEMBER"
      );
    });

    it("should have allowed a new member to add the proposal", async function () {
      await collectorDAO
        .connect(m1)
        .propose(
          targets,
          values,
          signatures,
          calldatas,
          "Proposal 1 Created",
          overrides
        );

      const latestProposalId = await collectorDAO.latestProposalIds(m1.address);
      expect(latestProposalId.toBigInt()).to.equal(BigNumber.from("1"));

      // Expect proposal in queue state
      const proposalState = await collectorDAO.state(latestProposalId);
      expect(proposalState).to.equal(0); // Proposal.Queued State
    });

    it("should fail with ARITY_MISMATCH when trying to add the proposal", async function () {
      targets = [rareNFT.address];
      values = [];
      signatures = ["5328920c"];
      calldatas = [];

      await expect(
        collectorDAO
          .connect(m1)
          .propose(
            targets,
            values,
            signatures,
            calldatas,
            "Proposal 1 Created",
            overrides
          )
      ).to.be.revertedWith("PROPOSAL_FUNCTION_ARITY_MISMATCH");
    });

    it("should fail with PROPOSAL_MUST_PROVIDE_ACTIONS when trying to add the proposal", async function () {
      targets = [];
      values = [];
      signatures = ["5328920c"];
      calldatas = [];

      await expect(
        collectorDAO
          .connect(m1)
          .propose(
            targets,
            values,
            signatures,
            calldatas,
            "Proposal 1 Created",
            overrides
          )
      ).to.be.revertedWith("PROPOSAL_MUST_PROVIDE_ACTIONS");
    });
  });

  describe("CollectorDAO - Caste Vote", function () {
    let targets;
    let values;
    let signatures;
    let calldatas;
    let latestProposalId;

    beforeEach(async function () {
      overrides = { value: parseEther("0.001") };
      await collectorDAO.connect(m1).join(overrides);

      targets = [rareNFT.address];
      values = [];
      signatures = ["5328920c"];
      calldatas = [collectorDAO.address];

      await collectorDAO
        .connect(m1)
        .propose(
          targets,
          values,
          signatures,
          calldatas,
          "Proposal 1 Created",
          overrides
        );

      latestProposalId = await collectorDAO.latestProposalIds(m1.address);
    });

    it("should fail with proposal in pending state", async function () {
      await expect(
        collectorDAO.connect(m1).castVote(latestProposalId, false)
      ).to.be.revertedWith("PROPOSAL_IN_PENDING_STATE");
    });

    it("should allow the member to caste the vote", async function () {
      //   overrides = { value: parseEther("0.001") };
      //   await collectorDAO.connect(m1).join(overrides);

      //   targets = [rareNFT.address];
      //   values = [];
      //   signatures = ["5328920c"];
      //   calldatas = [collectorDAO.address];

      //   await collectorDAO
      //     .connect(m1)
      //     .propose(
      //       targets,
      //       values,
      //       signatures,
      //       calldatas,
      //       "Proposal 1 Created",
      //       overrides
      //     );

      //   const latestProposalId = await collectorDAO.latestProposalIds(m1.address);
      expect(latestProposalId.toBigInt()).to.equal(BigNumber.from("1"));

      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await collectorDAO.connect(m1).castVote(latestProposalId, false);

      const receipt = await collectorDAO.getReceipt(
        latestProposalId,
        m1.address
      );
      expect(receipt.hasVoted).to.equal(true);
      expect(receipt.support).to.equal(false);
    });

    // it("should fail when voting line is closed for a proposal", async function () {
    //   // Set the time to be a specific amount

    //   await expect(
    //     collectorDAO.connect(m1).castVote(latestProposalId, false)
    //   ).to.be.revertedWith("VOTING_CLOSED");
    // });
    it("should fail when voter has already voted for a proposal", async function () {
      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await collectorDAO.connect(m1).castVote(latestProposalId, false);

      await expect(
        collectorDAO.connect(m1).castVote(latestProposalId, false)
      ).to.be.revertedWith("ALREADY_VOTED");
    });
  });
});
