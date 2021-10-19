// contracts/Governance.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./CToken.sol";

contract CollectorDAO {

    event Join(address indexed sender, string message);

    uint private constant MINIMUM_MEMBERSHIP_FEE = 0.00000000001 ether;

    CToken private _ctoken;

    mapping (address => bool) private _members;
    uint private balance;

    constructor() {
        _ctoken = new CToken();
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
}
