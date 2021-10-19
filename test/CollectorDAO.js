const { expect } = require("chai");
const { ethers } = require("hardhat");
const { formatEther, parseEther } = require("ethers/lib/utils");

describe("CollectorDAO", function () {
  let CollectorDAOContract;
  let collectorDAO;
  let owner, m1;
  let overrides;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    [owner, m1] = await ethers.getSigners();

    CollectorDAOContract = await ethers.getContractFactory("CollectorDAO");
    collectorDAO = await CollectorDAOContract.deploy();
  });

  it("should have initalized DAO token with 1000 Tokens", async function () {
    expect(
      formatEther(await collectorDAO.tokenBalance(collectorDAO.address))
    ).to.equal("1000.0");
  });

  it("should have allowed a new member to join the DAO", async function () {
    overrides = { value: parseEther("0.00000000001") };
    await collectorDAO.connect(m1).join(overrides);

    expect(formatEther(await collectorDAO.tokenBalance(m1.address))).to.equal("1.0");
  });
});
