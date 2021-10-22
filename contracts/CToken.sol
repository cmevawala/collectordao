// contracts/CToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CToken is ERC20 {

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;
    
    /// @notice The number of voting balance for each account
    mapping (address => uint256) public votingBalance;

    constructor() ERC20("Collector Token", "CTR") {
        mint(10 * (10 ** decimals()));
    }

    function mint(uint amount) private returns (bool) {
        // _mint(msg.sender, 10 * (10 ** decimals()));
        _mint(msg.sender, amount);
        return true;
    }

    function transfer(address recipient, uint amount) public override returns (bool) {
        votingBalance[recipient] += amount;
        super.transfer(recipient, amount);

        return true;
    }

    function delegate(address delegatee) public {
        address delegator = msg.sender;

        require(votingBalance[delegator] > 0, "DELEGATOR_HAS_NO_VOTING_BALANCE");

        address currentDelegate = delegates[delegator];
        delegates[delegator] = delegatee;

        uint delegatorBalance = balanceOf(delegator);
        votingBalance[delegator] -= delegatorBalance;
        votingBalance[delegatee] += delegatorBalance;

        emit DelegateChanged(delegator, currentDelegate, delegatee);
    }

    function getVotingBalance(address account) external view returns (uint) {
        return votingBalance[account];
    }

    function burn(address account, uint amount) public returns (bool) {
        votingBalance[account] = 0;
        _burn(account, amount);
        return true;
    }

}
