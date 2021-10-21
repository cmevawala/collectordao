const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  formatEther,
  parseEther,
  hexValue,
  formatUnits,
  keccak256,
  toUtf8Bytes,
  formatBytes32String,
  parseBytes32String,
  arrayify,
  hexlify,
  Interface,
} = require("ethers/lib/utils");
const { BigNumber, utils } = require("ethers");
const RareNFTJSON = require("../artifacts/contracts/RareNFT.sol/RareNFT.json");

describe("CollectorDAO", function () {
  let CollectorDAOContract;
  let collectorDAO;
  let CTokenContract;
  let cToken;
  let RareNFTContract;
  let rareNFT;
  let owner, m1, m2, m3, m4, m5;
  let overrides;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner, m1, m2, m3, m4, m5] = await ethers.getSigners();

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
      overrides = { value: parseEther("1") };
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
      overrides = { value: parseEther("1") };
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

    it("should allow the member to caste the vote", async function () {
      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await collectorDAO.connect(m1).castVote(latestProposalId, true);

      const receipt = await collectorDAO.getReceipt(
        latestProposalId,
        m1.address
      );
      expect(receipt.hasVoted).to.equal(true);
      expect(receipt.support).to.equal(true);
    });

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

      // console.log(keccak256(toUtf8Bytes("mint(address)")));
    });

    it("should not allow the user to vote if voter has not enough balance", async function () {
      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await cToken.burn(m1.address, utils.parseUnits("1"));

      await expect(
        collectorDAO.connect(m1).castVote(latestProposalId, false)
      ).to.be.revertedWith("NOT_HAVING_ENOUGH_VOTING_BALANCE");
    });

    // it("should fail when voting line is closed for a proposal", async function () {
    //   // Set the time to be a specific amount
    //   await ethers.provider.send("evm_setNextBlockTimestamp", [
    //     new Date().getTime() + 259200,
    //   ]);
    //   await ethers.provider.send("evm_mine");

    //   let i = 17500;
    //   while (i > 0) {
    //     await ethers.provider.send("evm_mine");
    //     i--;
    //   }

    //   // Set the time to be a specific amount
    //   await expect(
    //     collectorDAO.connect(m1).castVote(latestProposalId, false)
    //   ).to.be.revertedWith("VOTING_LINES_ARE_NOT_OPEN");
    // });
  });

  describe("CollectorDAO - Delegate Vote", function () {
    let targets;
    let values;
    let signatures;
    let calldatas;
    let latestProposalId;

    beforeEach(async function () {
      overrides = { value: parseEther("1") };
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

    it("should allow the member to delegate the vote", async function () {
      overrides = { value: parseEther("1") };
      await collectorDAO.connect(m2).join(overrides);
      await collectorDAO.connect(m3).join(overrides);

      expect(formatEther(await cToken.getVotingBalance(m2.address))).to.equal(
        "1.0"
      );
      expect(formatEther(await cToken.getVotingBalance(m3.address))).to.equal(
        "1.0"
      );

      await cToken.connect(m2).delegate(m3.address);

      expect(formatEther(await cToken.getVotingBalance(m2.address))).to.equal(
        "0.0"
      );
      expect(formatEther(await cToken.getVotingBalance(m3.address))).to.equal(
        "2.0"
      );
    });

    it("should not allow the delegator to vote on the proposal once the voting power has been delegated", async function () {
      overrides = { value: parseEther("1") };
      await collectorDAO.connect(m2).join(overrides);
      await collectorDAO.connect(m3).join(overrides);

      await cToken.connect(m2).delegate(m3.address);

      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await expect(
        collectorDAO.connect(m2).castVote(latestProposalId, false)
      ).to.be.revertedWith("NOT_HAVING_ENOUGH_VOTING_BALANCE");
    });

    it("should allow the delegatee to vote on behalf of delegator", async function () {
      overrides = { value: parseEther("1") };
      await collectorDAO.connect(m2).join(overrides);
      await collectorDAO.connect(m3).join(overrides);

      await cToken.connect(m2).delegate(m3.address);

      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await collectorDAO.connect(m3).castVote(latestProposalId, true);

      const proposal = await collectorDAO.proposals(latestProposalId);
      expect(proposal.forVotes).to.equal(BigNumber.from("2"));
    });
  });

  describe("CollectorDAO - Execute Proposal", function () {
    let targets;
    let values;
    let signatures;
    let calldatas;
    let latestProposalId;
    let interface;

    beforeEach(async function () {
      interface = new Interface(RareNFTJSON.abi);

      overrides = { value: parseEther("1") };
      await collectorDAO.connect(m1).join(overrides);
      await collectorDAO.connect(m2).join(overrides);
      await collectorDAO.connect(m3).join(overrides);
      await collectorDAO.connect(m4).join(overrides);
      await collectorDAO.connect(m5).join(overrides);

      targets = [rareNFT.address];
      values = [10];
      signatures = ["-"];
      calldatas = [
        interface.encodeFunctionData("mint", [collectorDAO.address]),
      ];

      // signatures = ["mint(address)"];
      // calldatas = [hexlify(collectorDAO.address)];

      // 0x6a627842
      // 00000000000000000000000068b1d87f95878fe05b998f19b66f4baba5de1aed
      // 00000000000000000000000068b1d87f95878fe05b998f19b66f4baba5de1aed

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

    it("should execute the proprosal when proposal got enough votes", async function () {
      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 30,
      ]);
      await ethers.provider.send("evm_mine");

      await collectorDAO.connect(m1).castVote(latestProposalId, true);
      await collectorDAO.connect(m2).castVote(latestProposalId, true);
      await collectorDAO.connect(m3).castVote(latestProposalId, true);

      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 259200,
      ]);
      await ethers.provider.send("evm_mine");

      let i = 17500;
      while (i > 0) {
        await ethers.provider.send("evm_mine");
        i--;
      }

      await collectorDAO.execute(latestProposalId);

      expect(
        formatUnits(await rareNFT.balanceOf(collectorDAO.address))
      ).to.equal("0.000000000000000001");
    });

    it("should not execute the proprosal when proposal has not enough votes", async function () {
      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 300000,
      ]);
      await ethers.provider.send("evm_mine");

      await collectorDAO.connect(m1).castVote(latestProposalId, true);
      await collectorDAO.connect(m2).castVote(latestProposalId, true);
      await collectorDAO.connect(m3).castVote(latestProposalId, false);

      // Set the time to be a specific amount
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        new Date().getTime() + 750000,
      ]);
      await ethers.provider.send("evm_mine");

      let i = 17500;
      while (i > 0) {
        await ethers.provider.send("evm_mine");
        i--;
      }

      await expect(collectorDAO.execute(latestProposalId)).to.be.revertedWith(
        "PROPOSAL_DEFEATED"
      );
    });
  });
});
